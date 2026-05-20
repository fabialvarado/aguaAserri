# Agua Aserrí - Sistema de Reportes Comunales

Aplicación web para que los vecinos de Aserrí reporten cuándo llega y se va el agua en su zona, con mapa interactivo y persistencia en MongoDB Atlas.

## Instalación

### 1. Requisitos
- Node.js v18 o superior
- Una clave de API de Google Maps
- Una cuenta gratuita de MongoDB Atlas

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Google Maps
1. Ingrese a `https://console.cloud.google.com/apis/credentials`
2. Cree un proyecto nuevo o use uno existente
3. Habilite la `Maps JavaScript API`
4. Cree una API Key
5. Configure `GOOGLE_MAPS_API_KEY`

### 4. Configurar MongoDB Atlas gratis
MongoDB Atlas sí es una buena opción gratuita para este proyecto. El plan free tier suele ser suficiente para un sistema comunitario pequeño o mediano.

Pasos recomendados:
1. Cree una cuenta en `https://www.mongodb.com/atlas`
2. Cree un cluster gratuito `M0`
3. Cree un usuario de base de datos
4. En `Network Access`, autorice su IP actual o `0.0.0.0/0` solo si está probando temporalmente
5. Copie el connection string

Ejemplo de `.env`:
```env
GOOGLE_MAPS_API_KEY=TU_CLAVE_AQUI
MONGODB_URI=mongodb+srv://USUARIO:CLAVE@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
MONGODB_DB_NAME=agua_aserri
MONGODB_COLLECTION=reportes
```

Importante:
- No suba `.env` al repositorio
- Restrinja la API key de Google Maps por dominio/IP
- En producción, use una IP permitida específica en Atlas siempre que sea posible

### 5. Iniciar el servidor
```bash
npm start
```

Abra `http://localhost:3000`

## Estructura del proyecto

```text
files/
|-- server.js
|-- package.json
|-- public/
|   |-- index.html
|   |-- css/
|   |   '-- styles.css
|   '-- js/
|       '-- app.js
```

La persistencia activa ahora se realiza en MongoDB Atlas.

## Funcionalidades
- Nuevo reporte con identificación, zona, horas, comentario y ubicación
- Visualización de reportes recientes en mapa
- Lista cronológica de actividad reciente
- Estadísticas generales y zona con más incidencia
- Protección básica con rate limiting, validaciones y enmascaramiento de identidad

## API REST

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/reportes` | Crear nuevo reporte |
| `GET` | `/api/reportes` | Reportes de las últimas 24 horas |
| `GET` | `/api/reportes/todos` | Deshabilitado por seguridad |
| `GET` | `/api/stats` | Estadísticas generales |

### Ejemplo de reporte
```json
{
  "identificacion": "Juan Perez",
  "zona": "Centro de Aserrí",
  "hora_llego": "06:30",
  "hora_se_fue": "09:15",
  "comentario": "Llego con poca presion",
  "latitud": 9.8608,
  "longitud": -84.1040
}
```

## Seguridad aplicada
- Límite de frecuencia en envíos
- Validación de tamaño y formato de datos
- Identificación pública enmascarada
- Cabeceras HTTP defensivas
- Clave de Google Maps expuesta solo desde el servidor
