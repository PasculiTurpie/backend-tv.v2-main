# Backend TV v2 API

API de Node.js + Express + Mongoose para la plataforma TV. Todas las rutas están namespaced bajo `http://localhost:3000/api/v1` y la integración con Titans se realiza mediante endpoints propios del backend (sin proxy en el cliente).

## Requisitos

- Node.js 18+
- MongoDB (local o Atlas)

## Variables de entorno

Crea un archivo `.env` en la raíz del backend (ya existe un ejemplo con valores por defecto) con al menos las siguientes variables:

```bash
PORT=3000
# Puedes entregar una URI lista...
MONGODB_URI=mongodb://localhost:27017/signalTV
# ...o bien definir los fragmentos para construirla automáticamente
# MONGODB_HOST=localhost
# MONGODB_PORT=27017
# MONGODB_DATABASE=signalTV
# MONGODB_USERNAME=
# MONGODB_PASSWORD=
# MONGODB_AUTH_SOURCE=admin
# MONGODB_OPTIONS=retryWrites=true&w=majority
# Para desarrollo local puedes definir una URI alternativa que se usará si la principal falla
# MONGODB_LOCAL_URI=mongodb://127.0.0.1:27017/signalTV
TITAN_USERNAME=Operator
TITAN_PASSWORD=titan
TITAN_DEFAULT_PROTOCOL=http
TITAN_DEFAULT_PATH=/api/v1/servicesmngt/services
TITAN_TIMEOUT_MS=8000
# Establece en true sólo si necesitas ignorar certificados TLS self-signed
TITAN_ALLOW_INSECURE_TLS=false
```

## Instalación y arranque

```bash
npm install
npm run dev # nodemon
# o
npm start
```

El backend intentará construir la cadena de conexión usando `MONGODB_URI` o, si no está disponible,
los fragmentos `MONGODB_HOST`, `MONGODB_DATABASE`, etc. La cadena que se usa se muestra (sin credenciales)
en la consola para facilitar la depuración. Si la conexión principal falla y estás en modo desarrollo,
se intentará automáticamente con `MONGODB_LOCAL_URI` (o `mongodb://127.0.0.1:27017/signalTV`).

El servidor sólo comienza a escuchar una vez que la conexión a MongoDB se establece correctamente.

## Endpoints principales (`/api/v1`)

| Recurso        | Endpoint base              |
|----------------|----------------------------|
| Auth           | `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Users          | `/users`                    |
| Channels       | `/channels`                 |
| IRDs           | `/irds`                     |
| Satellites     | `/satellites`               |
| Polarizations  | `/polarizations`            |
| Contacts       | `/contacts`                 |
| Signals        | `/signals`                  |
| Tecnologías    | `/tipo-tech`                |
| Equipos        | `/equipos`, `/tipo-equipo`  |
| Auditoría      | `/audits`                   |
| Titans         | `/titans/services`, `/titans/services/multi` |
| Salud del API  | `/health`                   |

## Titans API

Los endpoints Titans realizan las peticiones a los equipos Titans desde el backend para evitar CORS y exponer credenciales.

### Obtener servicios de un host

```bash
curl "http://localhost:3000/api/v1/titans/services?host=172.19.14.118&path=/api/v1/servicesmngt/services"
```

También puedes proporcionar la URL completa del Titan (incluyendo protocolo) mediante el parámetro `url`:

```bash
curl "http://localhost:3000/api/v1/titans/services?url=http://172.19.14.118/api/v1/servicesmngt/services"
```

### Obtener servicios de múltiples hosts

```bash
curl "http://localhost:3000/api/v1/titans/services/multi?hosts=172.19.14.109,172.19.14.112&path=/api/v1/servicesmngt/services"
```

Respuesta típica:

```json
[
  {
    "host": "172.19.14.109",
    "ok": true,
    "status": 200,
    "data": { "services": [] }
  },
  {
    "host": "172.19.14.112",
    "ok": false,
    "status": 504,
    "error": { "message": "Titan request timed out" }
  }
]
```

## Notas

- CORS está habilitado para `http://localhost:5173` (frontend Vite) con `credentials: true`.
- La conexión a MongoDB se gestiona en `src/config/config.mongoose.js`; el servidor Express se levanta sólo tras un `connect` exitoso.
- No existen rutas `/proxy`; toda la funcionalidad Titans está bajo `/api/v1/titans`.
