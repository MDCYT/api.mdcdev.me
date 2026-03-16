const { Router } = require('express');
const axios = require('axios');

const router = Router();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CACHE_TTL_MS = 30 * 60 * 1000;

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
    return { error: 'El parametro month debe estar entre 1 y 12' };
  }

  if (year < 2000 || year > 3000) {
    return { error: 'El parametro year no es valido' };
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

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

const getSupabaseHeaders = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY');
  }

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
};

const fetchMonthlyJobs = async (month, year) => {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));
  const pageSize = 1000;
  const jobs = [];
  let offset = 0;

  while (true) {
    const response = await axios.get(
      `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/jobs_webhooks?created_at=gte.${startDate.toISOString()}&created_at=lt.${endDate.toISOString()}&select=company_id,driven_distance_km,real_driven_distance_km,job_id,created_at&order=created_at.asc&limit=${pageSize}&offset=${offset}`,
      {
        headers: getSupabaseHeaders(),
        timeout: 20000,
      }
    );

    const rows = Array.isArray(response.data) ? response.data : [];
    jobs.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return jobs;
};

const fetchCompaniesMap = async (companyIds) => {
  const companiesMap = new Map();

  for (const batch of chunkArray(companyIds, 150)) {
    const response = await axios.get(
      `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/trucky_companies?company_id=in.(${batch.join(',')})&select=company_id,name,tag,members_count`,
      {
        headers: getSupabaseHeaders(),
        timeout: 15000,
      }
    );

    const rows = Array.isArray(response.data) ? response.data : [];
    for (const row of rows) {
      companiesMap.set(Number(row.company_id), row);
    }
  }

  return companiesMap;
};

const buildMonthlyResponse = async ({ month, year, limit }) => {
  const jobs = await fetchMonthlyJobs(month, year);
  const rankingMap = new Map();

  for (const job of jobs) {
    const companyId = Number(job.company_id);
    if (!Number.isFinite(companyId) || companyId <= 0) continue;

    if (!rankingMap.has(companyId)) {
      rankingMap.set(companyId, {
        id: companyId,
        total_distance: 0,
        total_jobs: 0,
        months_processed: 1,
        months_with_errors: 0,
      });
    }

    const item = rankingMap.get(companyId);
    const distance = Number(job.driven_distance_km ?? job.real_driven_distance_km) || 0;
    item.total_distance += distance;
    item.total_jobs += 1;
  }

  const companiesMap = await fetchCompaniesMap([...rankingMap.keys()]);
  const items = [...rankingMap.values()]
    .map((item) => {
      const company = companiesMap.get(item.id) || {};
      return {
        ...item,
        name: company.name || `Empresa ${item.id}`,
        tag: company.tag || '',
        members: Number.isFinite(Number(company.members_count)) ? Number(company.members_count) : null,
      };
    })
    .sort((a, b) => b.total_distance - a.total_distance)
    .slice(0, limit);

  const generatedAt = nowUtc();

  return {
    ok: true,
    limit,
    period: {
      from: { month, year },
      to: { month, year },
      total_months: 1,
    },
    count_companies_total: rankingMap.size,
    count_companies_processed: items.length,
    items,
    timestamp: Math.floor(generatedAt.getTime() / 1000),
    timestamp_human: formatTimestampHuman(generatedAt),
    note: 'Kilometros del mes seleccionado',
  };
};

const getCacheKey = ({ month, year, limit }) => `monthly-${year}-${month}-${limit}`;
const getBackupCacheKey = ({ month, year, limit }) => `monthly-${year}-${month}-${limit}`;

const fetchBackupPayload = async ({ month, year, limit }) => {
  const env = getSupabaseCacheEnv();
  const readKey = (env && (env.anonKey || env.key)) || '';

  if (!env || !readKey) return null;

  try {
    const response = await axios.get(
      `${env.url}/rest/v1/trucky_top_km_cache?select=payload,updated_at&cache_key=eq.${encodeURIComponent(getBackupCacheKey({ month, year, limit }))}&limit=1`,
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

const saveBackupPayload = async ({ month, year, limit }, payload) => {
  const env = getSupabaseCacheEnv();
  if (!env || !env.serviceRoleKey) return;

  try {
    await axios.post(
      `${env.url}/rest/v1/trucky_top_km_cache`,
      [{
        cache_key: getBackupCacheKey({ month, year, limit }),
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
  if (!monthlyCache.has(cacheKey)) {
    monthlyCache.set(cacheKey, {
      payload: null,
      payloadSource: 'memory',
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
    entry.payloadSource = 'memory';
    entry.nextRefreshAt = Date.now() + CACHE_TTL_MS;
    entry.lastError = null;

    await saveBackupPayload(params, payload);
  } catch (error) {
    entry.lastError = {
      message: error.message || 'Error desconocido al actualizar cache',
      at: new Date().toISOString(),
    };
    entry.nextRefreshAt = Date.now() + CACHE_TTL_MS;
    throw error;
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
    const cacheKey = getCacheKey({ month, year, limit });
    const entry = getCacheEntry(cacheKey);
    const forceRefresh = parseBoolean(req.query.refresh, false);
    const shouldRefresh = forceRefresh || !entry.payload || Date.now() >= entry.nextRefreshAt;

    if (shouldRefresh && !entry.inFlight) {
      entry.inFlight = refreshCacheEntry(entry, { month, year, limit })
        .finally(() => {
          entry.inFlight = null;
        });
    }

    if (entry.inFlight && !entry.payload) {
      try {
        await entry.inFlight;
      } catch (error) {
        const backup = await fetchBackupPayload({ month, year, limit });
        if (backup && backup.payload) {
          entry.payload = backup.payload;
          entry.payloadSource = 'backup';
          entry.nextRefreshAt = Date.now() + CACHE_TTL_MS;
        } else {
          throw error;
        }
      }
    }

    if (!entry.payload) {
      throw new Error('No se pudo generar el top mensual');
    }

    return res.json({
      ...entry.payload,
      cache: {
        source: entry.payloadSource,
        stale: shouldRefresh && Boolean(entry.lastError),
        next_refresh_at: entry.nextRefreshAt,
        last_error: entry.lastError,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error interno',
      timestamp: Math.floor(Date.now() / 1000),
    });
  }
});

module.exports = router;
