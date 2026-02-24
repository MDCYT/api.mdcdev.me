const { Router } = require('express');
const router = Router();
const { 
  getIncidentes, 
  getIncidentesByHoursRange,
  getIncidentesByDaysRange,
  getIncidentesByDistrito,
  getLastUpdateStatus,
  batchUpsertIncidentes 
} = require(require('path').join(global.__basedir, 'utils', 'bomberos-db'));
const { parseBomberos24HorasReal } = require(require('path').join(global.__basedir, 'utils', 'bomberos-scraper'));
const { startPeriodicProxyUpdate, getProxyStatus } = require(require('path').join(global.__basedir, 'utils', 'proxy-manager'));

// Variables globales para el estado
let isUpdating = false;
let lastUpdateTime = null;
let updateError = null;
let lastSuccessfulUpdate = null;

const DEFAULT_RANGE_HOURS = parseInt(process.env.BOMBEROS_DEFAULT_RANGE_HOURS) || 24;
const MAX_RANGE_DAYS = parseInt(process.env.BOMBEROS_MAX_RANGE_DAYS) || 30;
const UPDATE_INTERVAL = parseInt(process.env.BOMBEROS_UPDATE_INTERVAL) || 1800000; // 30 minutos

/**
 * Realiza la actualización de datos desde la API de Bomberos
 * y los guarda en la BD
 */
async function updateBomberosData() {
  if (isUpdating) {
    console.log('⏳ Actualización ya en progreso, saltando...');
    return;
  }

  isUpdating = true;
  lastUpdateTime = new Date();
  updateError = null;

  try {
    console.log('\n🔥 Iniciando actualización de incidentes de bomberos...');
    
    const emergencias = await parseBomberos24HorasReal();
    
    if (emergencias && emergencias.length > 0) {
      console.log(`💾 Guardando ${emergencias.length} incidentes en la BD...`);
      await batchUpsertIncidentes(emergencias);
      
      lastSuccessfulUpdate = new Date();
      console.log(`✅ Actualización completada exitosamente. ${emergencias.length} incidentes guardados.`);
    } else {
      throw new Error('No se recibieron datos de la API');
    }
  } catch (error) {
    updateError = error.message || 'Error desconocido';
    console.error('❌ Error durante la actualización:', error.message);
  } finally {
    isUpdating = false;
  }
}

/**
 * Inicia el proceso de actualización periódica
 */
function startPeriodicUpdate() {
  console.log(`🕐 Iniciando actualizaciones periódicas cada ${UPDATE_INTERVAL / 60000} minutos...`);
  
  // Realizar primera actualización inmediatamente
  updateBomberosData();
  
  // Luego periódicamente
  setInterval(() => {
    updateBomberosData();
  }, UPDATE_INTERVAL);
}

// Iniciar las actualizaciones en background cuando se carga el módulo
if (!global.bomberosUpdateStarted) {
  console.log('🚀 Iniciando sistemas de Bomberos...');
  startPeriodicProxyUpdate();
  startPeriodicUpdate();
  global.bomberosUpdateStarted = true;
}

/**
 * GET /v2/peru/bomberos/incidentes
 * Obtiene incidentes (por defecto últimas 24 horas)
 * Parámetros:
 *   - rango: 'horas' o 'dias' (default: horas)
 *   - cantidad: número de horas o días (default: 24)
 */
router.get('/', async (req, res) => {
  try {
    const rango = req.query.rango || 'horas';
    let cantidad = parseInt(req.query.cantidad) || DEFAULT_RANGE_HOURS;

    // Validaciones
    if (rango === 'dias') {
      if (cantidad > MAX_RANGE_DAYS) {
        cantidad = MAX_RANGE_DAYS;
      }
      if (cantidad < 1) cantidad = 1;
    } else {
      if (cantidad > MAX_RANGE_DAYS * 24) {
        cantidad = MAX_RANGE_DAYS * 24;
      }
      if (cantidad < 1) cantidad = 1;
    }

    let incidentes;
    let rangeDescription;

    if (rango === 'dias') {
      incidentes = await getIncidentesByDaysRange(cantidad);
      rangeDescription = `últimos ${cantidad} día(s)`;
    } else {
      incidentes = await getIncidentesByHoursRange(cantidad);
      rangeDescription = `últimas ${cantidad} hora(s)`;
    }

    const status = await getLastUpdateStatus();
    
    const response = {
      success: true,
      count: incidentes.length,
      range: rangeDescription,
      data: incidentes,
      source: 'database',
      lastUpdate: {
        timestamp: status.last_update,
        totalRecords: status.total_records,
      },
      updateStatus: {
        isUpdating,
        lastUpdateTime,
        lastSuccessfulUpdate,
        error: updateError,
      },
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error al obtener incidentes:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /v2/peru/bomberos/incidentes/distrito/:distrito
 * Obtiene incidentes de un distrito específico
 */
router.get('/distrito/:distrito', async (req, res) => {
  try {
    const { distrito } = req.params;
    const incidentes = await getIncidentesByDistrito(distrito);
    const status = await getLastUpdateStatus();
    
    const response = {
      success: true,
      count: incidentes.length,
      distrito,
      data: incidentes,
      source: 'database',
      lastUpdate: {
        timestamp: status.last_update,
        totalRecords: status.total_records,
      },
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error al obtener incidentes por distrito:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /v2/peru/bomberos/incidentes/status
 * Obtiene el estado de las actualizaciones y proxies
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getLastUpdateStatus();
    const proxyStatus = getProxyStatus();
    
    const response = {
      success: true,
      updateStatus: {
        isUpdating,
        lastUpdateTime,
        lastSuccessfulUpdate,
        error: updateError,
        nextUpdateIn: isUpdating ? 'en progreso' : `${Math.round(UPDATE_INTERVAL / 60000)} minutos`,
      },
      proxyStatus: {
        totalProxies: proxyStatus.totalProxies,
        lastUpdate: proxyStatus.lastUpdate,
        isUpdating: proxyStatus.isUpdating,
      },
      database: {
        lastUpdate: status.last_update,
        totalRecords: status.total_records,
      },
      configuration: {
        defaultRangeHours: DEFAULT_RANGE_HOURS,
        maxRangeDays: MAX_RANGE_DAYS,
        updateIntervalMinutes: UPDATE_INTERVAL / 60000,
      },
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error al obtener estado:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
