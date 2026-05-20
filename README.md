# 💧 Agua Aserrí — Sistema de Reportes Comunales

Aplicación web para que los vecinos de Aserrí reporten cuándo llega y se va el agua en su zona, con mapa interactivo de Google Maps.

---

## 🚀 Instalación

### 1. Requisitos
- Node.js v18 o superior
- Una clave de API de Google Maps

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Google Maps API Key

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Crea un proyecto nuevo (o usa uno existente)
3. Habilita la **Maps JavaScript API**
4. Crea una API Key
5. Defina la variable de entorno `GOOGLE_MAPS_API_KEY` antes de iniciar el servidor.

También puede crear un archivo `.env` en la raíz del proyecto con este contenido:

```env
GOOGLE_MAPS_API_KEY=TU_CLAVE_AQUI
```

En PowerShell:

```powershell
$env:GOOGLE_MAPS_API_KEY="TU_CLAVE_AQUI"
npm start
```

Importante:
- No guarde la clave dentro de `public/index.html` ni en archivos públicos.
- Restrinja la API key en Google Cloud por dominio/IP y por API permitida.

### 4. Iniciar el servidor
```bash
npm start
```

Abre tu navegador en: **http://localhost:3000**

---

## 📋 Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| 📝 Nuevo reporte | Nombre/cédula, zona, hora llegada, hora se fue, comentario |
| 📍 Ubicación | Clic en mapa o botón "Usar mi ubicación" (GPS) |
| 🗺️ Mapa | Muestra todos los reportes de las últimas 24h |
| 📋 Lista | Lista cronológica de reportes recientes |
| 📊 Stats | Reportes del día, total y zona con más reportes |

---

## 🗂️ Estructura del proyecto

```
agua-aserrí/
├── server.js          ← Servidor Node.js + Express
├── package.json
├── db/
│   └── reportes.db    ← Base de datos SQLite (se crea automáticamente)
└── public/
    └── index.html     ← Frontend completo
```

---

## 🔌 API REST

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/reportes` | Crear nuevo reporte |
| `GET` | `/api/reportes` | Reportes últimas 24h |
| `GET` | `/api/reportes/todos` | Deshabilitado por seguridad |
| `GET` | `/api/stats` | Estadísticas generales |

## Seguridad aplicada

- La API limita frecuencia de envío para reducir abuso.
- Se validan tamaño y formato de los datos recibidos.
- Los reportes públicos no exponen la identificación completa.
- Se agregan cabeceras HTTP defensivas y política de contenido.
- La clave de Google Maps se sirve desde configuración del servidor.

### Ejemplo de reporte (POST /api/reportes)
```json
{
  "identificacion": "Juan Pérez",
  "zona": "Centro de Aserrí",
  "hora_llego": "06:30",
  "hora_se_fue": "09:15",
  "comentario": "Llegó con poca presión",
  "latitud": 9.8608,
  "longitud": -84.1040
}
```

---

## 🌐 Publicar en internet (opcional)

Para que todos los vecinos puedan usarlo, podés publicarlo en:
- **Railway** (gratis): https://railway.app
- **Render** (gratis): https://render.com
- **Heroku**: https://heroku.com

---

## 📞 Soporte
Desarrollado para la comunidad de Aserrí, Costa Rica. 🇨🇷
