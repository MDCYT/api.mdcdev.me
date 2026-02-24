const { Router } = require('express');
const router = Router();
const {
  batchUpsertIndeci,
  getIndeciByHoursRange,
  getIndeciByDaysRange,
  getIndeciByDistrito,
  getIndeciLastUpdateStatus,
} = require(require('path').join(global.__basedir, 'utils', 'indeci-db'));
const { fetchIndeciEmergencias } = require(require('path').join(global.__basedir, 'utils', 'indeci-client'));

let isUpdating = false;
let lastUpdateTime = null;
let updateError = null;
let lastSuccessfulUpdate = null;

const DEFAULT_RANGE_HOURS = parseInt(process.env.INDECI_DEFAULT_RANGE_HOURS) || 24;
const MAX_RANGE_DAYS = parseInt(process.env.INDECI_MAX_RANGE_DAYS) || 30;
const UPDATE_INTERVAL = parseInt(process.env.INDECI_UPDATE_INTERVAL) || 900000; // 15 minutos

async function updateIndeciData() {
  if (isUpdating) {
    console.log('INDECI: actualizacion en progreso, saltando');
    return;
  }

  isUpdating = true;
  lastUpdateTime = new Date();
  updateError = null;

  try {
    console.log('INDECI: iniciando actualizacion...');
    const emergencias = await fetchIndeciEmergencias();

    if (emergencias && emergencias.length > 0) {
      console.log(`INDECI: guardando ${emergencias.length} incidentes en BD...`);
      await batchUpsertIndeci(emergencias);
      lastSuccessfulUpdate = new Date();
      console.log('INDECI: actualizacion completada');
    } else {
      console.log('INDECI: no se recibieron datos nuevos');
    }
  } catch (error) {
    updateError = error.message || 'Error desconocido';
    console.error('INDECI: error durante la actualizacion:', error.message);
  } finally {
    isUpdating = false;
  }
}

function startPeriodicUpdate() {
  console.log(`INDECI: actualizaciones cada ${UPDATE_INTERVAL / 60000} minutos`);
  updateIndeciData();
  setInterval(() => {
    updateIndeciData();
  }, UPDATE_INTERVAL);
}

if (!global.indeciUpdateStarted) {
  startPeriodicUpdate();
  global.indeciUpdateStarted = true;
}

/**
 * GET /v2/peru/indeci/incidentes
 * Obtiene incidentes (por defecto ultimas 24 horas)
 * Parametros:
 *   - rango: 'horas' o 'dias'
 *   - cantidad: numero de horas o dias
 */
router.get('/', async (req, res) => {
  try {
    const rango = req.query.rango || 'horas';
    let cantidad = parseInt(req.query.cantidad) || DEFAULT_RANGE_HOURS;

    if (rango === 'dias') {
      if (cantidad > MAX_RANGE_DAYS) cantidad = MAX_RANGE_DAYS;
      if (cantidad < 1) cantidad = 1;
    } else {
      if (cantidad > MAX_RANGE_DAYS * 24) cantidad = MAX_RANGE_DAYS * 24;
      if (cantidad < 1) cantidad = 1;
    }

    let incidentes;
    let rangeDescription;

    if (rango === 'dias') {
      incidentes = await getIndeciByDaysRange(cantidad);
      rangeDescription = `ultimos ${cantidad} dia(s)`;
    } else {
      incidentes = await getIndeciByHoursRange(cantidad);
      rangeDescription = `ultimas ${cantidad} hora(s)`;
    }

    const status = await getIndeciLastUpdateStatus();

    res.json({
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
    });
  } catch (error) {
    console.error('INDECI: error al obtener incidentes:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /v2/peru/indeci/incidentes/distrito/:distrito
 */
router.get('/distrito/:distrito', async (req, res) => {
  try {
    const { distrito } = req.params;
    const incidentes = await getIndeciByDistrito(distrito);
    const status = await getIndeciLastUpdateStatus();

    res.json({
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
    });
  } catch (error) {
    console.error('INDECI: error al obtener incidentes por distrito:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /v2/peru/indeci/incidentes/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getIndeciLastUpdateStatus();

    res.json({
      success: true,
      updateStatus: {
        isUpdating,
        lastUpdateTime,
        lastSuccessfulUpdate,
        error: updateError,
        nextUpdateIn: isUpdating ? 'en progreso' : `${Math.round(UPDATE_INTERVAL / 60000)} minutos`,
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
    });
  } catch (error) {
    console.error('INDECI: error al obtener estado:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
