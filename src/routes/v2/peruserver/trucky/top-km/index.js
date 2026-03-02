const { Router } = require('express');
const axios = require('axios');

const router = Router();

const TRUCKY_BASE_URL = 'https://e.truckyapp.com/api/v1/company';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CACHE_TTL_CURRENT_MONTH_MS = 30 * 60 * 1000; // 30 minutos
const CACHE_TTL_PAST_MONTH_MS = 24 * 60 * 60 * 1000; // 24 horas
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
const accumulatedCache = new Map();

const nowUtc = () => new Date();

const formatTimestampHuman = (date) => {
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

const parseStartMonthYear = (query) => {
  const currentDate = nowUtc();
  const currentMonth = currentDate.getUTCMonth() + 1;
  const currentYear = currentDate.getUTCFullYear();

  const rawMonth = query.month ?? query.mes;
  const rawYear = query.year ?? query.anio ?? query.año;

  const month = parseInt(rawMonth, 10);

  if (Number.isNaN(month)) {
    return { error: 'El parámetro month es obligatorio y debe ser un número entre 1 y 12' };
  }

  if (month < 1 || month > 12) {
    return { error: 'El parámetro month debe estar entre 1 y 12' };
  }

  let year = parseInt(rawYear, 10);

  // Si no se especifica año, usar lógica inteligente
  if (Number.isNaN(year)) {
    if (month > currentMonth) {
      // Si el mes es mayor al actual, asumir año pasado
      year = currentYear - 1;
    } else {
      // Si el mes es menor o igual al actual, usar año actual
      year = currentYear;
    }
  }

  if (year < 2000 || year > currentYear) {
    return { error: `El parámetro year debe estar entre 2000 y ${currentYear}` };
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

const getMonthlyStatsForCompany = async (companyId, month, year) => {
  try {
    const response = await axios.get(`${TRUCKY_BASE_URL}/${companyId}/stats/monthly`, {
      params: { month, year },
      headers: TRUCKY_HEADERS,
      timeout: 15000,
    });

    if (response.status === 200 && response.data) {
      const realKm = Number(response.data.total?.real_km ?? 0);
      const raceKm = Number(response.data.total?.race_km ?? 0);
      const jobs = Number(response.data.total?.total_jobs ?? 0);
      
      return {
        distance: realKm + raceKm,
        jobs,
        success: true,
      };
    }

    return { distance: 0, jobs: 0, success: false };
  } catch (error) {
    return { distance: 0, jobs: 0, success: false };
  }
};

const getCompanyInfo = async (companyId) => {
  const cacheKey = `company-${companyId}`;
  const cached = monthlyCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const response = await axios.get(`${TRUCKY_BASE_URL}/${companyId}`, {
      headers: TRUCKY_HEADERS,
      timeout: 15000,
    });

    if (response.status === 200 && response.data) {
      const info = {
        name: response.data.name || `Empresa ${companyId}`,
        tag: response.data.tag || '',
        members: Number.isInteger(response.data.members_count)
          ? Math.max(0, response.data.members_count - 1)
          : null,
      };

      monthlyCache.set(cacheKey, {
        data: info,
        expiresAt: Date.now() + CACHE_TTL_PAST_MONTH_MS, // 24h para info de empresa
      });

      return info;
    }
  } catch (error) {
    // Fallback
  }

  return {
    name: `Empresa ${companyId}`,
    tag: '',
    members: null,
  };
};

const generateMonthRanges = (startMonth, startYear, endMonth, endYear) => {
  const ranges = [];
  let currentMonth = startMonth;
  let currentYear = startYear;

  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    ranges.push({ month: currentMonth, year: currentYear });

    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
  }

  return ranges;
};

const getMonthCacheKey = (companyId, month, year) => `month-${companyId}-${year}-${month}`;

const fetchMonthWithCache = async (companyId, month, year, isCurrentMonth) => {
  const cacheKey = getMonthCacheKey(companyId, month, year);
  const cached = monthlyCache.get(cacheKey);

  const ttl = isCurrentMonth ? CACHE_TTL_CURRENT_MONTH_MS : CACHE_TTL_PAST_MONTH_MS;

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const data = await getMonthlyStatsForCompany(companyId, month, year);

  monthlyCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttl,
  });

  return data;
};

const buildAccumulatedResponse = async ({ startMonth, startYear, limit }) => {
  const currentDate = nowUtc();
  const currentMonth = currentDate.getUTCMonth() + 1;
  const currentYear = currentDate.getUTCFullYear();

  const monthRanges = generateMonthRanges(startMonth, startYear, currentMonth, currentYear);
  const selectedCompanyIds = COMPANY_IDS.slice(0, limit);

  const companyAccumulatedData = await mapWithConcurrency(
    selectedCompanyIds,
    5,
    async (companyId) => {
      const companyInfo = await getCompanyInfo(companyId);
      let totalDistance = 0;
      let totalJobs = 0;
      let monthsProcessed = 0;
      let monthsWithErrors = 0;

      for (const { month, year } of monthRanges) {
        const isCurrentMonth = month === currentMonth && year === currentYear;
        const monthData = await fetchMonthWithCache(companyId, month, year, isCurrentMonth);

        if (monthData.success) {
          totalDistance += monthData.distance;
          totalJobs += monthData.jobs;
          monthsProcessed += 1;
        } else {
          monthsWithErrors += 1;
        }
      }

      return {
        id: companyId,
        name: companyInfo.name,
        tag: companyInfo.tag,
        members: companyInfo.members,
        total_distance: totalDistance,
        total_jobs: totalJobs,
        months_processed: monthsProcessed,
        months_with_errors: monthsWithErrors,
      };
    }
  );

  const sortedItems = [...companyAccumulatedData].sort((a, b) => {
    return b.total_distance - a.total_distance;
  });

  const generatedAt = nowUtc();

  return {
    ok: true,
    limit,
    period: {
      from: { month: startMonth, year: startYear },
      to: { month: currentMonth, year: currentYear },
      total_months: monthRanges.length,
    },
    count_companies_total: selectedCompanyIds.length,
    count_companies_processed: sortedItems.length,
    items: sortedItems,
    timestamp: Math.floor(generatedAt.getTime() / 1000),
    timestamp_human: formatTimestampHuman(generatedAt),
    note: 'Kilómetros acumulados desde el mes/año inicial hasta el mes actual',
  };
};

const getAccumulatedCacheKey = ({ startMonth, startYear, limit }) => 
  `accumulated-${startYear}-${startMonth}-${limit}`;

const getCacheEntry = (cacheKey) => {
  if (!accumulatedCache.has(cacheKey)) {
    accumulatedCache.set(cacheKey, {
      payload: null,
      nextRefreshAt: 0,
      inFlight: null,
      lastError: null,
    });
  }

  return accumulatedCache.get(cacheKey);
};

const refreshCacheEntry = async (entry, params) => {
  try {
    const payload = await buildAccumulatedResponse(params);
    entry.payload = payload;
    
    // El cache completo se refresca cada 30 min (porque incluye el mes actual)
    entry.nextRefreshAt = Date.now() + CACHE_TTL_CURRENT_MONTH_MS;
    entry.lastError = null;
  } catch (error) {
    entry.lastError = {
      message: error.message || 'Error desconocido al actualizar cache',
      at: new Date().toISOString(),
    };

    entry.nextRefreshAt = Date.now() + CACHE_TTL_CURRENT_MONTH_MS;
  }
};

router.get('/', async (req, res) => {
  try {
    const parsedStartMonthYear = parseStartMonthYear(req.query);
    if (parsedStartMonthYear.error) {
      return res.status(400).json({
        ok: false,
        error: parsedStartMonthYear.error,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    const { month: startMonth, year: startYear } = parsedStartMonthYear;
    const limit = parseLimit(req.query.limit);
    const params = { startMonth, startYear, limit };
    const cacheKey = getAccumulatedCacheKey(params);
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
