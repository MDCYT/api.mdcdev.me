# API INEI - Puntos de Delitos

API para consultar puntos de delitos registrados por el INEI (Instituto Nacional de Estadística e Informática) del Perú.

## Características

- 🗺️ Consulta de puntos de delitos por ubicación geográfica
- 📊 Estadísticas de delitos por tipo y región
- 🔍 Filtrado por departamento, provincia, distrito y UBIGEO
- 🗺️ Datos preparados para mapas de calor (heatmap)
- 🔄 Sistema de actualización automática que evita duplicados
- 💾 Base de datos MySQL para consultas rápidas (comparte infraestructura con otros módulos)

## Endpoints

### Base URL
```
/v2/peru/inei/crime
```

### 1. Obtener puntos de delitos
```
GET /v2/peru/inei/crime
```

**Query Parameters:**
- `limit` (opcional, default: 100, max: 1000): Límite de resultados
- `offset` (opcional, default: 0): Offset para paginación
- `crime_type` (opcional): Filtrar por tipo de delito (ej: "ROBO AGRAVADO")
- `dept_code` (opcional): Código de departamento (ej: "15" para Lima)
- `prov_code` (opcional): Código de provincia
- `dist_code` (opcional): Código de distrito
- `ubigeo` (opcional): Código UBIGEO completo
- `min_lat`, `max_lat`, `min_lon`, `max_lon` (opcional): Bounding box para filtrar por área

**Ejemplo:**
```
GET /v2/peru/inei/crime?dept_code=15&limit=50&crime_type=ROBO
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "source_id": 7091,
      "ubigeo_code": "150101",
      "longitude": -77.032017,
      "latitude": -12.056893,
      "crime_type": "ROBO AGRAVADO",
      "dept_code": "15",
      "dept_name": "LIMA",
      "prov_code": "01",
      "prov_name": "LIMA",
      "dist_code": "01",
      "dist_name": "LIMA",
      "capital_name": "LIMA",
      "urban_nucleus": "URB. LIMA CENTRO",
      "influence_zone": "",
      "created_at": "2026-02-25 12:00:00",
      "updated_at": "2026-02-25 12:00:00"
    }
  ],
  "pagination": {
    "total": 1234,
    "limit": 50,
    "offset": 0,
    "returned": 50
  },
  "filters": {
    "crime_type": "ROBO",
    "dept_code": "15",
    "prov_code": null,
    "dist_code": null,
    "ubigeo": null,
    "bbox": null
  }
}
```

### 2. Obtener estadísticas
```
GET /v2/peru/inei/crime/stats
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "total_points": 10523,
    "total_crime_types": 15,
    "total_departments": 8,
    "total_locations": 234,
    "oldest_record": "2026-01-01 00:00:00",
    "newest_record": "2026-02-25 12:00:00",
    "top_crime_types": [
      {
        "crime_type": "ROBO AGRAVADO",
        "count": 5234
      },
      {
        "crime_type": "HURTO SIMPLE",
        "count": 3421
      }
    ]
  }
}
```

### 3. Obtener tipos de delitos
```
GET /v2/peru/inei/crime/types
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "crime_type": "ROBO AGRAVADO",
      "count": 5234
    },
    {
      "crime_type": "HURTO SIMPLE",
      "count": 3421
    }
  ],
  "total": 15
}
```

### 4. Obtener datos para mapa de calor
```
GET /v2/peru/inei/crime/heatmap
```

**Query Parameters:**
- `crime_type` (opcional): Filtrar por tipo de delito
- `dept_code` (opcional): Código de departamento

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "lat": -12.056893,
      "lon": -77.032017,
      "type": "ROBO AGRAVADO",
      "intensity": 1
    }
  ],
  "total": 5000,
  "filters": {
    "crime_type": null,
    "dept_code": "15"
  }
}
```

### 5. Obtener delitos por ubicación
```
GET /v2/peru/inei/crime/by-location?dept_code=15
```

**Query Parameters:**
- `dept_code` (requerido): Código de departamento
- `prov_code` (opcional): Código de provincia
- `dist_code` (opcional): Código de distrito
- `limit` (opcional, default: 100, max: 1000): Límite de resultados

**Respuesta:**
```json
{
  "success": true,
  "data": [...],
  "total": 8543,
  "location": {
    "dept_code": "15",
    "prov_code": null,
    "dist_code": null
  }
}
```

## Actualización de datos

### Script de actualización
Para actualizar los datos de delitos desde el INEI:

```bash
node update-crime-data.js
```

**Variables de entorno:**
- `INEI_DEPARTMENTS`: Códigos de departamentos a consultar, separados por coma (ej: "15,16,17")
  - Usa `*` para obtener todos los departamentos
  - Default: "15" (solo Lima)

**Ejemplo:**
```bash
# Solo Lima (default)
node update-crime-data.js

# Varios departamentos
INEI_DEPARTMENTS=15,16,17 node update-crime-data.js

# Todos los departamentos
INEI_DEPARTMENTS=* node update-crime-data.js
```

### Frecuencia recomendada
Se recomienda actualizar los datos cada 3 días, ya que el INEI no actualiza la información con mucha frecuencia.

### Sistema anti-duplicados
El sistema utiliza un índice único compuesto por:
- Longitud
- Latitud
- Tipo de delito
- Código UBIGEO
- Núcleo urbano

Esto previene duplicados incluso cuando el `OBJECTID` del servicio ArcGIS cambia entre consultas.

## Códigos de Departamento del Perú

| Código | Departamento |
|--------|-------------|
| 01 | Amazonas |
| 02 | Áncash |
| 03 | Apurímac |
| 04 | Arequipa |
| 05 | Ayacucho |
| 06 | Cajamarca |
| 07 | Callao |
| 08 | Cusco |
| 09 | Huancavelica |
| 10 | Huánuco |
| 11 | Ica |
| 12 | Junín |
| 13 | La Libertad |
| 14 | Lambayeque |
| 15 | Lima |
| 16 | Loreto |
| 17 | Madre de Dios |
| 18 | Moquegua |
| 19 | Pasco |
| 20 | Piura |
| 21 | Puno |
| 22 | San Martín |
| 23 | Tacna |
| 24 | Tumbes |
| 25 | Ucayali |

## Fuente de datos

Los datos provienen del servicio ArcGIS del INEI:
```
https://arcgis3.inei.gob.pe:6443/arcgis/rest/services/Datacrim/DATACRIM005_AGS_PUNTOSDELITOS_CIUDADANO/MapServer
```

## Ejemplos de uso

### JavaScript/Node.js
```javascript
// Obtener delitos en Lima
const response = await fetch('https://api.mdcdev.me/v2/peru/inei/crime?dept_code=15&limit=100');
const data = await response.json();
console.log(`Se encontraron ${data.total} delitos en Lima`);

// Obtener robos específicamente
const robos = await fetch('https://api.mdcdev.me/v2/peru/inei/crime?crime_type=ROBO&dept_code=15');
const robosData = await robos.json();

// Obtener datos para heatmap
const heatmap = await fetch('https://api.mdcdev.me/v2/peru/inei/crime/heatmap?dept_code=15');
const heatmapData = await heatmap.json();
```

### Python
```python
import requests

# Obtener estadísticas
response = requests.get('https://api.mdcdev.me/v2/peru/inei/crime/stats')
stats = response.json()
print(f"Total de delitos registrados: {stats['data']['total_points']}")

# Obtener delitos en un área específica (bounding box)
params = {
    'min_lat': -12.1,
    'max_lat': -12.0,
    'min_lon': -77.1,
    'max_lon': -77.0,
    'limit': 500
}
response = requests.get('https://api.mdcdev.me/v2/peru/inei/crime', params=params)
crimes = response.json()
```

## Notas técnicas

- **Base de datos**: MySQL/MariaDB (comparte la configuración con el módulo IGP)
- **Límite máximo de resultados por consulta**: 1000
- **Sistema de coordenadas**: WGS84 (EPSG:4326)
- **Conversión automática**: Las coordenadas en Web Mercator se convierten automáticamente a WGS84
- **Tabla**: `crime_points` (se crea automáticamente al ejecutar el script de actualización)

## Troubleshooting

### Error de conexión a la base de datos
Verifica tus credenciales de MySQL en el archivo `.env`

### La base de datos está vacía
Ejecuta el script de actualización:
```bash
node update-crime-data.js
```

### No se obtienen datos del INEI
- Verifica tu conexión a internet
- El servicio del INEI puede estar temporalmente inaccesible
- Intenta con un departamento específico: `INEI_DEPARTMENTS=15 node update-crime-data.js`
