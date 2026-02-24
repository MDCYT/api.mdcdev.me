# 🔥 Sistema de API de Incidentes de Bomberos - Implementación Completada

## ✅ Archivos Creados

### 📂 Utilidades
- `src/utils/bomberos-db.js` - Conexión y operaciones con MariaDB
- `src/utils/bomberos-scraper.js` - Scraping de datos de bomberos con proxies
- `src/utils/proxy-manager.js` - Gestión automática de proxies rotativos

### 📂 Rutas
- `src/routes/v2/peru/index.js` - Índice del módulo Perú
- `src/routes/v2/peru/bomberos/index.js` - Índice de bomberos
- `src/routes/v2/peru/bomberos/incidentes/index.js` - Endpoints de incidentes

### 📂 Documentación y Tests
- `docs/API_BOMBEROS.md` - Documentación completa de la API
- `test-bomberos-setup.js` - Script de pruebas del sistema

### 📂 Configuración
- `.env` - Variables de entorno (credenciales de BD, URLs, configuración)

---

## 🚀 Características Implementadas

### ✅ Base de Datos
- Conexión a MariaDB con pool de conexiones
- Credenciales en `.env` (seguras)
- Operaciones UPSERT para evitar duplicados
- Queries optimizadas por rango de fechas
- Soporte para búsqueda por distrito

### ✅ Sistema de Proxies
- Obtención automática desde ProxyScrape API
- Actualización cada **1 hora** (configurable)
- Caché en RAM (100 proxies activos)
- Filtrado por velocidad y disponibilidad
- Rotación automática en caso de fallos

### ✅ Scraping
- Parseo de HTML de la web oficial de bomberos
- Sistema de reintentos con proxies rotativos (hasta 5 intentos)
- Extracción de coordenadas GPS
- Conversión de fechas formato Perú (UTC-5)
- Extracción de distritos

### ✅ Actualizaciones Automáticas
- Cada **30 minutos** (configurable)
- Sin intervención manual (evita captchas)
- Guardar en BD como caché
- Estado visible en `/status`

### ✅ API REST
- **Default**: Últimas 24 horas
- **Filtros flexibles**: hasta 30 días de historial
- **Por distrito**: búsqueda específica
- **Status endpoint**: monitoreo del sistema
- Respuestas JSON estandarizadas

---

## 📡 Endpoints Disponibles

```
GET  /v2/peru/bomberos/incidentes
     → Parámetros: rango=horas|dias, cantidad=N
     → Default: últimas 24 horas

GET  /v2/peru/bomberos/incidentes/distrito/:distrito
     → Buscar por distrito específico

GET  /v2/peru/bomberos/incidentes/status
     → Estado del sistema (actualizaciones, proxies, BD)

POST /v2/peru/bomberos/incidentes/actualizar
     → Deshabilitado (retorna error 429 con mensaje)
```

---

## ⚙️ Variables de Entorno (.env)

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

# Intervalos
PROXY_UPDATE_INTERVAL=3600000       # 1 hora
BOMBEROS_UPDATE_INTERVAL=1800000    # 30 minutos

# Límites
BOMBEROS_DEFAULT_RANGE_HOURS=24
BOMBEROS_MAX_RANGE_DAYS=30
BOMBEROS_MAX_RETRIES=5
```

---

## 🧪 Pruebas

### Ejecutar pruebas del sistema
```bash
npm run test:bomberos
```

### Resultado esperado:
```
✅ Conexión exitosa a MariaDB
✅ Se obtuvieron 100 proxies
🎉 Todas las pruebas completadas!
```

---

## 📊 Estructura de Datos

### Tabla: `bomberos_incidentes`
```sql
CREATE TABLE bomberos_incidentes (
  id VARCHAR(20) PRIMARY KEY NOT NULL,
  report_number VARCHAR(20) NOT NULL,
  type TEXT NOT NULL,
  district VARCHAR(100) NOT NULL,
  location TEXT NOT NULL,
  occurred_at DATETIME,
  latitude DOUBLE,
  longitude DOUBLE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Ejemplo de Respuesta JSON
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
  "timestamp": "2026-02-24T10:30:00.000Z"
}
```

---

## 🎯 Ejemplos de Uso

### cURL
```bash
# Últimas 24 horas (default)
curl https://api.mdcdev.me/v2/peru/bomberos/incidentes

# Últimos 7 días
curl "https://api.mdcdev.me/v2/peru/bomberos/incidentes?rango=dias&cantidad=7"

# Distrito de Lima
curl https://api.mdcdev.me/v2/peru/bomberos/incidentes/distrito/Lima

# Estado del sistema
curl https://api.mdcdev.me/v2/peru/bomberos/incidentes/status
```

### JavaScript
```javascript
const response = await fetch('https://api.mdcdev.me/v2/peru/bomberos/incidentes?rango=dias&cantidad=7');
const data = await response.json();
console.log(`Total: ${data.count} incidentes`);
```

### Python
```python
import requests
response = requests.get('https://api.mdcdev.me/v2/peru/bomberos/incidentes', 
                       params={'rango': 'dias', 'cantidad': 7})
data = response.json()
print(f"Total: {data['count']} incidentes")
```

---

## 🔄 Flujo de Funcionamiento

```
┌──────────────────┐
│  Inicio del App  │
└────────┬─────────┘
         │
         ├─→ Inicia Proxy Manager (cada 1 hora)
         │   └─→ Obtiene 100 proxies de ProxyScrape
         │
         └─→ Inicia Actualizador (cada 30 min)
             └─→ Scraping con proxies rotativos
                 └─→ Parsea HTML
                     └─→ Guarda en MariaDB (UPSERT)
                         └─→ Logs de estado
```

---

## 📝 Notas Importantes

1. **Actualización Manual Deshabilitada**: El endpoint POST `/actualizar` está deshabilitado intencionalmente para evitar captchas de la API de Bomberos.

2. **Proxies Rotativos**: Se usarán automáticamente después del primer intento fallido de conexión directa.

3. **Caché en BD**: Si la API de Bomberos no responde, el sistema sirve datos desde la base de datos (pueden estar ligeramente desactualizados).

4. **Límites**: Máximo 30 días de historial para mantener rendimiento óptimo.

5. **Zona Horaria**: Todas las fechas están en formato ISO 8601 (UTC), pero el parseo se hace desde hora de Perú (UTC-5).

---

## 🚧 Próximos Pasos (Opcionales)

- [ ] Agregar índices a la BD para mejorar rendimiento
- [ ] Implementar rate limiting por IP
- [ ] Agregar estadísticas de tipos de incidentes
- [ ] Crear webhooks para notificaciones en tiempo real
- [ ] Dashboard visual con mapas

---

## 📚 Documentación Adicional

Ver `docs/API_BOMBEROS.md` para documentación completa con más ejemplos y detalles técnicos.

---

✅ **Sistema completamente funcional y listo para producción**
