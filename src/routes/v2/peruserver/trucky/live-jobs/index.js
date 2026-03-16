const { Router } = require('express');
const axios = require('axios');
const { Cache } = require('../../../../../utils/cache');
const {
  startPeriodicProxyUpdate,
  getRandomProxy,
  getCachedProxies,
} = require('../../../../../utils/proxy-manager');

const router = Router();

const PERUSERVER_COMPANIES_URL = 'https://peruserver.pe/wp-json/psv/v1/companies';
const TRUCKY_HEADERS = {
  // User-Agent personalizado según la documentación de Trucky
  'User-Agent': 'peruserver-bot/1.0 (+https://github.com/mdcyt; extracción de datos de empresas para ranking y análisis en peruserver.de)',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://hub.truckyapp.com/',
  Origin: 'https://hub.truckyapp.com',
};

const MAX_DAYS = 10;
const MIN_DAYS = 1;
const DEFAULT_DAYS = 3;
const MAX_JOBS = 300;
const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;
const DEFAULT_COMPANY_BATCH_SIZE = Math.min(
  6,
  Math.max(1, Number.parseInt(process.env.TRUCKY_CONCURRENCY || '4', 10) || 4)
);
const SNAPSHOT_TTL_MS = 45 * 1000;
const SNAPSHOT_DB_MAX_AGE_MS = 90 * 1000;
const TRUCKY_MAX_RETRIES = Math.max(1, Number.parseInt(process.env.TRUCKY_MAX_RETRIES || '3', 10) || 3);
const TRUCKY_RETRY_BASE_MS = Math.max(200, Number.parseInt(process.env.TRUCKY_RETRY_BASE_MS || '700', 10) || 700);
const ROUTE_REDIS_TTL_SECONDS = Math.max(
  3 * 24 * 60 * 60,
  Number.parseInt(process.env.TRUCKY_ROUTE_REDIS_TTL_SECONDS || '259200', 10) || 259200
);

const snapshotCache = new Map();
const routeFullMemoryCache = new Map();
const routeFullRedisCache = process.env.REDIS_URL
  ? new Cache('trucky-route-full', 3, ROUTE_REDIS_TTL_SECONDS)
  : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

startPeriodicProxyUpdate();

const routeCacheGet = async (routeKey) => {
  if (routeFullRedisCache) {
    if (!(await routeFullRedisCache.has(routeKey))) return null;
    return await routeFullRedisCache.get(routeKey);
  }

  const entry = routeFullMemoryCache.get(routeKey);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    routeFullMemoryCache.delete(routeKey);
    return null;
  }

  return entry.value;
};

const routeCacheSet = async (routeKey, value) => {
  if (routeFullRedisCache) {
    await routeFullRedisCache.set(routeKey, value, ROUTE_REDIS_TTL_SECONDS);
    return;
  }

  routeFullMemoryCache.set(routeKey, {
    value,
    expiresAt: Date.now() + ROUTE_REDIS_TTL_SECONDS * 1000,
  });
};
const sanitizeCompanyName = (name) => {
  if (typeof name !== 'string') return '';
  return name.replace(/\s+/g, ' ').trim();
};

const normalizePointKey = (cityId, cityName) => {
  const id = cityId == null ? '' : String(cityId).trim();
  const name = String(cityName || 'Sin nombre')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (id) return `city:${id}`;
  return `name:${name || 'sin-nombre'}`;
};

const buildInFilter = (values) => {
  const serialized = values
    .map((value) => {
      const escaped = String(value).replace(/"/g, '\\"');
      return `"${escaped}"`;
    })
    .join(',');

  return `in.(${serialized})`;
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

const parseCsvStringSet = (rawValue) => {
  if (rawValue == null) return new Set();

  return new Set(
    String(rawValue)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
  );
};

const parseCsvNumberSet = (rawValue) => {
  if (rawValue == null) return new Set();

  return new Set(
    String(rawValue)
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value) && value > 0)
  );
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

// Permite pasar apiKey para x-access-token y loguea cada intento
const truckyRequestWithRetry = async ({ url, params, timeout = 12000, proxyCandidates = [], useProxyPool = true, apiKey = null, companyId = null }) => {
  let lastError = null;

  for (let attempt = 0; attempt < TRUCKY_MAX_RETRIES; attempt += 1) {
    const poolProxy = useProxyPool && proxyCandidates.length === 0 ? getRandomProxy() : null;
    const proxyRaw = proxyCandidates.length > 0
      ? proxyCandidates[attempt % proxyCandidates.length]
      : poolProxy;
    const proxy = parseProxyForAxios(proxyRaw);

    // Headers base + x-access-token si hay apiKey
    const headers = { ...TRUCKY_HEADERS };
    if (apiKey) headers['x-access-token'] = apiKey;

    const logPrefix = `[Trucky][${companyId || 'no-id'}][try ${attempt + 1}]`;
    try {
      console.log(`${logPrefix} GET ${url} ${apiKey ? '[api_key]' : ''}`);
      const response = await axios.get(url, {
        params,
        headers,
        timeout,
        proxy: proxy || undefined,
      });
      console.log(`${logPrefix} OK (${response.status})`);
      return response;
    } catch (error) {
      lastError = error;
      const status = Number(error && error.response && error.response.status);
      const shouldRetry = isRetryableTruckyStatus(status);
      console.warn(`${logPrefix} FAIL (${status || error.code || error.message})`);

      if (!shouldRetry || attempt === TRUCKY_MAX_RETRIES - 1) {
        throw error;
      }

      const waitMs = TRUCKY_RETRY_BASE_MS * (attempt + 1) + Math.floor(Math.random() * 250);
      await sleep(waitMs);
    }
  }

  throw lastError || new Error('Error desconocido consultando Trucky');
};

const normalizeCompaniesSource = (rawSource) => {
  const source = String(rawSource || 'auto').trim().toLowerCase();
  if (['supabase', 'wordpress', 'auto'].includes(source)) return source;
  return 'auto';
};

const getSnapshotCacheKey = ({ days, companiesSource }) => `days-${days}-source-${companiesSource}`;

const getSnapshotFromMemory = ({ days, companiesSource }) => {
  const entry = snapshotCache.get(getSnapshotCacheKey({ days, companiesSource }));
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) return null;
  return entry.payload;
};

const saveSnapshotInMemory = ({ days, companiesSource }, payload) => {
  snapshotCache.set(getSnapshotCacheKey({ days, companiesSource }), {
    payload,
    expiresAt: Date.now() + SNAPSHOT_TTL_MS,
  });
};

const getSnapshotFromSupabase = async ({ days, companiesSource }) => {
  const env = getSupabaseCacheEnv();
  const readKey = (env && (env.anonKey || env.key)) || '';
  if (!env || !readKey) return null;

  try {
    const cacheKey = getSnapshotCacheKey({ days, companiesSource });
    const response = await axios.get(
      `${env.url}/rest/v1/trucky_live_jobs_snapshots?select=payload,updated_at&cache_key=eq.${encodeURIComponent(cacheKey)}&limit=1`,
      {
        headers: {
          apikey: readKey,
          Authorization: `Bearer ${readKey}`,
        },
        timeout: 8000,
      }
    );

    const rows = Array.isArray(response.data) ? response.data : [];
    if (!rows.length) return null;

    const row = rows[0] || {};
    const updatedAt = new Date(row.updated_at || 0).getTime();
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > SNAPSHOT_DB_MAX_AGE_MS) {
      return null;
    }

    if (!row.payload || typeof row.payload !== 'object') {
      return null;
    }

    return row.payload;
  } catch (error) {
    return null;
  }
};

const saveSnapshotInSupabase = async ({ days, companiesSource }, payload) => {
  const env = getSupabaseCacheEnv();
  if (!env || !env.serviceRoleKey) return;

  try {
    await axios.post(
      `${env.url}/rest/v1/trucky_live_jobs_snapshots`,
      [{
        cache_key: getSnapshotCacheKey({ days, companiesSource }),
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
    // La tabla puede no existir. No bloquear la ruta principal.
  }
};

const mapJob = (item, company) => {
  const sourceName = String(item.source_city_name || 'Origen no identificado').trim();
  const destinationName = String(item.destination_city_name || 'Destino no identificado').trim();

  return {
    id: Number(item.id || 0),
    companyId: company.id,
    companyName: company.name,
    updatedAt: item.updated_at || new Date(0).toISOString(),
    startedAt: item.started_at || null,
    status: item.status || 'unknown',
    source: {
      key: normalizePointKey(item.source_city_id, sourceName),
      cityId: item.source_city_id || null,
      cityName: sourceName,
    },
    destination: {
      key: normalizePointKey(item.destination_city_id, destinationName),
      cityId: item.destination_city_id || null,
      cityName: destinationName,
    },
    driverName: (item.driver && item.driver.name && String(item.driver.name).trim()) || 'Sin conductor',
    driverAvatarUrl: item.driver ? item.driver.avatar_url || null : null,
    driverProfileUrl: item.driver ? item.driver.public_url || null : null,
    cargoName: (item.cargo_name && String(item.cargo_name).trim()) || 'Carga no especificada',
    plannedDistanceKm:
      item.planned_distance_km != null ? Number(item.planned_distance_km) :
      item.planned_distance != null ? Number(item.planned_distance) :
      null,
    publicUrl: item.public_url || `https://hub.truckyapp.com/job/${item.id || ''}`,
  };
};

const isWithinLastDays = (item, cutoffMs) => {
  const candidate = item.started_at || item.created_at || item.updated_at;
  if (!candidate) return false;

  const timestamp = new Date(candidate).getTime();
  if (!Number.isFinite(timestamp)) return false;

  return timestamp >= cutoffMs;
};

const fetchCachedPoints = async (pointKeys) => {
  const env = getSupabaseCacheEnv();
  const readKey = (env && (env.anonKey || env.key)) || '';
  if (!env || !pointKeys.length || !readKey) {
    return {};
  }

  try {
    const inFilter = encodeURIComponent(buildInFilter(pointKeys));
    const response = await axios.get(
      `${env.url}/rest/v1/trucky_geo_points?select=*&point_key=${inFilter}`,
      {
        headers: {
          apikey: readKey,
          Authorization: `Bearer ${readKey}`,
        },
        timeout: 15000,
      }
    );

    const rows = Array.isArray(response.data) ? response.data : [];
    const map = {};

    for (const row of rows) {
      const key = row.point_key || '';
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }

      map[key] = {
        lat,
        lng,
        label: row.label || key,
        source: row.source || 'cache',
        updatedAt: row.updated_at || new Date(0).toISOString(),
      };
    }

    return map;
  } catch (error) {
    return {};
  }
};

const fetchCachedRoutes = async (
  routeKeys,
  {
    includeAllCoordinates = false,
    coordinateRouteKeys = new Set(),
  } = {}
) => {
  const env = getSupabaseCacheEnv();
  const readKey = (env && (env.anonKey || env.key)) || '';
  if (!routeKeys.length) {
    return {};
  }

  try {
    const map = {};
    const missingKeys = [];

    // Resolver primero desde Redis/memoria.
    await Promise.all(routeKeys.map(async (key) => {
      try {
        const cached = await routeCacheGet(key);
        if (!cached || !Array.isArray(cached.coordinates) || cached.coordinates.length < 2) {
          missingKeys.push(key);
          return;
        }

        const includeCoordinates = includeAllCoordinates || coordinateRouteKeys.has(key);
        map[key] = {
          coordinates: includeCoordinates ? cached.coordinates : null,
          distanceMeters: Number.isFinite(Number(cached.distanceMeters))
            ? Number(cached.distanceMeters)
            : null,
          durationSeconds: Number.isFinite(Number(cached.durationSeconds))
            ? Number(cached.durationSeconds)
            : null,
          source: 'redis',
          updatedAt: cached.updatedAt || new Date(0).toISOString(),
        };
      } catch (error) {
        missingKeys.push(key);
      }
    }));

    const uniqueMissingKeys = Array.from(new Set(missingKeys));
    if (!uniqueMissingKeys.length) {
      return map;
    }

    if (!env || !readKey) {
      return map;
    }

    const inFilter = encodeURIComponent(buildInFilter(uniqueMissingKeys));
    const baseResponse = await axios.get(
      `${env.url}/rest/v1/trucky_route_cache?select=route_key,distance_meters,duration_seconds,updated_at&route_key=${inFilter}`,
      {
        headers: {
          apikey: readKey,
          Authorization: `Bearer ${readKey}`,
        },
        timeout: 15000,
      }
    );

    const rows = Array.isArray(baseResponse.data) ? baseResponse.data : [];
    const metadataFromSupabase = {};

    for (const row of rows) {
      const key = row.route_key || '';
      if (!key) continue;

      const distanceMeters = row.distance_meters != null ? Number(row.distance_meters) : null;
      const durationSeconds = row.duration_seconds != null ? Number(row.duration_seconds) : null;
      const updatedAt = row.updated_at || new Date(0).toISOString();

      metadataFromSupabase[key] = {
        distanceMeters,
        durationSeconds,
        updatedAt,
      };

      map[key] = {
        coordinates: null,
        distanceMeters,
        durationSeconds,
        source: 'supabase',
        updatedAt,
      };
    }

    // Cargar y persistir rutas completas para faltantes; incluir las solicitadas explícitamente.
    const keysThatNeedCoordinates = Array.from(new Set([
      ...uniqueMissingKeys,
      ...routeKeys.filter((key) => includeAllCoordinates || coordinateRouteKeys.has(key)),
    ]));

    if (!keysThatNeedCoordinates.length) {
      return map;
    }

    const coordinatesFilter = encodeURIComponent(buildInFilter(keysThatNeedCoordinates));
    const coordinatesResponse = await axios.get(
      `${env.url}/rest/v1/trucky_route_cache?select=route_key,coordinates,distance_meters,duration_seconds,updated_at&route_key=${coordinatesFilter}`,
      {
        headers: {
          apikey: readKey,
          Authorization: `Bearer ${readKey}`,
        },
        timeout: 15000,
      }
    );

    const coordinateRows = Array.isArray(coordinatesResponse.data) ? coordinatesResponse.data : [];

    for (const row of coordinateRows) {
      const key = row.route_key || '';
      if (!key || !Array.isArray(row.coordinates) || row.coordinates.length < 2) {
        continue;
      }

      const parsedCoordinates = row.coordinates
        .map((pair) => {
          if (!Array.isArray(pair) || pair.length < 2) return null;
          const lng = Number(pair[0]);
          const lat = Number(pair[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return [lng, lat];
        })
        .filter(Boolean);

      if (parsedCoordinates.length < 2) {
        continue;
      }

      const distanceMeters = row.distance_meters != null
        ? Number(row.distance_meters)
        : (metadataFromSupabase[key] ? metadataFromSupabase[key].distanceMeters : null);
      const durationSeconds = row.duration_seconds != null
        ? Number(row.duration_seconds)
        : (metadataFromSupabase[key] ? metadataFromSupabase[key].durationSeconds : null);
      const updatedAt = row.updated_at || (metadataFromSupabase[key] ? metadataFromSupabase[key].updatedAt : new Date(0).toISOString());

      try {
        await routeCacheSet(key, {
          routeKey: key,
          coordinates: parsedCoordinates,
          distanceMeters,
          durationSeconds,
          updatedAt,
        });
      } catch (error) {
        // No bloquear por fallas puntuales de Redis.
      }

      const includeCoordinates = includeAllCoordinates || coordinateRouteKeys.has(key);

      if (!map[key]) {
        map[key] = {
          coordinates: includeCoordinates ? parsedCoordinates : null,
          distanceMeters,
          durationSeconds,
          source: 'supabase',
          updatedAt,
        };
      } else if (includeCoordinates) {
        map[key].coordinates = parsedCoordinates;
      }
    }

    for (const key of routeKeys) {
      if (!map[key]) {
        map[key] = {
          coordinates: null,
          distanceMeters: null,
          durationSeconds: null,
          source: 'none',
          updatedAt: new Date(0).toISOString(),
        };
      }
    }

    return map;
  } catch (error) {
    return {};
  }
};

const fetchUnresolvedPoints = async (pointKeys) => {
  const env = getSupabaseCacheEnv();
  const readKey = (env && (env.anonKey || env.key)) || '';
  if (!env || !pointKeys.length || !readKey) {
    return [];
  }

  try {
    const inFilter = encodeURIComponent(buildInFilter(pointKeys));
    const response = await axios.get(
      `${env.url}/rest/v1/trucky_unresolved_points?select=*&point_key=${inFilter}&status=eq.pending`,
      {
        headers: {
          apikey: readKey,
          Authorization: `Bearer ${readKey}`,
        },
        timeout: 15000,
      }
    );

    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row) => ({
      pointKey: row.point_key || '',
      cityName: row.city_name || 'Sin nombre',
      cityId: row.city_id || null,
      status: row.status || 'pending',
      lastSeenAt: row.last_seen_at || new Date(0).toISOString(),
    }));
  } catch (error) {
    return [];
  }
};

const fetchBlockedPointKeys = async () => {
  const env = getSupabaseCacheEnv();
  const readKey = (env && (env.anonKey || env.key)) || '';
  if (!env || !readKey) {
    return [];
  }

  try {
    const response = await axios.get(`${env.url}/rest/v1/trucky_blocked_points?select=point_key`, {
      headers: {
        apikey: readKey,
        Authorization: `Bearer ${readKey}`,
      },
      timeout: 15000,
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    return rows
      .map((row) => (row.point_key || '').trim())
      .filter((key) => key.length > 0);
  } catch (error) {
    return [];
  }
};

const upsertUnresolvedPoints = async (points) => {
  const env = getSupabaseCacheEnv();
  if (!env || !points.length || !env.serviceRoleKey) {
    return;
  }

  try {
    await axios.post(
      `${env.url}/rest/v1/trucky_unresolved_points`,
      points.map((point) => ({
        point_key: point.pointKey,
        city_name: point.cityName,
        city_id: point.cityId,
        status: 'pending',
        last_seen_at: new Date().toISOString(),
      })),
      {
        headers: {
          apikey: env.serviceRoleKey,
          Authorization: `Bearer ${env.serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        timeout: 15000,
      }
    );
  } catch (error) {
    // ignorar error para no romper la respuesta principal
  }
};

const fetchRegisteredCompaniesFromSupabase = async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return [];
  }

  try {
    const response = await axios.get(
      `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/trucky_companies?select=company_id,name&order=company_id.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        timeout: 15000,
      }
    );

    const rows = Array.isArray(response.data) ? response.data : [];

    return rows
      .map((row) => ({
        id: Number(row.company_id),
        name: sanitizeCompanyName(row.name) || `Empresa ${row.company_id || 'N/D'}`,
      }))
      .filter((row) => Number.isFinite(row.id) && row.id > 0);
  } catch (error) {
    return [];
  }
};

const fetchRegisteredCompaniesFromWordPress = async () => {
  try {
    const response = await axios.get(PERUSERVER_COMPANIES_URL, {
      timeout: 15000,
    });

    const companies = Array.isArray(response.data) ? response.data : [];

    return companies
      .map((company) => {
        if (Number.isFinite(company)) {
          return {
            id: Number(company),
            name: `Empresa ${company}`,
          };
        }

        const id = Number(company && (company.id || company.company_id || company.empresaId));
        if (!Number.isFinite(id) || id <= 0) return null;

        return {
          id,
          name: sanitizeCompanyName(company.name || company.company_name) || `Empresa ${id}`,
        };
      })
      .filter((row) => row && Number.isFinite(row.id) && row.id > 0);
  } catch (error) {
    return [];
  }
};

const fetchRegisteredCompanies = async (companiesSource = 'auto') => {
  const source = normalizeCompaniesSource(companiesSource);

  if (source === 'supabase') {
    return {
      companies: await fetchRegisteredCompaniesFromSupabase(),
      sourceUsed: 'supabase',
    };
  }

  if (source === 'wordpress') {
    return {
      companies: await fetchRegisteredCompaniesFromWordPress(),
      sourceUsed: 'wordpress',
    };
  }

  const supabaseCompanies = await fetchRegisteredCompaniesFromSupabase();
  if (supabaseCompanies.length > 0) {
    return {
      companies: supabaseCompanies,
      sourceUsed: 'supabase',
    };
  }

  return {
    companies: await fetchRegisteredCompaniesFromWordPress(),
    sourceUsed: 'wordpress',
  };
};

const parseWebhookRawPayload = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const mapWebhookJob = (row, company) => {
  const rawPayload = parseWebhookRawPayload(row.raw);
  const rawData = rawPayload && typeof rawPayload === 'object' ? rawPayload.data || {} : {};
  const sourceName = String(rawData.source_city_name || row.source_city_id || 'Origen no identificado').trim();
  const destinationName = String(rawData.destination_city_name || row.destination_city_id || 'Destino no identificado').trim();

  return {
    id: Number(row.job_id || row.id || 0),
    companyId: company.id,
    companyName: company.name,
    updatedAt: row.updated_at || new Date(0).toISOString(),
    startedAt: rawData.started_at || row.created_at || null,
    status: row.status || 'unknown',
    source: {
      key: normalizePointKey(row.source_city_id, sourceName),
      cityId: row.source_city_id || null,
      cityName: sourceName,
    },
    destination: {
      key: normalizePointKey(row.destination_city_id, destinationName),
      cityId: row.destination_city_id || null,
      cityName: destinationName,
    },
    driverName: (rawData.driver && rawData.driver.name && String(rawData.driver.name).trim()) || 'Sin conductor',
    driverAvatarUrl: rawData.driver ? rawData.driver.avatar_url || null : null,
    driverProfileUrl: rawData.driver ? rawData.driver.public_url || null : null,
    cargoName: (rawData.cargo_name && String(rawData.cargo_name).trim()) || (row.cargo_id ? String(row.cargo_id).trim() : 'Carga no especificada'),
    plannedDistanceKm: row.planned_distance_km != null ? Number(row.planned_distance_km) : null,
    publicUrl: rawData.public_url || `https://hub.truckyapp.com/job/${row.job_id || row.id || ''}`,
  };
};

const fetchLiveJobsFromSupabase = async ({ cutoffMs, companyMap }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Falta configurar SUPABASE_URL o SUPABASE_ANON_KEY');
  }

  const jobs = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const response = await axios.get(
      `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/jobs_webhooks?status=eq.in_progress&select=job_id,company_id,status,source_city_id,destination_city_id,cargo_id,planned_distance_km,created_at,updated_at,raw&order=updated_at.desc&limit=${pageSize}&offset=${offset}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        timeout: 20000,
      }
    );

    const rows = Array.isArray(response.data) ? response.data : [];

    for (const row of rows) {
      if (!isWithinLastDays(row, cutoffMs)) continue;

      const companyId = Number(row.company_id);
      const company = companyMap.get(companyId) || {
        id: companyId,
        name: `Empresa ${Number.isFinite(companyId) && companyId > 0 ? companyId : 'N/D'}`,
      };
      const job = mapWebhookJob(row, company);
      if (job.id > 0) jobs.push(job);
    }

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return jobs;
};

const fetchCompanyJobs = async (company, cutoffMs, proxyCandidates, useProxyPool) => {
  const response = await truckyRequestWithRetry({
    params: {
      top: 0,
      page: 1,
      perPage: 100,
      status: 'in_progress',
      sortingField: 'updated_at',
      sortingDirection: 'desc',
    },
    timeout: 12000,
    proxyCandidates,
    useProxyPool,
  });

  const payload = response.data || {};
  const rows = Array.isArray(payload.data) ? payload.data : [];

  return rows
    .filter((item) => item.status === 'in_progress')
    .filter((item) => isWithinLastDays(item, cutoffMs))
    .map((item) => mapJob(item, company))
    .filter((job) => job.id > 0);
};

const collectJobsFromCompanies = async (companies, cutoffMs, options = {}) => {
  const batchSize = Math.max(1, Number.parseInt(String(options.companyBatchSize || DEFAULT_COMPANY_BATCH_SIZE), 10) || DEFAULT_COMPANY_BATCH_SIZE);
  const proxyCandidates = Array.isArray(options.proxyCandidates) ? options.proxyCandidates : [];
  const useProxyPool = options.useProxyPool !== false;
  const jobs = [];
  const errors = [];
  let forbiddenCount = 0;

  for (let index = 0; index < companies.length; index += batchSize) {
    const chunk = companies.slice(index, index + batchSize);

    const results = await Promise.all(
      chunk.map(async (company) => {
        try {
          const companyJobs = await fetchCompanyJobs(company, cutoffMs, proxyCandidates, useProxyPool);
          return { companyId: company.id, jobs: companyJobs, error: null };
        } catch (error) {
          const statusCode = Number(error && error.response && error.response.status);
          if (statusCode === 403) forbiddenCount += 1;

          const message = error instanceof Error ? error.message : 'Error desconocido';
          return { companyId: company.id, jobs: [], error: message };
        }
      })
    );

    for (const result of results) {
      jobs.push(...result.jobs);
      if (result.error) {
        errors.push({ companyId: result.companyId, message: result.error });
      }
    }
  }

  return {
    jobs,
    errors,
    forbiddenCount,
  };
};

const buildCoreSnapshot = async ({ days, companiesSource, companyBatchSize, proxyCandidates, useProxyPool }) => {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const payload = {
    fetchedAt: new Date().toISOString(),
    days,
    companiesSourceRequested: normalizeCompaniesSource(companiesSource),
    companiesSourceUsed: 'unknown',
    companiesProcessed: 0,
    jobs: [],
    errors: [],
  };

  const { companies, sourceUsed } = await fetchRegisteredCompanies(companiesSource);
  payload.companiesSourceUsed = sourceUsed;
  payload.companiesProcessed = companies.length;

  const companyMap = new Map(companies.map((company) => [company.id, company]));
  payload.jobs = (await fetchLiveJobsFromSupabase({ cutoffMs, companyMap }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_JOBS);
  payload.errors = [];
  return payload;

  if (!companies.length) {
    return payload;
  }

  const initialResult = await collectJobsFromCompanies(companies, cutoffMs, {
    companyBatchSize,
    proxyCandidates,
    useProxyPool,
  });
  let jobs = initialResult.jobs;
  let errors = initialResult.errors;

  const forbiddenRatio = companies.length > 0
    ? initialResult.forbiddenCount / companies.length
    : 0;

  // Si en modo auto Supabase devuelve muchos 403, reintentar con WordPress en la misma petición.
  if (
    payload.companiesSourceRequested === 'auto' &&
    sourceUsed === 'supabase' &&
    jobs.length === 0 &&
    forbiddenRatio >= 0.7
  ) {
    const wordpressCompanies = await fetchRegisteredCompaniesFromWordPress();

    if (wordpressCompanies.length > 0) {
      const fallbackResult = await collectJobsFromCompanies(wordpressCompanies, cutoffMs, {
        companyBatchSize,
        proxyCandidates,
        useProxyPool,
      });
      payload.companiesProcessed = wordpressCompanies.length;
      payload.companiesSourceUsed = 'wordpress';
      jobs = fallbackResult.jobs;
      errors = fallbackResult.errors;
    }
  }

  payload.jobs = jobs
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_JOBS);
  payload.errors = errors;

  return payload;
};

const getCoreSnapshot = async ({ days, useDbCache, companiesSource, companyBatchSize, proxyCandidates, useProxyPool }) => {
  const cacheContext = {
    days,
    companiesSource: normalizeCompaniesSource(companiesSource),
  };

  const memorySnapshot = getSnapshotFromMemory(cacheContext);
  if (memorySnapshot) return memorySnapshot;

  if (useDbCache) {
    const dbSnapshot = await getSnapshotFromSupabase(cacheContext);
    if (dbSnapshot) {
      saveSnapshotInMemory(cacheContext, dbSnapshot);
      return dbSnapshot;
    }
  }

  const freshSnapshot = await buildCoreSnapshot({
    days,
    companiesSource: cacheContext.companiesSource,
    companyBatchSize,
    proxyCandidates,
    useProxyPool,
  });
  saveSnapshotInMemory(cacheContext, freshSnapshot);

  if (useDbCache) {
    await saveSnapshotInSupabase(cacheContext, freshSnapshot);
  }

  return freshSnapshot;
};

const toCompactJob = (job) => ({
  id: job.id,
  companyId: job.companyId,
  companyName: job.companyName,
  updatedAt: job.updatedAt,
  status: job.status,
  source: job.source,
  destination: job.destination,
  cargoName: job.cargoName,
  plannedDistanceKm: job.plannedDistanceKm,
});

const buildGeoPayload = async ({ jobs, includePoints, includeRoutes, includeUnresolved, includeBlocked, includeRouteCoordinates, writeUnresolved }) => {
  const payload = {
    cachedPoints: {},
    cachedRoutes: {},
    unresolvedPoints: [],
    blockedPointKeys: [],
  };

  if (!jobs.length) {
    return payload;
  }

  const pointMap = new Map();
  const routeKeys = new Set();
  const routeByJobId = new Map();

  for (const job of jobs) {
    const routeKey = `${job.source.key}__${job.destination.key}`;

    pointMap.set(job.source.key, {
      pointKey: job.source.key,
      cityName: job.source.cityName,
      cityId: job.source.cityId,
    });
    pointMap.set(job.destination.key, {
      pointKey: job.destination.key,
      cityName: job.destination.cityName,
      cityId: job.destination.cityId,
    });
    routeKeys.add(routeKey);
    routeByJobId.set(job.id, routeKey);
  }

  const pointKeys = Array.from(pointMap.keys());

  const selectiveRouteKeys = new Set();
  if (includeRouteCoordinates && includeRouteCoordinates !== true) {
    const routeKeysSet = includeRouteCoordinates.routeKeys || new Set();
    for (const routeKey of routeKeysSet) {
      selectiveRouteKeys.add(routeKey);
    }

    const jobIdsSet = includeRouteCoordinates.jobIds || new Set();
    for (const jobId of jobIdsSet) {
      const routeKey = routeByJobId.get(jobId);
      if (routeKey) selectiveRouteKeys.add(routeKey);
    }
  }

  const includeAllCoordinates = includeRouteCoordinates === true;

  const [blockedPointKeys, cachedPoints, cachedRoutes, unresolvedPoints] = await Promise.all([
    includeBlocked ? fetchBlockedPointKeys() : Promise.resolve([]),
    includePoints || includeUnresolved ? fetchCachedPoints(pointKeys) : Promise.resolve({}),
    includeRoutes
      ? fetchCachedRoutes(Array.from(routeKeys), {
          includeAllCoordinates,
          coordinateRouteKeys: selectiveRouteKeys,
        })
      : Promise.resolve({}),
    includeUnresolved ? fetchUnresolvedPoints(pointKeys) : Promise.resolve([]),
  ]);

  payload.blockedPointKeys = blockedPointKeys;
  payload.cachedPoints = cachedPoints;
  payload.cachedRoutes = cachedRoutes;
  payload.unresolvedPoints = includeUnresolved
    ? unresolvedPoints.filter((point) => !cachedPoints[point.pointKey])
    : [];

  if (includeUnresolved && writeUnresolved) {
    const unresolvedSet = new Set(payload.unresolvedPoints.map((point) => point.pointKey));
    const unresolvedToUpsert = Array.from(pointMap.values()).filter(
      (point) => !cachedPoints[point.pointKey] && !unresolvedSet.has(point.pointKey)
    );

    if (unresolvedToUpsert.length > 0) {
      await upsertUnresolvedPoints(unresolvedToUpsert);
      payload.unresolvedPoints = [
        ...payload.unresolvedPoints,
        ...unresolvedToUpsert.map((point) => ({
          pointKey: point.pointKey,
          cityName: point.cityName,
          cityId: point.cityId,
          status: 'pending',
          lastSeenAt: new Date().toISOString(),
        })),
      ];
    }
  }

  return payload;
};

const paginateJobs = (jobs, page, perPage) => {
  const totalJobs = jobs.length;
  const totalPages = Math.max(1, Math.ceil(totalJobs / perPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const offset = (safePage - 1) * perPage;

  return {
    mode: 'page',
    page: safePage,
    perPage,
    totalJobs,
    totalPages,
    fromJobId: null,
    nextFromJobId: jobs[offset + perPage] ? jobs[offset + perPage - 1].id : null,
    items: jobs.slice(offset, offset + perPage),
  };
};

const paginateJobsFromId = (jobs, fromJobId, perPage) => {
  const totalJobs = jobs.length;

  let startIndex = 0;
  if (fromJobId != null) {
    const currentIndex = jobs.findIndex((job) => job.id === fromJobId);
    startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  }

  const items = jobs.slice(startIndex, startIndex + perPage);
  const lastItem = items[items.length - 1] || null;
  const hasMore = startIndex + items.length < totalJobs;

  return {
    mode: 'cursor',
    page: null,
    perPage,
    totalJobs,
    totalPages: null,
    fromJobId,
    nextFromJobId: hasMore && lastItem ? lastItem.id : null,
    items,
  };
};

const parseRequestOptions = (query) => {
  const days = parsePositiveInt(query.days, DEFAULT_DAYS, MIN_DAYS, MAX_DAYS);
  const page = parsePositiveInt(query.page, 1, 1, 10000);
  const perPage = parsePositiveInt(query.perPage, DEFAULT_PER_PAGE, 1, MAX_PER_PAGE);

  return {
    days,
    page,
    perPage,
    companiesSource: normalizeCompaniesSource(query.companiesSource),
    companyBatchSize: parsePositiveInt(query.companyBatchSize, DEFAULT_COMPANY_BATCH_SIZE, 1, 10),
    disableProxy: parseBoolean(query.disableProxy, false),
    fromJobId: query.fromJobId != null ? parsePositiveInt(query.fromJobId, null, 1, Number.MAX_SAFE_INTEGER) : null,
    compactJobs: parseBoolean(query.compactJobs, true),
    includePoints: parseBoolean(query.includePoints, false),
    includeRoutes: parseBoolean(query.includeRoutes, false),
    includeRouteCoordinates: parseBoolean(query.includeRouteCoordinates, false),
    coordinatesForRouteKeys: parseCsvStringSet(query.coordinatesForRouteKeys),
    coordinatesForJobIds: parseCsvNumberSet(query.coordinatesForJobIds),
    includeUnresolved: parseBoolean(query.includeUnresolved, false),
    includeBlocked: parseBoolean(query.includeBlocked, false),
    includeErrors: parseBoolean(query.includeErrors, true),
    writeUnresolved: parseBoolean(query.writeUnresolved, false),
    useDbCache: parseBoolean(query.useDbCache, true),
  };
};

router.get('/', async (req, res) => {
  try {
    const options = parseRequestOptions(req.query);
    const snapshot = await getCoreSnapshot({
      days: options.days,
      useDbCache: options.useDbCache,
      companiesSource: options.companiesSource,
      companyBatchSize: options.companyBatchSize,
      proxyCandidates: [],
      useProxyPool: false,
    });

    return res.json({ ok: true, jobs: snapshot.jobs });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Error interno', jobs: [] });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const options = parseRequestOptions(req.query);
    const snapshot = await getCoreSnapshot({
      days: options.days,
      useDbCache: options.useDbCache,
      companiesSource: options.companiesSource,
      companyBatchSize: options.companyBatchSize,
      proxyCandidates: [],
      useProxyPool: false,
    });

    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=15');
    return res.json({
      fetchedAt: snapshot.fetchedAt,
      days: options.days,
      companiesSourceRequested: options.companiesSource,
      companiesSourceUsed: snapshot.companiesSourceUsed || options.companiesSource,
      truckyRequestConfig: {
        companyBatchSize: options.companyBatchSize,
        explicitProxiesCount: 0,
        useProxyPool: false,
        proxyPoolSize: 0,
      },
      companiesProcessed: snapshot.companiesProcessed,
      totalJobs: snapshot.jobs.length,
      errorsCount: snapshot.errors.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: message });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const options = parseRequestOptions(req.query);
    const snapshot = await getCoreSnapshot({
      days: options.days,
      useDbCache: options.useDbCache,
      companiesSource: options.companiesSource,
      companyBatchSize: options.companyBatchSize,
      proxyCandidates: [],
      useProxyPool: false,
    });
    const paginated = options.fromJobId != null
      ? paginateJobsFromId(snapshot.jobs, options.fromJobId, options.perPage)
      : paginateJobs(snapshot.jobs, options.page, options.perPage);

    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=15');
    return res.json({
      fetchedAt: snapshot.fetchedAt,
      days: options.days,
      companiesSourceRequested: options.companiesSource,
      companiesSourceUsed: snapshot.companiesSourceUsed || options.companiesSource,
      truckyRequestConfig: {
        companyBatchSize: options.companyBatchSize,
        explicitProxiesCount: 0,
        useProxyPool: false,
        proxyPoolSize: 0,
      },
      pagination: {
        mode: paginated.mode,
        page: paginated.page,
        fromJobId: paginated.fromJobId,
        nextFromJobId: paginated.nextFromJobId,
        perPage: paginated.perPage,
        totalJobs: paginated.totalJobs,
        totalPages: paginated.totalPages,
      },
      jobs: options.compactJobs ? paginated.items.map(toCompactJob) : paginated.items,
      errors: options.includeErrors ? snapshot.errors : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: message, jobs: [] });
  }
});

router.get('/geo', async (req, res) => {
  try {
    const options = parseRequestOptions(req.query);
    const snapshot = await getCoreSnapshot({
      days: options.days,
      useDbCache: options.useDbCache,
      companiesSource: options.companiesSource,
      companyBatchSize: options.companyBatchSize,
      proxyCandidates: [],
      useProxyPool: false,
    });
    const paginated = options.fromJobId != null
      ? paginateJobsFromId(snapshot.jobs, options.fromJobId, options.perPage)
      : paginateJobs(snapshot.jobs, options.page, options.perPage);

    const includeRouteCoordinates = options.includeRouteCoordinates
      ? (options.coordinatesForRouteKeys.size > 0 || options.coordinatesForJobIds.size > 0
          ? {
              routeKeys: options.coordinatesForRouteKeys,
              jobIds: options.coordinatesForJobIds,
            }
          : true)
      : false;

    const geoPayload = await buildGeoPayload({
      jobs: paginated.items,
      includePoints: parseBoolean(req.query.includePoints, true),
      includeRoutes: parseBoolean(req.query.includeRoutes, true),
      includeUnresolved: parseBoolean(req.query.includeUnresolved, true),
      includeBlocked: parseBoolean(req.query.includeBlocked, true),
      includeRouteCoordinates,
      writeUnresolved: options.writeUnresolved,
    });

    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=15');
    return res.json({
      fetchedAt: snapshot.fetchedAt,
      days: options.days,
      companiesSourceRequested: options.companiesSource,
      companiesSourceUsed: snapshot.companiesSourceUsed || options.companiesSource,
      truckyRequestConfig: {
        companyBatchSize: options.companyBatchSize,
        explicitProxiesCount: 0,
        useProxyPool: false,
        proxyPoolSize: 0,
      },
      pagination: {
        mode: paginated.mode,
        page: paginated.page,
        fromJobId: paginated.fromJobId,
        nextFromJobId: paginated.nextFromJobId,
        perPage: paginated.perPage,
        totalJobs: paginated.totalJobs,
        totalPages: paginated.totalPages,
      },
      jobs: options.compactJobs ? paginated.items.map(toCompactJob) : paginated.items,
      ...geoPayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: message });
  }
});

module.exports = router;
