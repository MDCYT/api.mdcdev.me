const { Router } = require('express');
const {
  getCrimePoints,
  getCrimeStats,
  countCrimePoints,
  getCrimeTypes,
} = require('../../../../../utils/inei-crime-db');

const router = Router();

/**
 * GET /v2/peru/inei/crime
 * Obtiene puntos de delitos con filtros
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      crime_type,
      dept_code,
      prov_code,
      dist_code,
      ubigeo,
      min_lat,
      max_lat,
      min_lon,
      max_lon,
    } = req.query;

    // Validar límite
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 1000);
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);

    const filters = {
      limit: parsedLimit,
      offset: parsedOffset,
    };

    // Aplicar filtros opcionales
    if (crime_type) filters.crimeType = crime_type;
    if (dept_code) filters.deptCode = dept_code;
    if (prov_code) filters.provCode = prov_code;
    if (dist_code) filters.distCode = dist_code;
    if (ubigeo) filters.ubigeo = ubigeo;

    // Filtro por bounding box
    if (min_lat && max_lat && min_lon && max_lon) {
      filters.minLat = parseFloat(min_lat);
      filters.maxLat = parseFloat(max_lat);
      filters.minLon = parseFloat(min_lon);
      filters.maxLon = parseFloat(max_lon);
    }

    const points = await getCrimePoints(filters);
    const total = await countCrimePoints(filters);

    res.json({
      success: true,
      data: points,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        returned: points.length,
      },
      filters: {
        crime_type: crime_type || null,
        dept_code: dept_code || null,
        prov_code: prov_code || null,
        dist_code: dist_code || null,
        ubigeo: ubigeo || null,
        bbox: min_lat && max_lat && min_lon && max_lon ? { min_lat, max_lat, min_lon, max_lon } : null,
      },
    });
  } catch (error) {
    console.error('Error obteniendo puntos de delitos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener puntos de delitos',
      message: error.message,
    });
  }
});

/**
 * GET /v2/peru/inei/crime/stats
 * Obtiene estadísticas de delitos
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getCrimeStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de delitos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      message: error.message,
    });
  }
});

/**
 * GET /v2/peru/inei/crime/types
 * Obtiene tipos de delitos disponibles
 */
router.get('/types', async (req, res) => {
  try {
    const types = await getCrimeTypes();

    res.json({
      success: true,
      data: types,
      total: types.length,
    });
  } catch (error) {
    console.error('Error obteniendo tipos de delitos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipos de delitos',
      message: error.message,
    });
  }
});

/**
 * GET /v2/peru/inei/crime/heatmap
 * Obtiene datos optimizados para mapa de calor
 * 
 * Parámetros opcionales:
 * - limit: Máximo de registros (default: 5000, máximo: 20000)
 * - crime_type: Filtrar por tipo de delito
 * - dept_code: Filtrar por departamento
 * - min_lat, max_lat, min_lon, max_lon: Rango de coordenadas
 */
router.get('/heatmap', async (req, res) => {
  try {
    const { 
      limit = 5000,
      crime_type, 
      dept_code,
      min_lat,
      max_lat,
      min_lon,
      max_lon
    } = req.query;

    // Validar límite (máximo 20000)
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 5000, 1), 20000);

    const filters = {
      limit: parsedLimit,
      offset: 0,
    };

    if (crime_type) filters.crimeType = crime_type;
    if (dept_code) filters.deptCode = dept_code;

    // Filtro por bounding box
    if (min_lat && max_lat && min_lon && max_lon) {
      filters.minLat = parseFloat(min_lat);
      filters.maxLat = parseFloat(max_lat);
      filters.minLon = parseFloat(min_lon);
      filters.maxLon = parseFloat(max_lon);
    }

    const points = await getCrimePoints(filters);

    // Simplificar datos para heatmap (solo coordenadas y tipo)
    const heatmapData = points.map((p) => ({
      lat: p.latitude,
      lon: p.longitude,
      type: p.crime_type,
      intensity: 1, // Puede ajustarse según necesidad
    }));

    res.json({
      success: true,
      data: heatmapData,
      total: heatmapData.length,
      limit: parsedLimit,
      filters: {
        crime_type: crime_type || null,
        dept_code: dept_code || null,
        bbox: min_lat && max_lat && min_lon && max_lon ? { min_lat, max_lat, min_lon, max_lon } : null,
      },
    });
  } catch (error) {
    console.error('Error obteniendo datos de heatmap:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos de heatmap',
      message: error.message,
    });
  }
});

/**
 * GET /v2/peru/inei/crime/by-location
 * Obtiene delitos por ubicación (departamento, provincia, distrito)
 */
router.get('/by-location', async (req, res) => {
  try {
    const { dept_code, prov_code, dist_code, limit = 100 } = req.query;

    if (!dept_code) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro dept_code es requerido',
      });
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 1000);

    const filters = {
      deptCode: dept_code,
      limit: parsedLimit,
      offset: 0,
    };

    if (prov_code) filters.provCode = prov_code;
    if (dist_code) filters.distCode = dist_code;

    const points = await getCrimePoints(filters);
    const total = await countCrimePoints(filters);

    res.json({
      success: true,
      data: points,
      total,
      location: {
        dept_code: dept_code,
        prov_code: prov_code || null,
        dist_code: dist_code || null,
      },
    });
  } catch (error) {
    console.error('Error obteniendo delitos por ubicación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener delitos por ubicación',
      message: error.message,
    });
  }
});

module.exports = router;
