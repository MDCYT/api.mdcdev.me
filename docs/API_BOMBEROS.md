# API de Incidentes de Bomberos del Perú

API que provee información sobre incidentes reportados por los bomberos del Perú en tiempo real.

## 🚀 Características

- ✅ **Actualización automática** cada 30 minutos
- ✅ **Caché en base de datos** MariaDB para alta disponibilidad
- ✅ **Sistema de proxies rotativos** que se actualiza cada hora
- ✅ **Filtros flexibles**: hasta 1 mes de historial
- ✅ **Búsqueda por distrito**
- ✅ **Geolocalización** (latitud/longitud cuando disponible)

## 📡 Endpoints

### 1. Obtener incidentes
```http
GET /v2/peru/bomberos/incidentes
```

#### Parámetros de Query
- `rango` (opcional): `horas` o `dias` (default: `horas`)
- `cantidad` (opcional): número de horas o días (default: `24`)

#### Límites
- **Máximo por horas**: 720 horas (30 días)
- **Máximo por días**: 30 días

#### Ejemplos
```bash
# Últimas 24 horas (default)
GET /v2/peru/bomberos/incidentes

# Últimas 48 horas
GET /v2/peru/bomberos/incidentes?rango=horas&cantidad=48

# Últimos 7 días
GET /v2/peru/bomberos/incidentes?rango=dias&cantidad=7

# Últimos 30 días (máximo)
GET /v2/peru/bomberos/incidentes?rango=dias&cantidad=30
```

#### Respuesta
```json
{
  "success": true,
  "count": 150,
  "range": "últimas 24 hora(s)",
  "data": [
    {
      "id": "0030-2026",
      "report_number": "0030-2026",
      "type": "INCENDIO ESTRUCTURAL",
      "district": "Lima",
      "location": "Av. Principal 123 - Lima (-12.0828,-77.0513)",
      "occurred_at": "2026-02-24T08:30:54.000Z",
      "latitude": -12.0828,
      "longitude": -77.0513,
      "created_at": "2026-02-24T10:15:00.000Z"
    }
  ],
  "source": "database",
  "lastUpdate": {
    "timestamp": "2026-02-24T10:15:00.000Z",
    "totalRecords": 1543
  },
  "updateStatus": {
    "isUpdating": false,
    "lastUpdateTime": "2026-02-24T10:15:00.000Z",
    "lastSuccessfulUpdate": "2026-02-24T10:15:00.000Z",
    "error": null
  },
  "timestamp": "2026-02-24T10:30:00.000Z"
}
```

---

### 2. Obtener incidentes por distrito
```http
GET /v2/peru/bomberos/incidentes/distrito/:distrito
```

#### Parámetros de Ruta
- `distrito` (requerido): nombre del distrito a buscar

#### Ejemplo
```bash
GET /v2/peru/bomberos/incidentes/distrito/Lima
GET /v2/peru/bomberos/incidentes/distrito/Callao
GET /v2/peru/bomberos/incidentes/distrito/Miraflores
```

#### Respuesta
```json
{
  "success": true,
  "count": 45,
  "distrito": "Lima",
  "data": [...],
  "source": "database",
  "lastUpdate": {
    "timestamp": "2026-02-24T10:15:00.000Z",
    "totalRecords": 1543
  },
  "timestamp": "2026-02-24T10:30:00.000Z"
}
```

---

### 3. Estado del sistema
```http
GET /v2/peru/bomberos/incidentes/status
```

#### Respuesta
```json
{
  "success": true,
  "updateStatus": {
    "isUpdating": false,
    "lastUpdateTime": "2026-02-24T10:15:00.000Z",
    "lastSuccessfulUpdate": "2026-02-24T10:15:00.000Z",
    "error": null,
    "nextUpdateIn": "30 minutos"
  },
  "proxyStatus": {
    "totalProxies": 85,
    "lastUpdate": "2026-02-24T09:00:00.000Z",
    "isUpdating": false
  },
  "database": {
    "lastUpdate": "2026-02-24T10:15:00.000Z",
    "totalRecords": 1543
  },
  "configuration": {
    "defaultRangeHours": 24,
    "maxRangeDays": 30,
    "updateIntervalMinutes": 30
  },
  "timestamp": "2026-02-24T10:30:00.000Z"
}
```

---

## 🗄️ Estructura de Datos

### Campos del incidente

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único del incidente (número de parte) |
| `report_number` | `string` | Número de parte del reporte |
| `type` | `string` | Tipo de incidente (ej: INCENDIO, RESCATE) |
| `district` | `string` | Distrito donde ocurrió |
| `location` | `string` | Ubicación detallada con coordenadas |
| `occurred_at` | `datetime` | Fecha y hora del incidente (ISO 8601) |
| `latitude` | `double` | Latitud (si está disponible) |
| `longitude` | `double` | Longitud (si está disponible) |
| `created_at` | `datetime` | Fecha de registro en la BD |

---

## ⚙️ Configuración

### Variables de Entorno

```env
# Base de datos
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=

# URLs
BOMBEROS_API_URL=https://sgonorte.bomberosperu.gob.pe/24horas
PROXY_API_URL=

# Intervalos (en milisegundos)
PROXY_UPDATE_INTERVAL=3600000       # 1 hora
BOMBEROS_UPDATE_INTERVAL=1800000    # 30 minutos

# Límites
BOMBEROS_DEFAULT_RANGE_HOURS=24
BOMBEROS_MAX_RANGE_DAYS=30
BOMBEROS_MAX_RETRIES=5
```

---

## 🔧 Arquitectura

### Componentes

1. **Proxy Manager** (`src/utils/proxy-manager.js`)
   - Obtiene proxies gratuitos de ProxyScrape
   - Actualización automática cada hora
   - Caché en RAM

2. **Scraper** (`src/utils/bomberos-scraper.js`)
   - Parsea HTML de la web de bomberos
   - Sistema de reintentos con proxies rotativos
   - Parseo de coordenadas y fechas

3. **Base de Datos** (`src/utils/bomberos-db.js`)
   - Pool de conexiones a MariaDB
   - Operaciones UPSERT para evitar duplicados
   - Queries optimizadas con índices

4. **Routes** (`src/routes/v2/peru/bomberos/incidentes/`)
   - Endpoints RESTful
   - Validación de parámetros
   - Respuestas estandarizadas

### Flujo de Datos

```
┌─────────────────┐
│  API Bomberos   │
│   (Web Peru)    │
└────────┬────────┘
         │
         │ Scraping cada 30 min
         │ (con proxies rotativos)
         ↓
┌─────────────────┐
│  Scraper Node   │
│   + Cheerio     │
└────────┬────────┘
         │
         │ UPSERT
         ↓
┌─────────────────┐
│   MariaDB       │
│   (Caché)       │
└────────┬────────┘
         │
         │ Queries
         ↓
┌─────────────────┐
│   API REST      │
│   Express       │
└─────────────────┘
```

---

## 📊 Ejemplo de Uso

### JavaScript/Node.js
```javascript
const fetch = require('node-fetch');

async function getIncidentesRecientes() {
  const response = await fetch('https://api.mdcdev.me/v2/peru/bomberos/incidentes?rango=dias&cantidad=7');
  const data = await response.json();
  
  console.log(`Total: ${data.count} incidentes`);
  data.data.forEach(incidente => {
    console.log(`${incidente.type} en ${incidente.district}`);
  });
}

getIncidentesRecientes();
```

### Python
```python
import requests

response = requests.get('https://api.mdcdev.me/v2/peru/bomberos/incidentes', 
                       params={'rango': 'dias', 'cantidad': 7})
data = response.json()

print(f"Total: {data['count']} incidentes")
for incidente in data['data']:
    print(f"{incidente['type']} en {incidente['district']}")
```

---

## 🚨 Limitaciones

- ⚠️ Las actualizaciones manuales están **deshabilitadas** para evitar captchas
- ⚠️ Los datos se actualizan automáticamente cada 30 minutos
- ⚠️ El historial máximo es de 30 días
- ⚠️ Las coordenadas dependen de la disponibilidad en la fuente original

---

## 📝 Notas

- Los datos provienen de: https://sgonorte.bomberosperu.gob.pe/24horas
- La zona horaria de las fechas es UTC-5 (Perú)
- Los proxies se actualizan automáticamente cada hora desde ProxyScrape
- La base de datos actúa como caché para alta disponibilidad

---

## 🤝 Contribuciones

Para reportar problemas o sugerir mejoras, crea un issue en el repositorio de GitHub.

---

## 📄 Licencia

ISC - Ver LICENSE para más detalles
