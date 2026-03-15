const { Router } = require('express');
const axios = require('axios');
const {
  startPeriodicProxyUpdate,
  getRandomProxy,
  getCachedProxies,
} = require('../../../../../utils/proxy-manager');

const router = Router();

const TRUCKY_BASE_URL = 'https://e.truckyapp.com/api/v1/company';
const PERUSERVER_COMPANIES_URL = 'https://peruserver.pe/wp-json/psv/v1/companies';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CACHE_TTL_MS = 30 * 60 * 1000;
const COMPANIES_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const DEFAULT_COMPANY_BATCH_SIZE = Math.min(
  5,
  Math.max(1, Number.parseInt(process.env.TRUCKY_CONCURRENCY || '3', 10) || 3)
);
const TRUCKY_MAX_RETRIES = Math.max(1, Number.parseInt(process.env.TRUCKY_MAX_RETRIES || '3', 10) || 3);
const TRUCKY_RETRY_BASE_MS = Math.max(200, Number.parseInt(process.env.TRUCKY_RETRY_BASE_MS || '700', 10) || 700);
const TRUCKY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://hub.truckyapp.com/',
  Origin: 'https://hub.truckyapp.com',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

startPeriodicProxyUpdate();

const monthlyCache = new Map();
const companiesCache = {
  companyIds: [],
  nextRefreshAt: 0,
  inFlight: null,
  lastError: null,
};

const nowUtc = () => new Date();

const formatTimestampHuman = (date) => {
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

const parseMonthYear = (query) => {
  const currentDate = nowUtc();
  const rawMonth = query.month ?? query.mes;
  const rawYear = query.year ?? query.anio ?? query.año;

  let month = parseInt(rawMonth, 10);
  let year = parseInt(rawYear, 10);

  if (Number.isNaN(month)) month = currentDate.getUTCMonth() + 1;
  if (Number.isNaN(year)) year = currentDate.getUTCFullYear();

  if (month < 1 || month > 12) {
    return { error: 'El parámetro month debe estar entre 1 y 12' };
  }

  if (year < 2000 || year > 3000) {
    return { error: 'El parámetro year no es válido' };
  }

  return { month, year };
};

const parseLimit = (rawLimit) => {
  const parsed = parseInt(rawLimit, 10);

  if (Number.isNaN(parsed)) return DEFAULT_LIMIT;
  if (parsed < 1) return 1;
  if (parsed > MAX_LIMIT) return MAX_LIMIT;

  return parsed;
};

const parseBoolean = (rawValue, defaultValue) => {
  if (rawValue == null) return defaultValue;
  const value = String(rawValue).trim().toLowerCase();

  if (['1', 'true', 'yes', 'y', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(value)) return false;

  return defaultValue;
};

const parsePositiveInt = (rawValue, defaultValue, minValue, maxValue) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(Math.floor(parsed), minValue), maxValue);
};

const parseProxyForAxios = (rawProxy) => {
  if (!rawProxy) return null;

  try {
    const withProtocol = /^(http|https):\/\//i.test(rawProxy)
      ? rawProxy
      : `http://${rawProxy}`;
    const url = new URL(withProtocol);

    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      auth: url.username
        ? {
            username: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password || ''),
          }
        : undefined,
    };
  } catch (error) {
    return null;
  }
};

const getTruckyProxyCandidates = (query) => {
  const queryProxyRaw = query && query.truckyProxy ? String(query.truckyProxy).trim() : '';
  const queryProxyListRaw = query && query.truckyProxyList ? String(query.truckyProxyList).trim() : '';

  const queryProxies = queryProxyListRaw
    ? queryProxyListRaw.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  if (queryProxyRaw) {
    queryProxies.unshift(queryProxyRaw);
  }

  return queryProxies.filter(Boolean);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableTruckyStatus = (status) => [403, 429, 500, 502, 503, 504].includes(status);

const truckyRequestWithRetry = async ({ url, params, timeout = 15000, proxyCandidates = [], useProxyPool = true }) => {
  let lastError = null;

  for (let attempt = 0; attempt < TRUCKY_MAX_RETRIES; attempt += 1) {
    const poolProxy = useProxyPool && proxyCandidates.length === 0 ? getRandomProxy() : null;
    const proxyRaw = proxyCandidates.length > 0
      ? proxyCandidates[attempt % proxyCandidates.length]
      : poolProxy;
    const proxy = parseProxyForAxios(proxyRaw);

    try {
      const response = await axios.get(url, {
        params,
        headers: TRUCKY_HEADERS,
        timeout,
        proxy: proxy || undefined,
      });

      return response;
    } catch (error) {
      lastError = error;
      const status = Number(error && error.response && error.response.status);
      const shouldRetry = isRetryableTruckyStatus(status);

      if (!shouldRetry || attempt === TRUCKY_MAX_RETRIES - 1) {
        throw error;
      }

      const waitMs = TRUCKY_RETRY_BASE_MS * (attempt + 1) + Math.floor(Math.random() * 250);
      await sleep(waitMs);
    }
  }

  throw lastError || new Error('Error desconocido consultando Trucky');
};

const mapWithConcurrency = async (items, concurrency, asyncMapper) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await asyncMapper(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
};

const refreshCompaniesCache = async () => {
  try {
    let companyIds = [];

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabaseResponse = await axios.get(
        `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/trucky_companies?select=company_id&order=company_id.asc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          timeout: 15000,
        }
      );

      const rows = Array.isArray(supabaseResponse.data) ? supabaseResponse.data : [];
      companyIds = rows
        .map((row) => Number(row.company_id))
        .filter((id) => Number.isFinite(id) && id > 0);
    }

    // Fallback de seguridad si Supabase no está configurado o devuelve vacío.
    if (!companyIds.length) {
      const response = await axios.get(PERUSERVER_COMPANIES_URL, {
        timeout: 15000,
      });

      const companies = Array.isArray(response.data) ? response.data : [];
      companyIds = companies
        .map((company) => {
          if (Number.isFinite(company)) return company;
          return company.id || company.company_id || company.empresaId;
        })
        .filter((id) => Number.isFinite(id));
    }

    companiesCache.companyIds = companyIds;
    companiesCache.nextRefreshAt = Date.now() + COMPANIES_CACHE_TTL_MS;
    companiesCache.lastError = null;

    return companyIds;
  } catch (error) {
    companiesCache.lastError = {
      message: error.message || 'Error desconocido al obtener empresas',
      at: new Date().toISOString(),
    };

    // Mantener el TTL anterior si hay error
    companiesCache.nextRefreshAt = Date.now() + COMPANIES_CACHE_TTL_MS;

    // Retornar cache anterior si disponible
    return companiesCache.companyIds;
  }
};

const getCompanies = async () => {
  const mustRefresh = Date.now() >= companiesCache.nextRefreshAt;

  if (mustRefresh && !companiesCache.inFlight) {
    companiesCache.inFlight = refreshCompaniesCache()
      .finally(() => {
        companiesCache.inFlight = null;
      });
  }

  if (companiesCache.inFlight) {
    await companiesCache.inFlight;
  }

  return companiesCache.companyIds;
};

const getCompanyMonthlyData = async (companyId, month, year, requestOptions = {}) => {
  const processedAt = nowUtc().toISOString();

  const fallbackItem = {
    id: companyId,
    name: `Empresa ${companyId}`,
    tag: '',
    distance: 0,
    members: null,
    total_jobs: null,
    stats_http_code: null,
    updated: processedAt,
    stats_raw: null,
    distance_field: null,
  };

  try {
    const [companyResponse, statsResponse] = await Promise.allSettled([
      truckyRequestWithRetry({
        url: `${TRUCKY_BASE_URL}/${companyId}`,
        timeout: 15000,
        proxyCandidates: requestOptions.proxyCandidates || [],
        useProxyPool: requestOptions.useProxyPool !== false,
      }),
      truckyRequestWithRetry({
        url: `${TRUCKY_BASE_URL}/${companyId}/stats/monthly`,
        params: { month, year },
        timeout: 15000,
        proxyCandidates: requestOptions.proxyCandidates || [],
        useProxyPool: requestOptions.useProxyPool !== false,
      }),
    ]);

    const companyData = companyResponse.status === 'fulfilled' ? companyResponse.value.data : null;
    const statsData = statsResponse.status === 'fulfilled' ? statsResponse.value.data : null;

    const statsHttpCode =
      statsResponse.status === 'fulfilled'
        ? statsResponse.value.status
        : statsResponse.reason?.response?.status ?? null;

    const realKm = Number(statsData?.total?.real_km ?? 0);
    const raceKm = Number(statsData?.total?.race_km ?? 0);
    const totalKm = realKm + raceKm;

    const membersCount = companyData?.members_count;
    const members = Number.isInteger(membersCount)
      ? Math.max(0, membersCount - 1)
      : null;

    const total_jobs = Number.isFinite(Number(statsData?.total?.total_jobs))
      ? Number(statsData.total.total_jobs)
      : null;

    return {
      id: companyId,
      name: companyData?.name || fallbackItem.name,
      tag: companyData?.tag || '',
      distance: totalKm,
      members,
      total_jobs,
      stats_http_code: statsHttpCode,
      updated: processedAt,
      stats_raw: statsData,
      distance_field: totalKm,
    };
  } catch (error) {
    return {
      ...fallbackItem,
      stats_http_code: error?.response?.status ?? fallbackItem.stats_http_code,
    };
  }
};

const buildMonthlyResponse = async ({ month, year, limit, companyBatchSize, requestOptions }) => {
  const allCompanyIds = await getCompanies();
  const selectedCompanyIds = allCompanyIds.slice(0, limit);

  const items = await mapWithConcurrency(selectedCompanyIds, companyBatchSize, async (companyId) => {
    return getCompanyMonthlyData(companyId, month, year, requestOptions);
  });

  const sortedItems = [...items].sort((a, b) => {
    const distanceA = Number(a.distance ?? 0);
    const distanceB = Number(b.distance ?? 0);
    return distanceB - distanceA;
  });

  const countCompaniesErrors = sortedItems.filter((item) => item.stats_http_code === null || item.stats_http_code >= 400).length;
  const generatedAt = nowUtc();

  return {
    ok: true,
    limit,
    month,
    year,
    count_companies_total: selectedCompanyIds.length,
    count_companies_processed: sortedItems.length,
    count_companies_errors: countCompaniesErrors,
    items: sortedItems,
    timestamp: Math.floor(generatedAt.getTime() / 1000),
    timestamp_human: formatTimestampHuman(generatedAt),
    note: 'Se muestran distancias TOTALES acumuladas (real_km + race_km, no la entrega más larga)',
  };
};

const getCacheKey = ({ month, year, limit }) => `${year}-${month}-${limit}`;

const getCacheEntry = (cacheKey) => {
  if (!monthlyCache.has(cacheKey)) {
    monthlyCache.set(cacheKey, {
      payload: null,
      nextRefreshAt: 0,
      inFlight: null,
      lastError: null,
    });
  }

  return monthlyCache.get(cacheKey);
};

const refreshCacheEntry = async (entry, params) => {
  try {
    const payload = await buildMonthlyResponse(params);
    entry.payload = payload;
    entry.nextRefreshAt = Date.now() + CACHE_TTL_MS;
    entry.lastError = null;
  } catch (error) {
    entry.lastError = {
      message: error.message || 'Error desconocido al actualizar cache',
      at: new Date().toISOString(),
    };

    entry.nextRefreshAt = Date.now() + CACHE_TTL_MS;
  }
};

router.get('/', async (req, res) => {
  try {
    const parsedMonthYear = parseMonthYear(req.query);
    if (parsedMonthYear.error) {
      return res.status(400).json({
        ok: false,
        error: parsedMonthYear.error,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    const { month, year } = parsedMonthYear;
    const limit = parseLimit(req.query.limit);
    const companyBatchSize = parsePositiveInt(req.query.companyBatchSize, DEFAULT_COMPANY_BATCH_SIZE, 1, 10);
    const disableProxy = parseBoolean(req.query.disableProxy, false);
    const asyncMode = parseBoolean(req.query.async, process.env.NODE_ENV === 'production');
    const proxyCandidates = disableProxy ? [] : getTruckyProxyCandidates(req.query);

    const params = {
      month,
      year,
      limit,
      companyBatchSize,
      requestOptions: {
        proxyCandidates,
        useProxyPool: !disableProxy,
      },
    };
    const cacheKey = getCacheKey(params);
    const entry = getCacheEntry(cacheKey);

    const mustRefresh = !entry.payload || Date.now() >= entry.nextRefreshAt;

    if (mustRefresh && !entry.inFlight) {
      entry.inFlight = refreshCacheEntry(entry, params)
        .finally(() => {
          entry.inFlight = null;
        });
    }

    if (entry.inFlight && !asyncMode) {
      await entry.inFlight;
    }

    if (entry.payload) {
      return res.json({
        ...entry.payload,
        cache: {
          hasPayload: true,
          refreshing: Boolean(entry.inFlight),
          stale: mustRefresh,
          mode: asyncMode ? 'async' : 'sync',
        },
        truckyRequestConfig: {
          companyBatchSize,
          explicitProxiesCount: proxyCandidates.length,
          useProxyPool: !disableProxy,
          proxyPoolSize: !disableProxy ? getCachedProxies().length : 0,
        },
      });
    }

    if (entry.inFlight && asyncMode) {
      return res.status(202).json({
        ok: true,
        warming: true,
        month,
        year,
        limit,
        message: 'Actualizando cache en segundo plano. Reintenta en unos segundos.',
        truckyRequestConfig: {
          companyBatchSize,
          explicitProxiesCount: proxyCandidates.length,
          useProxyPool: !disableProxy,
          proxyPoolSize: !disableProxy ? getCachedProxies().length : 0,
        },
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    return res.status(503).json({
      ok: false,
      error: 'No se pudo obtener datos de Trucky en este momento',
      detail: entry.lastError?.message || null,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error interno al consultar datos de Trucky',
      timestamp: Math.floor(Date.now() / 1000),
    });
  }
});

module.exports = router;