# Resumen de Implementación - API INEI Puntos de Delitos

## ✅ Archivos Creados

### Utilidades (Backend)
- **`src/utils/inei-crime-db.js`** - Manejo de base de datos SQLite con funciones para:
  - Inicializar base de datos
  - Insertar/actualizar puntos de delitos (con protección anti-duplicados)
  - Consultar con filtros (departamento, provincia, distrito, tipo de delito, bounding box)
  - Obtener estadísticas
  - Obtener tipos de delitos

- **`src/utils/inei-crime-scraper.js`** - Scraper para ArcGIS del INEI con:
  - Consulta al servicio ArcGIS del INEI
  - Conversión de coordenadas Web Mercator a WGS84
  - Filtros por departamento, tipo de delito, área geográfica
  - Manejo de errores y timeouts

### Rutas API
- **`src/routes/v2/peru/inei/index.js`** - Ruta principal del módulo INEI
- **`src/routes/v2/peru/inei/crime/index.js`** - Endpoints de delitos:
  - `GET /v2/peru/inei/crime` - Lista de puntos con filtros
  - `GET /v2/peru/inei/crime/stats` - Estadísticas generales
  - `GET /v2/peru/inei/crime/types` - Tipos de delitos
  - `GET /v2/peru/inei/crime/heatmap` - Datos para mapas de calor
  - `GET /v2/peru/inei/crime/by-location` - Delitos por ubicación

### Scripts
- **`update-crime-data.js`** - Script para actualizar datos desde el INEI
- **`examples/inei-crime-examples.js`** - 8 ejemplos de uso de la API

### Documentación
- **`docs/API_INEI_CRIME.md`** - Documentación completa de la API
- **`docs/INEI_SETUP.md`** - Guía de instalación y configuración

### Configuración
- **`.env.example`** - Variables de entorno actualizadas
- **`package.json`** - Scripts npm agregados:
  - `npm run update:crime` - Actualizar datos de delitos
  - `npm run examples:crime` - Ejecutar ejemplos

## 🔑 Características Principales

### Sistema Anti-Duplicados
El sistema usa un índice único compuesto por:
- Longitud + Latitud + Tipo de delito + UBIGEO + Núcleo urbano

Esto previene duplicados incluso cuando el `OBJECTID` del servicio ArcGIS cambia entre consultas.

### Filtros Disponibles
- ✅ Por departamento, provincia, distrito
- ✅ Por código UBIGEO
- ✅ Por tipo de delito
- ✅ Por área geográfica (bounding box)
- ✅ Paginación (limit/offset)

### Endpoints Especiales
- **Heatmap**: Datos optimizados para mapas de calor (hasta 5000 puntos)
- **Stats**: Estadísticas agregadas con top tipos de delitos
- **By-location**: Consulta jerárquica por ubicación

## 📦 Instalación

```bash
# 1. Verificar configuración de MySQL en .env
# Ya configurado por defecto

# 2. Inicializar y poblar la base de datos
npm run update:crime

# 3. Iniciar API
npm start
```

## 🚀 Uso Rápido

```bash
# Actualizar datos de delitos
npm run update:crime

# Solo Lima (default)
npm run update:crime

# Varios departamentos
INEI_DEPARTMENTS=15,16,17 npm run update:crime

# Todos los departamentos
INEI_DEPARTMENTS=* npm run update:crime

# Ver ejemplos
npm run examples:crime
```

## 🔧 Comandos Disponibles

```bash
# Actualización de datos
npm run update:crime          # Actualizar datos de delitos INEI
npm run update:earthquakes    # Actualizar datos de sismos IGP

# Ejemplos
npm run examples:crime        # Ejemplos de uso de API de delitos
npm run examples:bomberos     # Ejemplos de API de bomberos

# Desarrollo
npm start                     # Iniciar API (producción)
npm run dev                   # Iniciar API (desarrollo con nodemon)
```

## 📊 Ejemplo de Respuesta

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
      "created_at": "2026-02-25 12:00:00"
    }
  ],
  "pagination": {
    "total": 1234,
    "limit": 100,
    "offset": 0,
    "returned": 100
  }
}
```

## 🗺️ Códigos de Departamento

| Código | Departamento | Código | Departamento |
|--------|-------------|--------|-------------|
| 01 | Amazonas | 14 | Lambayeque |
| 02 | Áncash | 15 | Lima |
| 03 | Apurímac | 16 | Loreto |
| 04 | Arequipa | 17 | Madre de Dios |
| 05 | Ayacucho | 18 | Moquegua |
| 06 | Cajamarca | 19 | Pasco |
| 07 | Callao | 20 | Piura |
| 08 | Cusco | 21 | Puno |
| 09 | Huancavelica | 22 | San Martín |
| 10 | Huánuco | 23 | Tacna |
| 11 | Ica | 24 | Tumbes |
| 12 | Junín | 25 | Ucayali |
| 13 | La Libertad | | |

## 📝 Variables de Entorno

```env
# Departamentos a consultar (default: "15" - Lima)
INEI_DEPARTMENTS=15

# Para varios departamentos
INEI_DEPARTMENTS=15,16,17

# Para todos los departamentos
INEI_DEPARTMENTS=*
```

## 🔄 Actualización Periódica

Se recomienda actualizar cada 3 días (el INEI no actualiza con mucha frecuencia).

**Cron job ejemplo:**
```bash
0 3 */3 * * cd /ruta/al/proyecto && npm run update:crime
```

## 🎯 Próximos Pasos

1. Ejecutar actualización: `npm run update:crime`
2. Iniciar API: `npm start`
3. Probar endpoints: `http://localhost:3000/v2/peru/inei/crime`
4. Ver ejemplos: `npm run examples:crime`

## 📚 Documentación

- [Documentación completa de la API](docs/API_INEI_CRIME.md)
- [Guía de instalación](docs/INEI_SETUP.md)
- [Ejemplos de uso](examples/inei-crime-examples.js)

## ⚠️ Notas Importantes

- La base de datos MySQL es compartida con otros módulos (IGP, INDECI, etc.)
- La tabla `crime_points` se crea automáticamente al ejecutar el script
- El sistema evita automáticamente duplicados
- Las coordenadas se convierten automáticamente a WGS84
- Límite máximo por consulta: 1000 registros
- Timeout de conexión al INEI: 30 segundos

## 🐛 Troubleshooting

**Base de datos vacía:**
```bash
npm run update:crime
```

**Error de conexión:**
Verifica las credenciales de MySQL en el archivo `.env`

**No se obtienen datos:**
- Verificar conexión a internet
- El servicio del INEI puede estar temporalmente inaccesible
- Intentar con un departamento específico: `INEI_DEPARTMENTS=15 npm run update:crime`
