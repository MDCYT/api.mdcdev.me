const { Router } = require('express');
const router = Router();
const {
  batchUpsertEarthquakes,
  getEarthquakesByHoursRange,
  getEarthquakesByDaysRange,
  getEarthquakesByMinimumMagnitude,
  getLastEarthquake,
  getEarthquakeByCode,
  getEarthquakesByReference,
  getEarthquakeLastUpdateStatus,
  getSignificantEarthquakes,
} = require(require('path').join(global.__basedir, 'utils', 'igp-db'));
const {
  fetchRecentEarthquakes,
  fetchAndEnrichEarthquakes,
} = require(require('path').join(global.__basedir, 'utils', 'igp-scraper'));

let isUpdating = false;
let lastUpdateTime = null;
let updateError = null;
let lastSuccessfulUpdate = null;

const DEFAULT_RANGE_HOURS = parseInt(process.env.IGP_DEFAULT_RANGE_HOURS) || 24;
const MAX_RANGE_DAYS = parseInt(process.env.IGP_MAX_RANGE_DAYS) || 30;
const UPDATE_INTERVAL = parseInt(process.env.IGP_UPDATE_INTERVAL) || 900000; // 15 minutos

async function updateEarthquakesData() {
  if (isUpdating) {
    console.log('IGP: actualizacion en progreso, saltando');
    return;
  }

  isUpdating = true;
  lastUpdateTime = new Date();
  updateError = null;

  try {
    console.log('IGP: iniciando actualizacion...');
    const sismos = await fetchRecentEarthquakes();

    if (sismos && sismos.length > 0) {
      console.log(`IGP: guardando ${sismos.length} sismos en BD...`);
      const saved = await batchUpsertEarthquakes(sismos);
      lastSuccessfulUpdate = new Date();
      console.log(`IGP: actualizacion completada (${saved} sismos guardados)`);
    } else {
      console.log('IGP: no se recibieron datos nuevos');
    }
  } catch (error) {
    updateError = error.message || 'Error desconocido';
    console.error('IGP: error durante la actualizacion:', error.message);
  } finally {
    isUpdating = false;
  }
}

function startPeriodicUpdate() {
  console.log(`IGP: actualizaciones cada ${UPDATE_INTERVAL / 60000} minutos`);
  updateEarthquakesData();
  setInterval(() => {
    updateEarthquakesData();
  }, UPDATE_INTERVAL);
}

if (!global.igpUpdateStarted) {
  startPeriodicUpdate();
  global.igpUpdateStarted = true;
}

/**
 * GET /v2/peru/igp
 * Documentación del API de sismos del IGP
 */
router.get('/', (req, res) => {
  res.json({
    message: 'API de Sismos del IGP Perú',
    description: 'Obtén información sobre sismos registrados por el Instituto Geofísico del Perú',
    endpoints: {
      'GET /': 'Documentación de este API (esta respuesta)',
      'GET /earthquakes': 'Obtiene sismos recientes (default: últimas 24 horas)',
      'GET /earthquakes/latest': 'Obtiene el último sismo registrado',
      'GET /earthquakes/:code': 'Obtiene detalles de un sismo específico por código',
      'GET /earthquakes/reference/:reference': 'Obtiene sismos por referencia/región',
      'GET /earthquakes/significant': 'Obtiene sismos significativos (magnitud >= 4.0)',
      'POST /earthquakes/update': 'Actualiza manualmente los sismos (emergencia)',
      'GET /status': 'Estado de las actualizaciones automáticas',
    },
    parameters: {
      'GET /earthquakes': {
        'rango': 'horas | dias (default: horas)',
        'cantidad': 'número de horas o días (default: 24)',
        'magnitud_minima': 'magnitud mínima a filtrar (optional)',
      },
      'GET /earthquakes/significant': {
        'magnitud_minima': 'magnitud mínima (default: 4.0)',
      },
      'GET /earthquakes/reference/:reference': {
        'horas': 'rango en horas para la búsqueda (default: 72)',
      },
    },
    examples: {
      'Últimas 24 horas': '/earthquakes',
      'Últimas 48 horas': '/earthquakes?rango=horas&cantidad=48',
      'Últimos 7 días': '/earthquakes?rango=dias&cantidad=7',
      'Últimos 30 días': '/earthquakes?rango=dias&cantidad=30',
      'Magnitud >= 5.0 últimas 24h': '/earthquakes?magnitud_minima=5.0',
      'Último sismo': '/earthquakes/latest',
      'Detalles de sismo': '/earthquakes/2026-0100',
      'Sismos en Lima': '/earthquakes/reference/Lima',
      'Sismos significativos': '/earthquakes/significant',
    },
    updateStatus: {
      configuration: {
        updateIntervalMinutes: UPDATE_INTERVAL / 60000,
        lastUpdateTime,
        isUpdating,
      },
      updateInfo: {
        lastSuccessfulUpdate,
        error: updateError,
      },
    },
    database: {
      table: 'earthquakes',
      fields: [
        'code', 'codes', 'report_number', 'list_quake_id', 'external_id',
        'date', 'local_date', 'local_time', 'utc_date', 'utc_time', 'datetime_utc',
        'latitude', 'longitude', 'reference', 'reference2', 'reference3',
        'magnitude', 'magnitude_type', 'depth', 'intensity', 'intensities',
        'event_type', 'surface', 'accelerometric_report_pdf',
        'seismic_map_url', 'accelerometric_map_url', 'max_acceleration_map_url',
        'theoretical_acceleration_map_url', 'intensity_map_url',
        'pseudo_acceleration_map_url', 'max_velocity_map_url',
        'published', 'drill', 'thematic_pdf_id',
      ],
    },
    igpApiSource: 'https://ultimosismo.igp.gob.pe/api/ultimo-sismo',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /v2/peru/igp/earthquakes
 * Obtiene sismos (por defecto últimas 24 horas)
 */
router.get('/earthquakes', async (req, res) => {
  try {
    const rango = req.query.rango || 'horas';
    let cantidad = parseInt(req.query.cantidad) || DEFAULT_RANGE_HOURS;
    const magnitudMinima = req.query.magnitud_minima ? parseFloat(req.query.magnitud_minima) : null;

    if (rango === 'dias') {
      if (cantidad > MAX_RANGE_DAYS) cantidad = MAX_RANGE_DAYS;
      if (cantidad < 1) cantidad = 1;
    } else {
      if (cantidad > MAX_RANGE_DAYS * 24) cantidad = MAX_RANGE_DAYS * 24;
      if (cantidad < 1) cantidad = 1;
    }

    let sismos;
    let rangeDescription;

    if (magnitudMinima !== null && magnitudMinima > 0) {
      sismos = await getEarthquakesByMinimumMagnitude(magnitudMinima, rango === 'dias' ? cantidad * 24 : cantidad);
      rangeDescription = `últimas ${cantidad} ${rango === 'dias' ? 'día(s)' : 'hora(s)'} con magnitud >= ${magnitudMinima}`;
    } else if (rango === 'dias') {
      sismos = await getEarthquakesByDaysRange(cantidad);
      rangeDescription = `últimos ${cantidad} día(s)`;
    } else {
      sismos = await getEarthquakesByHoursRange(cantidad);
      rangeDescription = `últimas ${cantidad} hora(s)`;
    }

    const status = await getEarthquakeLastUpdateStatus();

    res.json({
      success: true,
      count: sismos.length,
      range: rangeDescription,
      data: sismos,
      source: 'database',
      lastUpdate: {
        timestamp: status.last_update,
        lastEarthquake: status.last_earthquake,
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
    console.error('IGP: error al obtener sismos:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /v2/peru/igp/earthquakes/latest
 * Obtiene el último sismo registrado
 */
router.get('/earthquakes/latest', async (req, res) => {
  try {
    const sismo = await getLastEarthquake();

    res.json({
      success: true,
      data: sismo,
      source: 'database',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IGP: error al obtener último sismo:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /v2/peru/igp/earthquakes/:code
 * Obtiene detalles de un sismo específico por código
 */
router.get('/earthquakes/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const sismo = await getEarthquakeByCode(code);

    if (!sismo) {
      return res.status(404).json({
        success: false,
        error: `Sismo con código ${code} no encontrado`,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: sismo,
      source: 'database',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IGP: error al obtener sismo por código:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /v2/peru/igp/earthquakes/reference/:reference
 * Obtiene sismos por referencia/región
 */
router.get('/earthquakes/reference/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const horas = parseInt(req.query.horas) || 72;

    const sismos = await getEarthquakesByReference(reference, horas);

    res.json({
      success: true,
      count: sismos.length,
      reference,
      range: `últimas ${horas} horas`,
      data: sismos,
      source: 'database',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IGP: error al obtener sismos por referencia:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /v2/peru/igp/earthquakes/significant
 * Obtiene sismos significativos (magnitud >= 4.0 en últimas 24 horas)
 */
router.get('/earthquakes/significant', async (req, res) => {
  try {
    const magnitudMinima = req.query.magnitud_minima ? parseFloat(req.query.magnitud_minima) : 4.0;
    const sismos = await getSignificantEarthquakes(magnitudMinima);

    res.json({
      success: true,
      count: sismos.length,
      magnitudeThreshold: magnitudMinima,
      data: sismos,
      source: 'database',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IGP: error al obtener sismos significativos:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /v2/peru/igp/earthquakes/update
 * Actualización manual de sismos (para emergencias)
 */
router.post('/earthquakes/update', async (req, res) => {
  try {
    // Si ya hay una actualización en progreso, retornar estado
    if (isUpdating) {
      return res.status(429).json({
        success: false,
        error: 'Actualización ya en progreso',
        lastUpdateTime,
        timestamp: new Date().toISOString(),
      });
    }

    // Iniciar actualización manual
    console.log('IGP: actualización manual solicitada');
    await updateEarthquakesData();

    const status = await getEarthquakeLastUpdateStatus();

    res.json({
      success: true,
      message: 'Sismos actualizados exitosamente',
      updateStatus: {
        lastSuccessfulUpdate,
        error: updateError,
        isUpdating,
      },
      database: {
        totalRecords: status.total_records,
        lastEarthquake: status.last_earthquake,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IGP: error en actualización manual:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /v2/peru/igp/status
 * Estado de las actualizaciones automáticas
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getEarthquakeLastUpdateStatus();

    res.json({
      success: true,
      updateStatus: {
        isUpdating,
        lastUpdateTime,
        lastSuccessfulUpdate,
        error: updateError,
        updateIntervalMinutes: UPDATE_INTERVAL / 60000,
      },
      database: {
        totalRecords: status.total_records,
        lastUpdate: status.last_update,
        lastEarthquake: status.last_earthquake,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IGP: error al obtener estado:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
