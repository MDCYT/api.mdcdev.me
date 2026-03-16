const { Router } = require('express');
const axios = require('axios');
const {
  startPeriodicProxyUpdate,
  getRandomProxy,
  getCachedProxies,
} = require('../../../../../utils/proxy-manager');

const router = Router();

const PERUSERVER_COMPANIES_URL = 'https://peruserver.pe/wp-json/psv/v1/companies';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CACHE_TTL_CURRENT_MONTH_MS = 30 * 60 * 1000; // 30 minutos
const CACHE_TTL_PAST_MONTH_MS = 24 * 60 * 60 * 1000; // 24 horas
const COMPANIES_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const BACKGROUND_RETRY_BASE_MS = Math.max(2000, Number.parseInt(process.env.TRUCKY_BACKGROUND_RETRY_BASE_MS || '5000', 10) || 5000);
const BACKGROUND_RETRY_MAX_ATTEMPTS_RAW = Number.parseInt(process.env.TRUCKY_BACKGROUND_RETRY_MAX_ATTEMPTS || '6', 10);
const BACKGROUND_RETRY_MAX_ATTEMPTS = Number.isFinite(BACKGROUND_RETRY_MAX_ATTEMPTS_RAW) && BACKGROUND_RETRY_MAX_ATTEMPTS_RAW <= 0
  ? Infinity
  : Math.max(1, BACKGROUND_RETRY_MAX_ATTEMPTS_RAW || 6);
const DEFAULT_COMPANY_BATCH_SIZE = Math.min(
  5,
  Math.max(1, Number.parseInt(process.env.TRUCKY_CONCURRENCY || '3', 10) || 3)
);
const TRUCKY_MAX_RETRIES = Math.max(1, Number.parseInt(process.env.TRUCKY_MAX_RETRIES || '3', 10) || 3);
const TRUCKY_RETRY_BASE_MS = Math.max(200, Number.parseInt(process.env.TRUCKY_RETRY_BASE_MS || '700', 10) || 700);
const TRUCKY_HEADERS = {
  // User-Agent personalizado según la documentación de Trucky
  'User-Agent': 'peruserver-bot/1.0 (+https://github.com/mdcyt; extracción de datos de empresas para ranking y análisis en peruserver.de)',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://hub.truckyapp.com/',
  Origin: 'https://hub.truckyapp.com',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

startPeriodicProxyUpdate();

const monthlyCache = new Map();
const accumulatedCache = new Map();
const companiesCache = {
  companyIds: [],
  nextRefreshAt: 0,
  inFlight: null,
  lastError: null,
};

const getSupabaseCacheEnv = () => {
  const url = (SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url) return null;

  return {
    url,
    anonKey,
    key: anonKey,
    serviceRoleKey,
  };
};

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

// Ahora retorna [{company_id, api_key}] en vez de solo ids
const refreshCompaniesCache = async () => {
  try {
    let companies = [];

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabaseResponse = await axios.get(
        `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/trucky_companies?select=company_id,api_key&order=company_id.asc`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          timeout: 15000,
        }
      );

      const rows = Array.isArray(supabaseResponse.data) ? supabaseResponse.data : [];
      companies = rows
        .map((row) => ({
          company_id: Number(row.company_id),
          api_key: typeof row.api_key === 'string' && row.api_key.length > 0 ? row.api_key : null,
        }))
        .filter((row) => Number.isFinite(row.company_id) && row.company_id > 0);
    }

    // Fallback de seguridad si Supabase no está configurado o devuelve vacío.
    if (!companies.length) {
      const response = await axios.get(PERUSERVER_COMPANIES_URL, {
        timeout: 15000,
      });

      const arr = Array.isArray(response.data) ? response.data : [];
      companies = arr
        .map((company) => {
          if (Number.isFinite(company)) return { company_id: company, api_key: null };
          return {
            company_id: company.id || company.company_id || company.empresaId,
            api_key: null,
          };
        })
        .filter((row) => Number.isFinite(row.company_id));
    }

    companiesCache.companyIds = companies;
    companiesCache.nextRefreshAt = Date.now() + COMPANIES_CACHE_TTL_MS;
    companiesCache.lastError = null;

    return companies;
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

// Devuelve [{company_id, api_key}]
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

const getMonthlyStatsForCompany = async (companyId, month, year, requestOptions = {}) => {
  try {
    const response = await truckyRequestWithRetry({
      params: { month, year },
      timeout: 15000,
      proxyCandidates: requestOptions.proxyCandidates || [],
      useProxyPool: requestOptions.useProxyPool !== false,
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

const getCompanyInfo = async (companyId, requestOptions = {}) => {
  const cacheKey = `company-${companyId}`;
  const cached = monthlyCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const response = await truckyRequestWithRetry({
      timeout: 15000,
      proxyCandidates: requestOptions.proxyCandidates || [],
      useProxyPool: requestOptions.useProxyPool !== false,
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

const fetchMonthWithCache = async (companyId, month, year, isCurrentMonth, requestOptions = {}) => {
  const cacheKey = getMonthCacheKey(companyId, month, year);
  const cached = monthlyCache.get(cacheKey);

  const ttl = isCurrentMonth ? CACHE_TTL_CURRENT_MONTH_MS : CACHE_TTL_PAST_MONTH_MS;

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const data = await getMonthlyStatsForCompany(companyId, month, year, requestOptions);

  monthlyCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttl,
  });

  return data;
};

const buildAccumulatedResponse = async ({ startMonth, startYear, limit, companyBatchSize, requestOptions }) => {
  const currentDate = nowUtc();
  const currentMonth = currentDate.getUTCMonth() + 1;
  const currentYear = currentDate.getUTCFullYear();

  const monthRanges = generateMonthRanges(startMonth, startYear, currentMonth, currentYear);
  const allCompanyIds = await getCompanies();
  const selectedCompanyIds = allCompanyIds.slice(0, limit);

  const companyAccumulatedData = await mapWithConcurrency(
    selectedCompanyIds,
    companyBatchSize,
    async (companyId) => {
      const companyInfo = await getCompanyInfo(companyId, requestOptions);
      let totalDistance = 0;
      let totalJobs = 0;
      let monthsProcessed = 0;
      let monthsWithErrors = 0;

      for (const { month, year } of monthRanges) {
        const isCurrentMonth = month === currentMonth && year === currentYear;
        const monthData = await fetchMonthWithCache(companyId, month, year, isCurrentMonth, requestOptions);

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

const getBackupCacheKey = ({ startMonth, startYear, limit }) =>
  `accumulated-${startYear}-${startMonth}-${limit}`;

const fetchBackupPayload = async ({ startMonth, startYear, limit }) => {
  const env = getSupabaseCacheEnv();
  const readKey = (env && (env.anonKey || env.key)) || '';

  if (!env || !readKey) return null;

  try {
    const backupKey = getBackupCacheKey({ startMonth, startYear, limit });
    const response = await axios.get(
      `${env.url}/rest/v1/trucky_top_km_cache?select=payload,updated_at&cache_key=eq.${encodeURIComponent(backupKey)}&limit=1`,
      {
        headers: {
          apikey: readKey,
          Authorization: `Bearer ${readKey}`,
        },
        timeout: 8000,
      }
    );

    const rows = Array.isArray(response.data) ? response.data : [];
    const row = rows[0] || null;
    if (!row || !row.payload || typeof row.payload !== 'object') return null;

    return {
      payload: row.payload,
      updatedAt: row.updated_at || null,
    };
  } catch (error) {
    return null;
  }
};

const saveBackupPayload = async ({ startMonth, startYear, limit }, payload) => {
  const env = getSupabaseCacheEnv();
  if (!env || !env.serviceRoleKey) return;

  try {
    const backupKey = getBackupCacheKey({ startMonth, startYear, limit });
    await axios.post(
      `${env.url}/rest/v1/trucky_top_km_cache`,
      [{
        cache_key: backupKey,
        payload,
        updated_at: new Date().toISOString(),
      }],
      {
        headers: {
          apikey: env.serviceRoleKey,
          Authorization: `Bearer ${env.serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        timeout: 10000,
      }
    );
  } catch (error) {
    // No bloquear respuesta principal por fallo de backup.
  }
};

const getCacheEntry = (cacheKey) => {
  if (!accumulatedCache.has(cacheKey)) {
    accumulatedCache.set(cacheKey, {
      payload: null,
      payloadSource: 'memory',
      nextRefreshAt: 0,
      inFlight: null,
      lastError: null,
      retryAttempts: 0,
    });
  }

  return accumulatedCache.get(cacheKey);
};

const scheduleBackgroundRetry = (entry, params) => {
  if (entry.inFlight) return;
  if (entry.retryAttempts >= BACKGROUND_RETRY_MAX_ATTEMPTS) return;

  const delayMs = BACKGROUND_RETRY_BASE_MS * (2 ** Math.min(entry.retryAttempts, 4));
  const timer = setTimeout(() => {
    if (!entry.inFlight) {
      entry.inFlight = refreshCacheEntry(entry, params)
        .finally(() => {
          entry.inFlight = null;
        });
    }
  }, delayMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
};

const refreshCacheEntry = async (entry, params) => {
  try {
    const payload = await buildAccumulatedResponse(params);
    entry.payload = payload;
    entry.payloadSource = 'memory';
    
    // El cache completo se refresca cada 30 min (porque incluye el mes actual)
    entry.nextRefreshAt = Date.now() + CACHE_TTL_CURRENT_MONTH_MS;
    entry.lastError = null;
    entry.retryAttempts = 0;

    await saveBackupPayload(params, payload);
  } catch (error) {
    entry.lastError = {
      message: error.message || 'Error desconocido al actualizar cache',
      at: new Date().toISOString(),
    };

    entry.nextRefreshAt = Date.now() + CACHE_TTL_CURRENT_MONTH_MS;
    entry.retryAttempts += 1;
    scheduleBackgroundRetry(entry, params);
  }
};

router.get('/', async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    let filter = '';
    let month, year;
    if (req.query.month && req.query.year) {
      month = parseInt(req.query.month, 10);
      year = parseInt(req.query.year, 10);
      if (!isNaN(month) && !isNaN(year) && month >= 1 && month <= 12 && year >= 2000 && year <= 3000) {
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 1));
        filter = `&created_at=gte.${startDate.toISOString()}&created_at=lt.${endDate.toISOString()}`;
      }
    }
    // Obtener trabajos filtrados desde jobs_webhooks
    const url = `${SUPABASE_URL}/rest/v1/jobs_webhooks?select=driver_id,driven_distance_km,driver_id,company_id,job_id,status,created_at${filter}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
    });
    const jobs = await response.json();
    // Agrupar por driver_id y sumar driven_distance_km, guardar company_id
    const ranking = {};
    for (const job of jobs) {
      if (!job.driver_id) continue;
      if (!ranking[job.driver_id]) ranking[job.driver_id] = { driver_id: job.driver_id, total_km: 0, jobs: 0, company_id: job.company_id };
      ranking[job.driver_id].total_km += Number(job.driven_distance_km) || 0;
      ranking[job.driver_id].jobs++;
    }
    // Obtener datos de empresa para los company_id únicos
    const companyIds = [...new Set(Object.values(ranking).map(r => r.company_id).filter(Boolean))];
    let companies = [];
    if (companyIds.length > 0) {
      const companiesUrl = `${SUPABASE_URL}/rest/v1/trucky_companies?company_id=in.(${companyIds.join(',')})&select=company_id,name,tag,members_count`;
      const companiesRes = await fetch(companiesUrl, {
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
      });
      companies = await companiesRes.json();
    }
    // Convertir a array y ordenar
    const result = Object.values(ranking).sort((a, b) => b.total_km - a.total_km).slice(0, limit).map(r => {
      const company = companies.find(c => c.company_id === r.company_id) || {};
      return {
        ...r,
        company_name: company.name || null,
        company_tag: company.tag || null,
        company_members: company.members_count || null,
      };
    });
    return res.json({ ok: true, month, year, ranking: result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Error interno', timestamp: Math.floor(Date.now() / 1000) });
  }
});

module.exports = router;
