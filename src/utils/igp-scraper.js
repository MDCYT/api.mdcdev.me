const fetch = require('node-fetch');

const IGP_API_BASE = process.env.IGP_API_URL || 'https://ultimosismo.igp.gob.pe/api/ultimo-sismo';

/**
 * Obtiene los últimos sismos del API del IGP
 * @param {number} year - Año a consultar (default: año actual)
 * @returns {Promise<Array>} Array de sismos
 */
async function fetchLatestEarthquakes(year = null) {
  try {
    const targetYear = year || new Date().getUTCFullYear();
    const url = `${IGP_API_BASE}/ajaxb/${targetYear}`;

    console.log(`IGP: obteniendo sismos de ${targetYear} desde ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'es-PE,es;q=0.9',
      },
      timeout: 15000,
    });

    if (!response.ok) {
      throw new Error(`IGP API retornó status ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn('IGP: respuesta no es un array:', data);
      return [];
    }

    console.log(`IGP: se obtuvieron ${data.length} sismos`);
    return data;
  } catch (error) {
    console.error('Error fetching earthquakes from IGP:', error.message);
    throw error;
  }
}

/**
 * Obtiene detalles de un sismo específico por código
 * @param {string} code - Código del sismo (ej: 2026-0100)
 * @returns {Promise<Object>} Detalles del sismo
 */
async function fetchEarthquakeDetails(code) {
  try {
    const url = `${IGP_API_BASE}/sismo/${code}`;

    console.log(`IGP: obteniendo detalles del sismo ${code}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'es-PE,es;q=0.9',
      },
      timeout: 15000,
    });

    if (!response.ok) {
      throw new Error(`IGP API retornó status ${response.status}`);
    }

    const data = await response.json();
    console.log(`IGP: detalles obtenidos para ${code}`);
    return data;
  } catch (error) {
    console.error(`Error fetching earthquake details for ${code}:`, error.message);
    throw error;
  }
}

/**
 * Obtiene el último sismo registrado
 * @returns {Promise<Object>} Último sismo
 */
async function fetchLastEarthquake() {
  try {
    const url = `${IGP_API_BASE}`;

    console.log('IGP: obteniendo último sismo');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'es-PE,es;q=0.9',
      },
      timeout: 15000,
    });

    if (!response.ok) {
      throw new Error(`IGP API retornó status ${response.status}`);
    }

    const data = await response.json();
    console.log('IGP: último sismo obtenido');
    return data;
  } catch (error) {
    console.error('Error fetching last earthquake from IGP:', error.message);
    throw error;
  }
}

/**
 * Obtiene sismos combinando el endpoint de lista con detalles adicionales
 * @param {number} year - Año a consultar
 * @returns {Promise<Array>} Array de sismos enriquecidos
 */
async function fetchAndEnrichEarthquakes(year = null) {
  try {
    const targetYear = year || new Date().getUTCFullYear();
    
    // Obtener lista de sismos
    const sismos = await fetchLatestEarthquakes(targetYear);

    if (sismos.length === 0) {
      console.log('IGP: no hay sismos registrados para el año', targetYear);
      return [];
    }

    // Enriquecer los N sismos más recientes con detalles adicionales
    const TOP_N = Math.min(10, sismos.length);
    const enrichedSismos = [...sismos];

    console.log(`IGP: obteniendo detalles de los ${TOP_N} sismos más recientes`);

    for (let i = 0; i < TOP_N; i++) {
      try {
        const details = await fetchEarthquakeDetails(sismos[i].codigo);
        // Combinar datos básicos con detalles
        enrichedSismos[i] = {
          ...sismos[i],
          ...details,
        };
        
        // Pequeño delay para no sobrecargar el API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`No se pudieron obtener detalles de ${sismos[i].codigo}`, error.message);
        // Continuar con el siguiente sismo
      }
    }

    return enrichedSismos;
  } catch (error) {
    console.error('Error fetching and enriching earthquakes:', error.message);
    throw error;
  }
}

/**
 * Obtiene sismos recientes sin enriquecer (más rápido)
 * @returns {Promise<Array>} Array de sismos recientes
 */
async function fetchRecentEarthquakes() {
  try {
    const currentYear = new Date().getUTCFullYear();
    const sismos = await fetchLatestEarthquakes(currentYear);
    return sismos;
  } catch (error) {
    console.error('Error fetching recent earthquakes:', error.message);
    throw error;
  }
}

module.exports = {
  fetchLatestEarthquakes,
  fetchEarthquakeDetails,
  fetchLastEarthquake,
  fetchAndEnrichEarthquakes,
  fetchRecentEarthquakes,
};
