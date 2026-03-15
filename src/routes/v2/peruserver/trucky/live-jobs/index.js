const { Router } = require('express');
const axios = require('axios');

const router = Router();

const TRUCKY_BASE_URL = 'https://e.truckyapp.com/api/v1/company';
const TRUCKY_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
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
const COMPANY_BATCH_SIZE = 6;
const SNAPSHOT_TTL_MS = 45 * 1000;
const SNAPSHOT_DB_MAX_AGE_MS = 90 * 1000;

const snapshotCache = new Map();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

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

const getSnapshotCacheKey = (days) => `days-${days}`;

const getSnapshotFromMemory = (days) => {
  const entry = snapshotCache.get(getSnapshotCacheKey(days));
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) return null;
  return entry.payload;
};

const saveSnapshotInMemory = (days, payload) => {
  snapshotCache.set(getSnapshotCacheKey(days), {
    payload,
    expiresAt: Date.now() + SNAPSHOT_TTL_MS,
  });
};

const getSnapshotFromSupabase = async (days) => {
  const env = getSupabaseCacheEnv();
  const readKey = (env && (env.anonKey || env.key)) || '';
  if (!env || !readKey) return null;

  try {
    const cacheKey = getSnapshotCacheKey(days);
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

const saveSnapshotInSupabase = async (days, payload) => {
  const env = getSupabaseCacheEnv();
  if (!env || !env.serviceRoleKey) return;

  try {
    await axios.post(
      `${env.url}/rest/v1/trucky_live_jobs_snapshots`,
      [{
        cache_key: getSnapshotCacheKey(days),
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
  if (!env || !routeKeys.length || !readKey) {
    return {};
  }

  try {
    const inFilter = encodeURIComponent(buildInFilter(routeKeys));
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
    const map = {};

    for (const row of rows) {
      const key = row.route_key || '';
      if (!key) continue;

      map[key] = {
        coordinates: null,
        distanceMeters: row.distance_meters != null ? Number(row.distance_meters) : null,
        durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
        source: 'cache',
        updatedAt: row.updated_at || new Date(0).toISOString(),
      };
    }

    const routeKeysWithCoordinates = includeAllCoordinates
      ? routeKeys
      : routeKeys.filter((key) => coordinateRouteKeys.has(key));

    if (!routeKeysWithCoordinates.length) {
      return map;
    }

    const coordinatesFilter = encodeURIComponent(buildInFilter(routeKeysWithCoordinates));
    const coordinatesResponse = await axios.get(
      `${env.url}/rest/v1/trucky_route_cache?select=route_key,coordinates&route_key=${coordinatesFilter}`,
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

      if (!map[key]) {
        map[key] = {
          coordinates: parsedCoordinates,
          distanceMeters: null,
          durationSeconds: null,
          source: 'cache',
          updatedAt: new Date(0).toISOString(),
        };
      } else {
        map[key].coordinates = parsedCoordinates;
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

const fetchRegisteredCompanies = async () => {
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

const fetchCompanyJobs = async (company, cutoffMs) => {
  const response = await axios.get(`${TRUCKY_BASE_URL}/${company.id}/jobs`, {
    params: {
      top: 0,
      page: 1,
      perPage: 100,
      status: 'in_progress',
      sortingField: 'updated_at',
      sortingDirection: 'desc',
    },
    headers: TRUCKY_HEADERS,
    timeout: 12000,
  });

  const payload = response.data || {};
  const rows = Array.isArray(payload.data) ? payload.data : [];

  return rows
    .filter((item) => item.status === 'in_progress')
    .filter((item) => isWithinLastDays(item, cutoffMs))
    .map((item) => mapJob(item, company))
    .filter((job) => job.id > 0);
};

const buildCoreSnapshot = async (days) => {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const payload = {
    fetchedAt: new Date().toISOString(),
    days,
    companiesProcessed: 0,
    jobs: [],
    errors: [],
  };

  const companies = await fetchRegisteredCompanies();
  payload.companiesProcessed = companies.length;

  if (!companies.length) {
    return payload;
  }

  const allJobs = [];

  for (let index = 0; index < companies.length; index += COMPANY_BATCH_SIZE) {
    const chunk = companies.slice(index, index + COMPANY_BATCH_SIZE);

    const results = await Promise.all(
      chunk.map(async (company) => {
        try {
          const jobs = await fetchCompanyJobs(company, cutoffMs);
          return { companyId: company.id, jobs, error: null };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          return { companyId: company.id, jobs: [], error: message };
        }
      })
    );

    for (const result of results) {
      allJobs.push(...result.jobs);
      if (result.error) {
        payload.errors.push({ companyId: result.companyId, message: result.error });
      }
    }
  }

  payload.jobs = allJobs
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_JOBS);

  return payload;
};

const getCoreSnapshot = async (days, useDbCache) => {
  const memorySnapshot = getSnapshotFromMemory(days);
  if (memorySnapshot) return memorySnapshot;

  if (useDbCache) {
    const dbSnapshot = await getSnapshotFromSupabase(days);
    if (dbSnapshot) {
      saveSnapshotInMemory(days, dbSnapshot);
      return dbSnapshot;
    }
  }

  const freshSnapshot = await buildCoreSnapshot(days);
  saveSnapshotInMemory(days, freshSnapshot);

  if (useDbCache) {
    await saveSnapshotInSupabase(days, freshSnapshot);
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
    const snapshot = await getCoreSnapshot(options.days, options.useDbCache);
    const paginated = options.fromJobId != null
      ? paginateJobsFromId(snapshot.jobs, options.fromJobId, options.perPage)
      : paginateJobs(snapshot.jobs, options.page, options.perPage);
    const jobs = options.compactJobs
      ? paginated.items.map(toCompactJob)
      : paginated.items;

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
      includePoints: options.includePoints,
      includeRoutes: options.includeRoutes,
      includeUnresolved: options.includeUnresolved,
      includeBlocked: options.includeBlocked,
      includeRouteCoordinates,
      writeUnresolved: options.writeUnresolved,
    });

    const responsePayload = {
      fetchedAt: snapshot.fetchedAt,
      days: options.days,
      companiesProcessed: snapshot.companiesProcessed,
      pagination: {
        mode: paginated.mode,
        page: paginated.page,
        fromJobId: paginated.fromJobId,
        nextFromJobId: paginated.nextFromJobId,
        perPage: paginated.perPage,
        totalJobs: paginated.totalJobs,
        totalPages: paginated.totalPages,
      },
      jobs,
      cachedPoints: geoPayload.cachedPoints,
      cachedRoutes: geoPayload.cachedRoutes,
      unresolvedPoints: geoPayload.unresolvedPoints,
      blockedPointKeys: geoPayload.blockedPointKeys,
      errors: options.includeErrors ? snapshot.errors : [],
    };

    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=15');
    return res.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    res.set('Cache-Control', 'no-store, no-cache');
    return res.status(500).json({
      fetchedAt: new Date().toISOString(),
      error: message,
      jobs: [],
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const options = parseRequestOptions(req.query);
    const snapshot = await getCoreSnapshot(options.days, options.useDbCache);

    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=15');
    return res.json({
      fetchedAt: snapshot.fetchedAt,
      days: options.days,
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
    const snapshot = await getCoreSnapshot(options.days, options.useDbCache);
    const paginated = options.fromJobId != null
      ? paginateJobsFromId(snapshot.jobs, options.fromJobId, options.perPage)
      : paginateJobs(snapshot.jobs, options.page, options.perPage);

    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=15');
    return res.json({
      fetchedAt: snapshot.fetchedAt,
      days: options.days,
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
    const snapshot = await getCoreSnapshot(options.days, options.useDbCache);
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
      pagination: {
        mode: paginated.mode,
        page: paginated.page,
        fromJobId: paginated.fromJobId,
        nextFromJobId: paginated.nextFromJobId,
        perPage: paginated.perPage,
        totalJobs: paginated.totalJobs,
        totalPages: paginated.totalPages,
      },
      ...geoPayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: message });
  }
});

module.exports = router;
