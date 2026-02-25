# Instalación del Módulo INEI - Puntos de Delitos

## Configuración

Este módulo usa la base de datos MySQL ya configurada en el proyecto (la misma que usan los sismos del IGP).

## Pasos de instalación

### 1. Verificar configuración de base de datos

Asegúrate de que tu archivo `.env` tenga las credenciales de MySQL:
```env
DB_HOST=tu-host
DB_PORT=3306
DB_USER=tu-usuario
DB_PASSWORD=tu-contraseña
DB_NAME=tu-base-de-datos
```

### 2. Inicializar y poblar la base de datos
```bash
node update-crime-data.js
```

Este comando:
- Creará la base de datos SQLite en `src/data/inei-crime.db`
- Descargará los datos de delitos del INEI
- Almacenará los datos evitando duplicados

### 3. Configurar departamentos (opcional)

Por defecto, solo se descarga información de Lima (código 15). Para obtener datos de otros departamentos:

```bash
# Varios departamentos específicos
INEI_DEPARTMENTS=15,16,17 node update-crime-data.js

# Todos los departamentos
INEI_DEPARTMENTS=* node update-crime-data.js
```

### 4. Iniciar la API

```bash
npm start
# o para desarrollo
npm run dev
```

## Endpoints disponibles

Una vez iniciada la API, los siguientes endpoints estarán disponibles:

- `GET /v2/peru/inei` - Información del módulo
- `GET /v2/peru/inei/crime` - Lista de puntos de delitos
- `GET /v2/peru/inei/crime/stats` - Estadísticas
- `GET /v2/peru/inei/crime/types` - Tipos de delitos
- `GET /v2/peru/inei/crime/heatmap` - Datos para mapa de calor
- `GET /v2/peru/inei/crime/by-location` - Delitos por ubicación

## Actualización periódica

Se recomienda actualizar los datos cada 3 días:

```bash
node update-crime-data.js
```

O configurar un cron job:

```bash
# Actualizar cada 3 días a las 3 AM
0 3 */3 * * cd /ruta/al/proyecto && node update-crime-data.js
```

## Verificación

Para verificar que todo funciona correctamente:

1. **Ver información del módulo:**
   ```
   GET http://localhost:3000/v2/peru/inei
   ```

2. **Obtener estadísticas:**
   ```
   GET http://localhost:3000/v2/peru/inei/crime/stats
   ```

3. **Obtener primeros 10 delitos:**
   ```
   GET http://localhost:3000/v2/peru/inei/crime?limit=10
   ```

## Documentación completa

Para más detalles, consulta [API_INEI_CRIME.md](./API_INEI_CRIME.md)

## Troubleshooting

### Error de conexión a MySQL
**Solución:** Verifica las credenciales en el archivo `.env`

### La base de datos está vacía
**Solución:** Ejecuta el script de actualización
```bash
node update-crime-data.js
```

### La tabla no se crea
**Solución:** Ejecuta el script de actualización que inicializa automáticamente la tabla
```bash
node update-crime-data.js
```

### No se obtienen datos del INEI
**Causa:** El servicio del INEI puede estar temporalmente inaccesible
**Solución:** Intenta nuevamente más tarde o prueba con un departamento específico
```bash
INEI_DEPARTMENTS=15 node update-crime-data.js
```
