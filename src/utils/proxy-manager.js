const fetch = require('node-fetch');

let cachedProxies = [];
let lastProxyUpdate = null;
let isUpdatingProxies = false;
let proxyUpdateIntervalId = null;

/**
 * Obtiene proxies desde la API de ProxyScrape
 */
async function fetchProxiesFromAPI() {
  if (isUpdatingProxies) {
    console.log('⏳ Actualización de proxies ya en progreso...');
    return cachedProxies;
  }

  isUpdatingProxies = true;

  try {
    const proxyApiUrl = process.env.PROXY_API_URL || 
      'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=json';

    console.log('🌐 Obteniendo proxies desde ProxyScrape...');

    const response = await fetch(proxyApiUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Error en API de proxies: ${response.status}`);
    }

    const data = await response.json();

    if (!data.proxies || data.proxies.length === 0) {
      throw new Error('No proxies disponibles en la API');
    }

    // Filtrar proxies vivos y con buen tiempo de respuesta
    const validProxies = data.proxies
      .filter(p => p.alive && p.timeout < 5000) // Menos de 5 segundos
      .map(p => p.proxy)
      .slice(0, 100); // Limitar a 100 proxies

    cachedProxies = validProxies;
    lastProxyUpdate = new Date();

    console.log(`✅ ${validProxies.length} proxies cargados en RAM (${data.shown_records}/${data.total_records} disponibles)`);

    return validProxies;
  } catch (error) {
    console.error('❌ Error al obtener proxies:', error.message);
    
    // Si falló y tenemos proxies en caché, mantener los viejos
    if (cachedProxies.length > 0) {
      console.log(`⚠️  Usando ${cachedProxies.length} proxies en caché`);
      return cachedProxies;
    }

    return [];
  } finally {
    isUpdatingProxies = false;
  }
}

/**
 * Selecciona un proxy aleatorio de los cacheados
 */
function getRandomProxy() {
  if (cachedProxies.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * cachedProxies.length);
  return cachedProxies[randomIndex];
}

/**
 * Obtiene información del estado de los proxies
 */
function getProxyStatus() {
  return {
    totalProxies: cachedProxies.length,
    lastUpdate: lastProxyUpdate,
    isUpdating: isUpdatingProxies,
    proxies: cachedProxies.slice(0, 10), // Mostrar los primeros 10 como ejemplo
  };
}

/**
 * Inicia la actualización periódica de proxies
 */
function startPeriodicProxyUpdate() {
  if (proxyUpdateIntervalId) {
    return;
  }

  const intervalMs = parseInt(process.env.PROXY_UPDATE_INTERVAL) || 3600000; // 1 hora por defecto

  console.log(`🕐 Actualizaciones de proxies cada ${intervalMs / 60000} minutos`);

  // Actualizar inmediatamente
  fetchProxiesFromAPI();

  // Luego periódicamente
  proxyUpdateIntervalId = setInterval(() => {
    fetchProxiesFromAPI();
  }, intervalMs);

  if (typeof proxyUpdateIntervalId.unref === 'function') {
    proxyUpdateIntervalId.unref();
  }
}

module.exports = {
  fetchProxiesFromAPI,
  getRandomProxy,
  getProxyStatus,
  startPeriodicProxyUpdate,
  getCachedProxies: () => cachedProxies,
};
