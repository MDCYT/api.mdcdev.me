const fetch = require('node-fetch');

const INEI_BASE_URL =
  'https://arcgis3.inei.gob.pe:6443/arcgis/rest/services/Datacrim/DATACRIM005_AGS_PUNTOSDELITOS_CIUDADANO/MapServer';
const LAYER_ID = 2;

// BBOX para Lima (aprox. cobertura amplia)
const DEFAULT_BBOX = '-8581965.894278033,-1358384.4002980646,-8571054.508490337,-1349355.2763318904';

/**
 * Convierte coordenadas Web Mercator (EPSG:3857) a WGS84 (EPSG:4326)
 * @param {number} x - Coordenada X en Web Mercator
 * @param {number} y - Coordenada Y en Web Mercator
 * @returns {Object} - {longitude, latitude} en WGS84
 */
function webMercatorToWGS84(x, y) {
  const earthRadius = 6378137.0;
  const longitude = (x / earthRadius) * (180 / Math.PI);
  const latitude = (Math.atan(Math.exp(y / earthRadius)) * 2 - Math.PI / 2) * (180 / Math.PI);
  return { longitude, latitude };
}

/**
 * Obtiene puntos de delitos desde el servicio ArcGIS del INEI
 * @param {Object} options - Opciones de consulta
 * @returns {Promise<Array>} Array de puntos de delitos
 */
async function fetchCrimePoints(options = {}) {
  const {
    bbox = null,
    where = '1=1',
    spatialRel = 'esriSpatialRelIntersects',
    outFields = '*',
    returnGeometry = true,
    maxRecords = 5000,
  } = options;

  try {
    const params = new URLSearchParams({
      f: 'pjson',
      where: where,
      spatialRel: spatialRel,
      outFields: outFields,
      returnGeometry: returnGeometry.toString(),
      resultRecordCount: maxRecords.toString(),
    });

    // Solo agregar geometría si se especifica bbox
    if (bbox) {
      params.set('geometry', bbox);
      params.set('geometryType', 'esriGeometryEnvelope');
      params.set('inSR', '102100'); // Web Mercator
    }

    const url = `${INEI_BASE_URL}/${LAYER_ID}/query?${params.toString()}`;
    console.log('INEI: Consultando puntos de delitos...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`INEI API retornó status ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`INEI API error: ${JSON.stringify(data.error)}`);
    }

    const features = Array.isArray(data.features) ? data.features : [];

    // Procesar y normalizar los datos
    const points = features
      .filter((f) => f.geometry && typeof f.geometry.x === 'number' && typeof f.geometry.y === 'number')
      .map((f) => {
        // Las coordenadas pueden venir en diferentes sistemas de referencia
        let longitude = f.geometry.x;
        let latitude = f.geometry.y;

        // Si las coordenadas están en Web Mercator (valores muy grandes), convertir a WGS84
        if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
          const converted = webMercatorToWGS84(longitude, latitude);
          longitude = converted.longitude;
          latitude = converted.latitude;
        }

        return {
          x: longitude,
          y: latitude,
          longitude: longitude,
          latitude: latitude,
          attributes: f.attributes || {},
        };
      });

    console.log(`INEI: Se obtuvieron ${points.length} puntos de delitos`);
    return points;
  } catch (error) {
    console.error('Error obteniendo puntos de delitos del INEI:', error.message);
    throw error;
  }
}

/**
 * Obtiene puntos de delitos por departamento
 * @param {string} deptCode - Código de departamento (ej: '15' para Lima)
 * @returns {Promise<Array>} Array de puntos de delitos
 */
async function fetchCrimePointsByDepartment(deptCode) {
  return fetchCrimePoints({
    where: `CCDD='${deptCode}'`,
  });
}

/**
 * Obtiene puntos de delitos por tipo de delito
 * @param {string} crimeType - Tipo de delito
 * @returns {Promise<Array>} Array de puntos de delitos
 */
async function fetchCrimePointsByCrimeType(crimeType) {
  return fetchCrimePoints({
    where: `DELITO_ESP LIKE '%${crimeType}%'`,
  });
}

/**
 * Obtiene puntos de delitos en un área específica (bounding box)
 * @param {Object} bounds - {minLon, minLat, maxLon, maxLat} en WGS84
 * @returns {Promise<Array>} Array de puntos de delitos
 */
async function fetchCrimePointsByBounds(bounds) {
  const { minLon, minLat, maxLon, maxLat } = bounds;

  // Convertir WGS84 a Web Mercator para la consulta
  const earthRadius = 6378137.0;
  const xMin = minLon * (Math.PI / 180) * earthRadius;
  const xMax = maxLon * (Math.PI / 180) * earthRadius;
  const yMin = Math.log(Math.tan((90 + minLat) * (Math.PI / 360))) * earthRadius;
  const yMax = Math.log(Math.tan((90 + maxLat) * (Math.PI / 360))) * earthRadius;

  const bbox = `${xMin},${yMin},${xMax},${yMax}`;

  return fetchCrimePoints({ bbox });
}

/**
 * Obtiene información del servicio (metadata)
 */
async function fetchServiceInfo() {
  try {
    const url = `${INEI_BASE_URL}/${LAYER_ID}?f=pjson`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    if (!response.ok) {
      throw new Error(`INEI API retornó status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error obteniendo información del servicio INEI:', error.message);
    throw error;
  }
}

/**
 * Obtiene TODOS los puntos de delitos usando paginación automática
 * @param {Object} options - Opciones de consulta
 * @returns {Promise<Array>} Array completo de puntos de delitos
 */
async function fetchAllCrimePoints(options = {}) {
  const { where = '1=1', pageSize = 1000 } = options; // ArcGIS tiene límite de 1000 por request
  
  let allPoints = [];
  let offset = 0;
  let hasMore = true;
  let page = 1;

  console.log('INEI: Obteniendo todos los registros con paginación...');

  try {
    while (hasMore) {
      console.log(`   Página ${page} (offset: ${offset})...`);
      
      const params = new URLSearchParams({
        f: 'pjson',
        where: where,
        outFields: '*',
        returnGeometry: 'true',
        resultOffset: offset.toString(),
        resultRecordCount: pageSize.toString(),
      });

      const url = `${INEI_BASE_URL}/${LAYER_ID}/query?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        timeout: 30000,
      });

      if (!response.ok) {
        throw new Error(`INEI API retornó status ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`INEI API error: ${JSON.stringify(data.error)}`);
      }

      const features = Array.isArray(data.features) ? data.features : [];
      
      if (features.length === 0) {
        hasMore = false;
        break;
      }

      // Procesar y normalizar los datos
      const points = features
        .filter((f) => f.geometry && typeof f.geometry.x === 'number' && typeof f.geometry.y === 'number')
        .map((f) => {
          let longitude = f.geometry.x;
          let latitude = f.geometry.y;

          // Si las coordenadas están en Web Mercator, convertir a WGS84
          if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
            const converted = webMercatorToWGS84(longitude, latitude);
            longitude = converted.longitude;
            latitude = converted.latitude;
          }

          return {
            x: longitude,
            y: latitude,
            longitude: longitude,
            latitude: latitude,
            attributes: f.attributes || {},
          };
        });

      allPoints = allPoints.concat(points);
      console.log(`   ✓ ${points.length} registros obtenidos (total acumulado: ${allPoints.length})`);

      // Si obtuvimos menos registros que el tamaño de página, ya no hay más
      if (features.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
        page++;
        // Pequeño delay para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`INEI: Total de ${allPoints.length} puntos obtenidos`);
    return allPoints;
  } catch (error) {
    console.error('Error obteniendo todos los puntos de delitos del INEI:', error.message);
    throw error;
  }
}

module.exports = {
  fetchCrimePoints,
  fetchCrimePointsByDepartment,
  fetchCrimePointsByCrimeType,
  fetchCrimePointsByBounds,
  fetchServiceInfo,
  fetchAllCrimePoints,
  webMercatorToWGS84,
  INEI_BASE_URL,
  LAYER_ID,
};
