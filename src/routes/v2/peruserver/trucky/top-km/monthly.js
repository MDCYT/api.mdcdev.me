const { Router } = require('express');
const axios = require('axios');

const router = Router();

const TRUCKY_BASE_URL = 'https://e.truckyapp.com/api/v1/company';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CACHE_TTL_MS = 30 * 60 * 1000;
const TRUCKY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://hub.truckyapp.com/',
  Origin: 'https://hub.truckyapp.com',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

const COMPANY_IDS = [
  41299, 41321, 41317, 41323, 41326,
  41369, 41371, 41374, 41375, 41376,
  41377, 41378, 41379, 41382, 41389,
  41407, 41408, 41409, 41410, 41411,
  41413, 41525, 41527, 41528, 41530,
  41533, 41534, 41535, 41536, 41537,
  41540, 41541, 41542, 41543, 41544,
];

const monthlyCache = new Map();

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

const getCompanyMonthlyData = async (companyId, month, year) => {
  const processedAt = nowUtc().toISOString();

  const fallbackItem = {
    id: companyId,
    name: `Empresa ${companyId}`,
    tag: '',
    distance: 0,
    members: null,
    jobs: null,
    stats_http_code: null,
    updated: processedAt,
    stats_raw: null,
    distance_field: null,
  };

  try {
    const [companyResponse, statsResponse] = await Promise.allSettled([
      axios.get(`${TRUCKY_BASE_URL}/${companyId}`, {
        headers: TRUCKY_HEADERS,
        timeout: 15000,
      }),
      axios.get(`${TRUCKY_BASE_URL}/${companyId}/stats/monthly`, {
        params: { month, year },
        headers: TRUCKY_HEADERS,
        timeout: 15000,
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

    const jobs = Number.isFinite(Number(statsData?.total?.total_jobs))
      ? Number(statsData.total.total_jobs)
      : null;

    return {
      id: companyId,
      name: companyData?.name || fallbackItem.name,
      tag: companyData?.tag || '',
      distance: totalKm,
      members,
      jobs,
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

const buildMonthlyResponse = async ({ month, year, limit }) => {
  const selectedCompanyIds = COMPANY_IDS.slice(0, limit);

  const items = await mapWithConcurrency(selectedCompanyIds, 5, async (companyId) => {
    return getCompanyMonthlyData(companyId, month, year);
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
    const params = { month, year, limit };
    const cacheKey = getCacheKey(params);
    const entry = getCacheEntry(cacheKey);

    const mustRefresh = !entry.payload || Date.now() >= entry.nextRefreshAt;

    if (mustRefresh && !entry.inFlight) {
      entry.inFlight = refreshCacheEntry(entry, params)
        .finally(() => {
          entry.inFlight = null;
        });
    }

    if (entry.inFlight) {
      await entry.inFlight;
    }

    if (entry.payload) {
      return res.json(entry.payload);
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