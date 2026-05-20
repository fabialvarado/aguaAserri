let map, marcadorActual, infoWindowActual;
let lat = null;
let lng = null;
const marcadores = [];
const APP_CONFIG = window.APP_CONFIG || {};
let mapsReady = false;

function isMapsReady() {
  return mapsReady && typeof window.google !== 'undefined' && google.maps && map;
}

window.initMap = function () {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 9.8608, lng: -84.1040 },
    zoom: 14,
    mapTypeId: 'roadmap',
    styles: [
      { featureType: 'water', stylers: [{ color: '#b3e5fc' }] },
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
    ],
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  map.addListener('click', (e) => {
    setUbicacion(e.latLng.lat(), e.latLng.lng());
  });

  cargarReportesEnMapa();
  cargarStats();
  document.getElementById('mapHint').style.display = 'block';
  setTimeout(() => {
    document.getElementById('mapHint').style.display = 'none';
  }, 4000);
  mapsReady = true;
};

function setUbicacion(la, lo) {
  lat = la;
  lng = lo;

  if (!isMapsReady()) {
    document.getElementById('ubicacionBox').style.display = 'block';
    document.getElementById('coordsText').textContent = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
    return;
  }

  if (marcadorActual) marcadorActual.setMap(null);

  marcadorActual = new google.maps.Marker({
    position: { lat, lng },
    map,
    title: 'Mi ubicación',
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#0d47a1',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2
    },
    animation: google.maps.Animation.DROP
  });

  document.getElementById('ubicacionBox').style.display = 'block';
  document.getElementById('coordsText').textContent = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
}

function obtenerUbicacion() {
  if (!navigator.geolocation) {
    showToast('Su navegador no soporta geolocalización', true);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setUbicacion(pos.coords.latitude, pos.coords.longitude);
      if (isMapsReady()) {
        map.setCenter({ lat, lng });
        map.setZoom(16);
      }
    },
    () => showToast('No se pudo obtener su ubicación. Haga clic en el mapa.', true)
  );
}

async function enviarReporte() {
  const identificacion = document.getElementById('identificacion').value.trim();
  const zona = document.getElementById('zona').value;
  const horaLlego = document.getElementById('horaLlego').value;
  const horaSefu = document.getElementById('horaSefu').value;
  const comentario = document.getElementById('comentario').value.trim();

  if (!identificacion) {
    showToast('Ingrese su nombre o cédula', true);
    return;
  }
  if (identificacion.length > 80) {
    showToast('La identificación es demasiado larga', true);
    return;
  }
  if (comentario.length > 300) {
    showToast('El comentario es demasiado largo', true);
    return;
  }
  if (lat === null || lng === null) {
    showToast('Debe seleccionar su ubicación en el mapa', true);
    return;
  }

  const btn = document.getElementById('btnEnviar');
  btn.disabled = true;
  btn.innerHTML = '<div class="loader" style="display:inline-block"></div>';

  try {
    const res = await fetch('/api/reportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identificacion,
        zona,
        hora_llego: horaLlego,
        hora_se_fue: horaSefu,
        comentario,
        latitud: lat,
        longitud: lng
      })
    });

    if (!res.ok) throw new Error();

    showToast('Reporte enviado correctamente. Gracias.');
    limpiarFormulario();
    cargarReportesEnMapa();
    cargarStats();
    if (document.getElementById('tabLista').style.display !== 'none') cargarListaReportes();
  } catch {
    showToast('Error al enviar el reporte. Intente de nuevo.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar reporte';
  }
}

function limpiarFormulario() {
  document.getElementById('identificacion').value = '';
  document.getElementById('zona').value = '';
  document.getElementById('horaLlego').value = '';
  document.getElementById('horaSefu').value = '';
  document.getElementById('comentario').value = '';
  document.getElementById('ubicacionBox').style.display = 'none';
  lat = null;
  lng = null;
  if (marcadorActual) {
    marcadorActual.setMap(null);
    marcadorActual = null;
  }
}

async function cargarReportesEnMapa() {
  try {
    const res = await fetch('/api/reportes');
    const reportes = await res.json();

    marcadores.forEach((m) => m.setMap(null));
    marcadores.length = 0;

    reportes.forEach((r) => {
      const marker = new google.maps.Marker({
        position: { lat: r.latitud, lng: r.longitud },
        map,
        title: r.identificacion,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: '#29b6f6',
          fillOpacity: 0.9,
          strokeColor: '#0d47a1',
          strokeWeight: 1.5
        }
      });

      const iw = new google.maps.InfoWindow({
        content: `
          <div class="info-window">
            <strong>${escHtml(r.identificacion)}</strong>
            ${r.zona ? `<div class="info-row">${escHtml(r.zona)}</div>` : ''}
            ${r.hora_llego ? `<div class="info-row">Llegó: ${r.hora_llego}</div>` : ''}
            ${r.hora_se_fue ? `<div class="info-row">Se fue: ${r.hora_se_fue}</div>` : ''}
            ${r.comentario ? `<div class="info-row" style="margin-top:4px;color:#666;font-style:italic">"${escHtml(r.comentario)}"</div>` : ''}
            <div class="info-row" style="font-size:.72rem;color:#999;margin-top:4px">${formatFecha(r.fecha_reporte)}</div>
          </div>`
      });

      marker.addListener('click', () => {
        if (infoWindowActual) infoWindowActual.close();
        iw.open(map, marker);
        infoWindowActual = iw;
      });

      marcadores.push(marker);
    });
  } catch (e) {
    console.error(e);
  }
}

async function cargarListaReportes() {
  const container = document.getElementById('listaReportes');
  try {
    const res = await fetch('/api/reportes');
    const reportes = await res.json();

    if (!reportes.length) {
      container.innerHTML = '<div class="sin-reportes"><div class="icon">💧</div>No hay reportes en las últimas 24 horas.</div>';
      return;
    }

    container.innerHTML = reportes.map((r) => `
      <div class="reporte-card">
        <div class="rc-header">
          <div class="rc-id">${escHtml(r.identificacion)}</div>
          <div class="rc-fecha">${formatFecha(r.fecha_reporte)}</div>
        </div>
        ${r.zona ? `<div class="rc-info"><span class="rc-badge">${escHtml(r.zona)}</span></div>` : ''}
        <div class="rc-info">
          ${r.hora_llego ? `<span class="rc-badge llegada">Llegó: ${r.hora_llego}</span>` : ''}
          ${r.hora_se_fue ? `<span class="rc-badge sefu">Se fue: ${r.hora_se_fue}</span>` : ''}
        </div>
        ${r.comentario ? `<div class="rc-comentario">"${escHtml(r.comentario)}"</div>` : ''}
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="sin-reportes"><div class="icon">⚠️</div>Error al cargar reportes.</div>';
  }
}

async function cargarStats() {
  try {
    const res = await fetch('/api/stats');
    const s = await res.json();
    document.getElementById('statHoy').textContent = s.hoy;
    document.getElementById('statTotal').textContent = s.total;
    if (s.zonas.length) {
      const statZona = document.getElementById('statZona');
      statZona.textContent = `${s.zonas[0].zona} (${s.zonas[0].cantidad})`;
    }
  } catch {
  }
}

function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  document.getElementById('tabForm').style.display = tab === 'form' ? 'block' : 'none';
  const lista = document.getElementById('tabLista');
  lista.style.display = tab === 'lista' ? 'block' : 'none';
  if (tab === 'lista') cargarListaReportes();
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, error = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (error ? ' error' : '');
  setTimeout(() => {
    t.className = 'toast';
  }, 3500);
}

function showMapError(message) {
  const mapEl = document.getElementById('map');
  mapEl.className = 'map-error';
  mapEl.textContent = message;
  document.getElementById('mapHint').style.display = 'none';
}

function cargarGoogleMaps() {
  const apiKey = APP_CONFIG.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    showMapError('El mapa no está configurado en este servidor.');
    return;
  }

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initMap&libraries=places`;
  script.async = true;
  script.defer = true;
  script.onerror = () => showMapError('No se pudo cargar Google Maps.');
  document.body.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn[data-tab]').forEach((button) => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
  });

  const btnUbicacion = document.getElementById('btnUbicacion');
  if (btnUbicacion) btnUbicacion.addEventListener('click', obtenerUbicacion);

  const btnEnviar = document.getElementById('btnEnviar');
  if (btnEnviar) btnEnviar.addEventListener('click', enviarReporte);

  document.getElementById('tabLista').style.display = 'none';
  cargarGoogleMaps();
});
