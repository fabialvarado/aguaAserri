const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const ENV_FILE = path.join(__dirname, '.env');

if (fs.existsSync(ENV_FILE)) {
  const envLines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  envLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db', 'reportes.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_REPORTES_PUBLICOS = 200;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 25;
const BODY_LIMIT = '10kb';
const rateBuckets = new Map();
const ALLOWED_ZONAS = new Set([
  'Centro de Aserrí',
  'Salitral',
  'Vuelta de Jorco',
  'San Gabriel',
  'Legua',
  'Monterrey',
  'Patarra',
  'Otro'
]);

// Asegurar que existe el directorio y archivo
if (!fs.existsSync(path.join(__dirname, 'db'))) fs.mkdirSync(path.join(__dirname, 'db'));
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ reportes: [] }));

// Helpers DB (JSON simple)
function leerDB() {
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.reportes)) {
    return { reportes: [] };
  }
  return parsed;
}
function guardarDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'desconocido';
}

function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }

  if (bucket.count >= RATE_MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intente de nuevo más tarde.' });
  }

  bucket.count += 1;
  return next();
}

function safeText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return NaN;
}

function isValidCoordinate(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function maskIdentificacion(value) {
  if (!value) return 'Anonimo';
  const trimmed = String(value).trim();
  if (trimmed.length <= 3) return '***';
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

function sanitizeReporteInput(body) {
  const identificacion = safeText(body.identificacion, 80);
  const zona = safeText(body.zona, 60);
  const comentario = safeText(body.comentario, 300);
  const hora_llego = body.hora_llego ? safeText(body.hora_llego, 5) : null;
  const hora_se_fue = body.hora_se_fue ? safeText(body.hora_se_fue, 5) : null;
  const latitud = toNumber(body.latitud);
  const longitud = toNumber(body.longitud);

  if (!identificacion) {
    return { error: 'La identificación es obligatoria.' };
  }

  if (!isValidCoordinate(latitud, -90, 90) || !isValidCoordinate(longitud, -180, 180)) {
    return { error: 'La ubicación enviada no es válida.' };
  }

  if (hora_llego && !isValidTime(hora_llego)) {
    return { error: 'La hora de llegada no tiene un formato válido.' };
  }

  if (hora_se_fue && !isValidTime(hora_se_fue)) {
    return { error: 'La hora de salida no tiene un formato válido.' };
  }

  if (zona && !ALLOWED_ZONAS.has(zona)) {
    return { error: 'La zona indicada no es válida.' };
  }

  return {
    value: {
      identificacion,
      identificacion_publica: maskIdentificacion(identificacion),
      hora_llego,
      hora_se_fue,
      zona: zona || null,
      comentario,
      latitud,
      longitud
    }
  };
}

function toPublicReporte(reporte) {
  return {
    id: reporte.id,
    identificacion: reporte.identificacion_publica || maskIdentificacion(reporte.identificacion),
    hora_llego: reporte.hora_llego,
    hora_se_fue: reporte.hora_se_fue,
    zona: reporte.zona,
    comentario: reporte.comentario,
    latitud: reporte.latitud,
    longitud: reporte.longitud,
    fecha_reporte: reporte.fecha_reporte
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets.entries()) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https://maps.googleapis.com https://maps.gstatic.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );
  next();
});

app.use(cors({ origin: false }));
app.use(express.json({ limit: BODY_LIMIT, strict: true }));
app.use(express.static(PUBLIC_DIR));

// ── POST /api/reportes ────────────────────────
app.post('/api/reportes', rateLimit, (req, res) => {
  const parsed = sanitizeReporteInput(req.body || {});
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const db = leerDB();
  const nuevo = {
    id: Date.now(),
    ...parsed.value,
    fecha_reporte: new Date().toISOString()
  };
  db.reportes.push(nuevo);
  guardarDB(db);
  res.status(201).json({ id: nuevo.id, mensaje: 'Reporte guardado correctamente' });
});

// ── GET /api/reportes (últimas 24h) ───────────
app.get('/api/reportes', (req, res) => {
  const db = leerDB();
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recientes = db.reportes
    .filter(r => r.fecha_reporte >= hace24h)
    .sort((a, b) => b.fecha_reporte.localeCompare(a.fecha_reporte))
    .slice(0, MAX_REPORTES_PUBLICOS)
    .map(toPublicReporte);
  res.json(recientes);
});

// ── GET /api/reportes/todos ───────────────────
app.get('/api/reportes/todos', (req, res) => {
  res.status(403).json({ error: 'Ruta deshabilitada por seguridad.' });
});

// ── GET /api/stats ────────────────────────────
app.get('/api/stats', (req, res) => {
  const db = leerDB();
  const hoyStr = new Date().toISOString().slice(0, 10);
  const hoy = db.reportes.filter(r => r.fecha_reporte.startsWith(hoyStr)).length;

  // Contar por zona
  const zonasMap = {};
  db.reportes.forEach(r => {
    if (r.zona) zonasMap[r.zona] = (zonasMap[r.zona] || 0) + 1;
  });
  const zonas = Object.entries(zonasMap)
    .map(([zona, cantidad]) => ({ zona, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  res.json({ total: db.reportes.length, hoy, zonas });
});

app.get('/config.js', (req, res) => {
  const apiKey = JSON.stringify(process.env.GOOGLE_MAPS_API_KEY || '');
  res.type('application/javascript');
  res.send(`window.APP_CONFIG = { GOOGLE_MAPS_API_KEY: ${apiKey} };`);
});

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido.' });
  }

  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud excede el tamaño permitido.' });
  }

  return next(err);
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📂 Base de datos: ${DB_FILE}`);
});
