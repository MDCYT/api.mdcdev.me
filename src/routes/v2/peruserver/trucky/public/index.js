const { Router } = require('express');
const axios = require('axios');

const router = Router();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const DEFAULT_COMPANIES_LIMIT = 50;
const MAX_COMPANIES_LIMIT = 200;
const DEFAULT_USERS_LIMIT = 10;
const MAX_USERS_LIMIT = 50;
const DEFAULT_ROUTES_LIMIT = 20;
const MAX_ROUTES_LIMIT = 100;
const DEFAULT_ROUTE_JOBS_LIMIT = 500;
const MAX_ROUTE_JOBS_LIMIT = 2000;
const PAGE_SIZE = 1000;

const SAFE_COMPANY_SELECT = [
  'company_id',
  'name',
  'tag',
  'avatar_url',
  'cover_url',
  'public_url',
  'members_count',
  'country_code',
  'recruitment',
  'slogan',
  'created_at',
  'updated_at',
].join(',');

const nowUtc = () => new Date();

const formatTimestampHuman = (date) => {
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

const getSupabaseBaseUrl = () => (SUPABASE_URL || '').replace(/\/+$/, '');

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

const parsePositiveInt = (rawValue, defaultValue, minValue, maxValue) => {
  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, minValue), maxValue);
};

const parseBoolean = (rawValue, defaultValue) => {
  if (rawValue == null) return defaultValue;
  const normalized = String(rawValue).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const parseCsvNumberList = (rawValue) => {
  if (rawValue == null) return [];

  return Array.from(new Set(
    String(rawValue)
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
  ));
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

const parseDateInput = (rawValue, fallbackSuffix) => {
  if (!rawValue) return null;
  const value = String(rawValue).trim();
  if (!value) return null;

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}${fallbackSuffix}`)
    : new Date(value);

  if (!Number.isFinite(candidate.getTime())) {
    return null;
  }

  return candidate;
};

const parsePeriod = (query) => {
  const allTime = parseBoolean(query.allTime ?? query.all, false);
  if (allTime) {
    return {
      allTime: true,
      startIso: null,
      endIso: null,
      label: 'all_time',
      from: null,
      to: null,
    };
  }

  const fromDate = parseDateInput(query.from ?? query.start, 'T00:00:00.000Z');
  const toDate = parseDateInput(query.to ?? query.end, 'T23:59:59.999Z');

  if ((query.from || query.start) && !fromDate) {
    return { error: 'El parametro from no es una fecha valida' };
  }

  if ((query.to || query.end) && !toDate) {
    return { error: 'El parametro to no es una fecha valida' };
  }

  if (fromDate || toDate) {
    const start = fromDate || new Date(Date.UTC(2000, 0, 1));
    const end = toDate || nowUtc();

    if (start.getTime() > end.getTime()) {
      return { error: 'El rango de fechas no es valido: from no puede ser mayor que to' };
    }

    return {
      allTime: false,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: 'custom',
      from: start.toISOString(),
      to: end.toISOString(),
    };
  }

  const currentDate = nowUtc();
  const month = parsePositiveInt(query.month ?? query.mes, currentDate.getUTCMonth() + 1, 1, 12);
  const year = parsePositiveInt(query.year ?? query.anio, currentDate.getUTCFullYear(), 2000, currentDate.getUTCFullYear() + 20);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  return {
    allTime: false,
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
    label: 'month',
    from: startDate.toISOString(),
    to: endDate.toISOString(),
    month,
    year,
  };
};

const normalizeStatus = (rawValue) => {
  const normalized = String(rawValue || 'completed').trim().toLowerCase();
  if (['all', 'completed', 'in_progress', 'cancelled', 'canceled'].includes(normalized)) {
    return normalized === 'cancelled' ? 'canceled' : normalized;
  }

  return 'completed';
};

const mapCompany = (row) => ({
  id: Number(row.company_id),
  name: sanitizeCompanyName(row.name) || `Empresa ${row.company_id || 'N/D'}`,
  tag: row.tag || '',
  avatarUrl: row.avatar_url || null,
  coverUrl: row.cover_url || null,
  publicUrl: row.public_url || null,
  membersCount: Number.isFinite(Number(row.members_count)) ? Number(row.members_count) : null,
  countryCode: row.country_code || null,
  recruitment: row.recruitment || null,
  slogan: row.slogan || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const fetchCompanies = async (companyIds = null) => {
  const headers = getSupabaseHeaders();
  const companies = [];
  const batches = companyIds == null || companyIds.length === 0 ? [null] : chunkArray(companyIds, 150);

  for (const batch of batches) {
    let offset = 0;

    while (true) {
      const params = new URLSearchParams();
      params.set('select', SAFE_COMPANY_SELECT);
      params.set('order', 'name.asc');
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));

      if (batch && batch.length > 0) {
        params.append('company_id', `in.(${batch.join(',')})`);
      }

      const response = await axios.get(`${getSupabaseBaseUrl()}/rest/v1/trucky_companies?${params.toString()}`, {
        headers,
        timeout: 15000,
      });

      const rows = Array.isArray(response.data) ? response.data : [];
      companies.push(...rows.map(mapCompany));

      if (batch || rows.length < PAGE_SIZE) {
        break;
      }

      offset += PAGE_SIZE;
    }
  }

  return companies;
};

const fetchCompanyById = async (companyId) => {
  const headers = getSupabaseHeaders();
  const params = new URLSearchParams();
  params.set('select', SAFE_COMPANY_SELECT);
  params.append('company_id', `eq.${companyId}`);
  params.set('limit', '1');

  const response = await axios.get(`${getSupabaseBaseUrl()}/rest/v1/trucky_companies?${params.toString()}`, {
    headers,
    timeout: 15000,
  });

  const rows = Array.isArray(response.data) ? response.data : [];
  return rows[0] ? mapCompany(rows[0]) : null;
};

const fetchJobs = async ({ select, period, companyIds = [], status, jobsLimit = null, jobsOrder = 'asc' }) => {
  const headers = getSupabaseHeaders();
  const jobs = [];
  let offset = 0;
  const safeJobsLimit = Number.isFinite(Number(jobsLimit)) && Number(jobsLimit) > 0
    ? Math.min(Number(jobsLimit), MAX_ROUTE_JOBS_LIMIT)
    : null;
  const safeJobsOrder = String(jobsOrder || 'asc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
  const safeCompanyIds = Array.isArray(companyIds) ? companyIds : [];

  while (true) {
    const params = new URLSearchParams();
    params.set('select', select);
    params.set('order', `created_at.${safeJobsOrder}`);
    params.set('limit', String(safeJobsLimit == null ? PAGE_SIZE : Math.min(PAGE_SIZE, safeJobsLimit - jobs.length)));
    params.set('offset', String(offset));

    if (period.startIso) params.append('created_at', `gte.${period.startIso}`);
    if (period.endIso) params.append('created_at', `lt.${period.endIso}`);
    if (safeCompanyIds.length > 0) params.append('company_id', `in.(${safeCompanyIds.join(',')})`);
    if (status !== 'all') params.append('status', `eq.${status}`);

    const response = await axios.get(`${getSupabaseBaseUrl()}/rest/v1/jobs_webhooks?${params.toString()}`, {
      headers,
      timeout: 30000,
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    if (safeJobsLimit == null) {
      jobs.push(...rows);
    } else {
      jobs.push(...rows.slice(0, Math.max(0, safeJobsLimit - jobs.length)));
    }

    if (rows.length < PAGE_SIZE || (safeJobsLimit != null && jobs.length >= safeJobsLimit)) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return jobs;
};

const fetchRouteMetadata = async (routeKeys, includeCoordinates) => {
  if (!routeKeys.length) return new Map();

  const headers = getSupabaseHeaders();
  const routeMap = new Map();
  const batches = chunkArray(routeKeys, 80);

  for (const batch of batches) {
    const params = new URLSearchParams();
    params.set(
      'select',
      includeCoordinates
        ? 'route_key,from_point_key,to_point_key,coordinates,distance_meters,duration_seconds,updated_at'
        : 'route_key,from_point_key,to_point_key,distance_meters,duration_seconds,updated_at'
    );
    params.append('route_key', `in.(${batch.map((key) => `"${key}"`).join(',')})`);

    const response = await axios.get(`${getSupabaseBaseUrl()}/rest/v1/trucky_route_cache?${params.toString()}`, {
      headers,
      timeout: 15000,
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    for (const row of rows) {
      const coordinates = Array.isArray(row.coordinates)
        ? row.coordinates
          .map((point) => {
            if (!Array.isArray(point) || point.length < 2) return null;
            const lng = Number(point[0]);
            const lat = Number(point[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return [lng, lat];
          })
          .filter(Boolean)
        : null;

      routeMap.set(row.route_key, {
        routeKey: row.route_key,
        fromPointKey: row.from_point_key || null,
        toPointKey: row.to_point_key || null,
        distanceMeters: row.distance_meters != null ? Number(row.distance_meters) : null,
        durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
        updatedAt: row.updated_at || null,
        coordinates: includeCoordinates ? coordinates : null,
      });
    }
  }

  return routeMap;
};

const parseDriverFromRaw = (row) => {
  const rawPayload = parseWebhookRawPayload(row.raw);
  const rawData = rawPayload && typeof rawPayload === 'object' ? rawPayload.data || {} : {};
  const driver = rawData.driver && typeof rawData.driver === 'object' ? rawData.driver : {};

  return {
    id: Number(row.driver_id || driver.id || 0),
    name: driver.name ? String(driver.name).trim() : `Usuario ${row.driver_id || driver.id || 'N/D'}`,
    avatarUrl: driver.avatar_url || null,
    publicUrl: driver.public_url || null,
  };
};

const driverProfileCache = new Map();
const DRIVER_PROFILE_TTL_MS = 60 * 60 * 1000; // 1 hora

const getDriverProfile = (driverId) => {
  const cached = driverProfileCache.get(Number(driverId));
  if (cached && Date.now() - cached.cachedAt < DRIVER_PROFILE_TTL_MS) {
    return cached.profile;
  }
  return null;
};

const setDriverProfile = (driverId, profile) => {
  if (!driverId) return;
  driverProfileCache.set(Number(driverId), {
    profile,
    cachedAt: Date.now(),
  });
};

const enrichDriverProfiles = async (driverIds) => {
  const numericIds = Array.from(new Set(
    (driverIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  ));
  if (numericIds.length === 0) return new Map();

  const resultMap = new Map();
  const missingIds = [];

  for (const id of numericIds) {
    const cached = getDriverProfile(id);
    if (cached) {
      resultMap.set(id, cached);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) {
    return resultMap;
  }

  const headers = getSupabaseHeaders();
  const batches = chunkArray(missingIds, 50);

  for (const batch of batches) {
    try {
      const params = new URLSearchParams();
      params.set('select', 'driver_id,raw,created_at');
      params.append('driver_id', `in.(${batch.join(',')})`);
      params.set('order', 'created_at.desc');
      params.set('limit', String(batch.length * 5));

      const response = await axios.get(`${getSupabaseBaseUrl()}/rest/v1/jobs_webhooks?${params.toString()}`, {
        headers,
        timeout: 15000,
      });

      const rows = Array.isArray(response.data) ? response.data : [];
      for (const row of rows) {
        const driverId = Number(row.driver_id);
        if (!driverId || resultMap.has(driverId)) continue;

        const driver = parseDriverFromRaw(row);
        if (driver && driver.id) {
          setDriverProfile(driverId, driver);
          resultMap.set(driverId, driver);
        }
      }
    } catch (err) {
      console.warn('Error fetching driver profiles batch:', err.message);
    }
  }

  for (const id of missingIds) {
    if (!resultMap.has(id)) {
      const fallback = {
        id,
        name: `Usuario ${id}`,
        avatarUrl: null,
        publicUrl: `https://hub.truckyapp.com/user/${id}`,
      };
      setDriverProfile(id, fallback);
      resultMap.set(id, fallback);
    }
  }

  return resultMap;
};

const getJobDistanceKm = (row) => {
  const distance = Number(row.driven_distance_km ?? row.real_driven_distance_km);
  if (!Number.isFinite(distance) || distance < 0) return 0;
  return distance;
};

const getJobPlannedDistanceKm = (row) => {
  const distance = Number(row.planned_distance_km);
  if (!Number.isFinite(distance) || distance < 0) return 0;
  return distance;
};

const getJobMaxSpeedKmh = (row) => {
  const speed = Number(row.max_speed_kmh);
  if (!Number.isFinite(speed) || speed < 0) return null;
  return speed;
};

const getJobTotalDamage = (row) => {
  const rawPayload = parseWebhookRawPayload(row.raw);
  const rawData = rawPayload && typeof rawPayload === 'object' ? rawPayload.data || {} : {};
  const damage = Number(row.total_damage ?? rawData.total_damage);
  if (!Number.isFinite(damage) || damage < 0) return 0;
  return damage;
};

const getJobDamageBreakdown = (row) => {
  const rawPayload = parseWebhookRawPayload(row.raw);
  const rawData = rawPayload && typeof rawPayload === 'object' ? rawPayload.data || {} : {};

  const parseDamagePart = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.round(parsed * 100) / 100;
  };

  return {
    vehicleDamage: parseDamagePart(row.vehicle_damage ?? rawData.vehicle_damage),
    trailersDamage: parseDamagePart(row.trailers_damage ?? rawData.trailers_damage),
    cargoDamage: parseDamagePart(row.cargo_damage ?? rawData.cargo_damage),
  };
};

const parseRouteJobDetails = (row) => {
  const rawPayload = parseWebhookRawPayload(row.raw);
  const rawData = rawPayload && typeof rawPayload === 'object' ? rawPayload.data || {} : {};

  return {
    cargoName: rawData.cargo_name ? String(rawData.cargo_name).trim() : null,
    publicUrl: rawData.public_url || (row.job_id ? `https://hub.truckyapp.com/job/${row.job_id}` : null),
    startedAt: rawData.started_at || null,
    market: row.market || rawData.market || null,
  };
};

const parseRouteFromRaw = (row) => {
  const rawPayload = parseWebhookRawPayload(row.raw);
  const rawData = rawPayload && typeof rawPayload === 'object' ? rawPayload.data || {} : {};

  const sourceCityName = String(rawData.source_city_name || row.source_city_id || 'Origen no identificado').trim();
  const destinationCityName = String(rawData.destination_city_name || row.destination_city_id || 'Destino no identificado').trim();
  const sourceKey = normalizePointKey(row.source_city_id, sourceCityName);
  const destinationKey = normalizePointKey(row.destination_city_id, destinationCityName);

  return {
    routeKey: `${sourceKey}__${destinationKey}`,
    source: {
      key: sourceKey,
      cityId: row.source_city_id || null,
      cityName: sourceCityName,
    },
    destination: {
      key: destinationKey,
      cityId: row.destination_city_id || null,
      cityName: destinationCityName,
    },
  };
};

const normalizeRouteSortOrder = (rawValue, defaultValue = 'desc') => {
  const normalized = String(rawValue || defaultValue).trim().toLowerCase();
  return normalized === 'asc' ? 'asc' : 'desc';
};

const parseRouteSort = (query) => {
  const sortAlias = String(query.sort || '').trim().toLowerCase();
  const sortByRaw = String(query.sortBy || query.sort || '').trim().toLowerCase();
  const sortOrderRaw = String(query.sortOrder || query.order || '').trim().toLowerCase();

  const aliasMap = {
    newest: { sortBy: 'last_job_at', sortOrder: 'desc' },
    latest: { sortBy: 'last_job_at', sortOrder: 'desc' },
    recent: { sortBy: 'last_job_at', sortOrder: 'desc' },
    oldest: { sortBy: 'last_job_at', sortOrder: 'asc' },
    planned_longest: { sortBy: 'planned_distance', sortOrder: 'desc' },
    planned_shortest: { sortBy: 'planned_distance', sortOrder: 'asc' },
    real_longest: { sortBy: 'real_distance', sortOrder: 'desc' },
    real_shortest: { sortBy: 'real_distance', sortOrder: 'asc' },
    distance_longest: { sortBy: 'real_distance', sortOrder: 'desc' },
    distance_shortest: { sortBy: 'real_distance', sortOrder: 'asc' },
    max_speed_highest: { sortBy: 'max_speed', sortOrder: 'desc' },
    max_speed_lowest: { sortBy: 'max_speed', sortOrder: 'asc' },
    speed_highest: { sortBy: 'max_speed', sortOrder: 'desc' },
    speed_lowest: { sortBy: 'max_speed', sortOrder: 'asc' },
    damage_highest: { sortBy: 'damage', sortOrder: 'desc' },
    damage_lowest: { sortBy: 'damage', sortOrder: 'asc' },
    damage_desc: { sortBy: 'damage', sortOrder: 'desc' },
    damage_asc: { sortBy: 'damage', sortOrder: 'asc' },
    jobs_most: { sortBy: 'jobs', sortOrder: 'desc' },
    jobs_least: { sortBy: 'jobs', sortOrder: 'asc' },
  };

  if (aliasMap[sortAlias]) {
    return aliasMap[sortAlias];
  }

  const sortByAliases = {
    newest: 'last_job_at',
    latest: 'last_job_at',
    recent: 'last_job_at',
    oldest: 'last_job_at',
    date: 'last_job_at',
    last_job_at: 'last_job_at',
    planned: 'planned_distance',
    planned_distance: 'planned_distance',
    planned_km: 'planned_distance',
    real: 'real_distance',
    real_distance: 'real_distance',
    distance: 'real_distance',
    real_km: 'real_distance',
    speed: 'max_speed',
    max_speed: 'max_speed',
    max_speed_kmh: 'max_speed',
    damage: 'damage',
    total_damage: 'damage',
    jobs: 'jobs',
    total_jobs: 'jobs',
    route: 'route_key',
    route_key: 'route_key',
  };

  const sortBy = sortByAliases[sortByRaw] || 'real_distance';
  let sortOrder = normalizeRouteSortOrder(sortOrderRaw, 'desc');

  if (sortByRaw === 'oldest') {
    sortOrder = 'asc';
  }

  return { sortBy, sortOrder };
};

const compareNullableNumbers = (left, right, sortOrder) => {
  const leftValue = left == null ? null : Number(left);
  const rightValue = right == null ? null : Number(right);

  if (leftValue == null && rightValue == null) return 0;
  if (leftValue == null) return 1;
  if (rightValue == null) return -1;

  return sortOrder === 'asc' ? leftValue - rightValue : rightValue - leftValue;
};

const compareRoutes = (left, right, routeSort) => {
  if (routeSort.sortBy === 'last_job_at') {
    const leftTime = new Date(left.lastJobAt || 0).getTime();
    const rightTime = new Date(right.lastJobAt || 0).getTime();
    if (leftTime !== rightTime) {
      return routeSort.sortOrder === 'asc' ? leftTime - rightTime : rightTime - leftTime;
    }
  } else if (routeSort.sortBy === 'planned_distance') {
    const distanceComparison = compareNullableNumbers(left.totalPlannedDistanceKm, right.totalPlannedDistanceKm, routeSort.sortOrder);
    if (distanceComparison !== 0) return distanceComparison;
  } else if (routeSort.sortBy === 'real_distance') {
    const distanceComparison = compareNullableNumbers(left.totalDistanceKm, right.totalDistanceKm, routeSort.sortOrder);
    if (distanceComparison !== 0) return distanceComparison;
  } else if (routeSort.sortBy === 'max_speed') {
    const speedComparison = compareNullableNumbers(left.maxSpeedKmh, right.maxSpeedKmh, routeSort.sortOrder);
    if (speedComparison !== 0) return speedComparison;
  } else if (routeSort.sortBy === 'damage') {
    const damageComparison = compareNullableNumbers(left.totalDamage, right.totalDamage, routeSort.sortOrder);
    if (damageComparison !== 0) return damageComparison;
  } else if (routeSort.sortBy === 'jobs') {
    const jobsComparison = compareNullableNumbers(left.totalJobs, right.totalJobs, routeSort.sortOrder);
    if (jobsComparison !== 0) return jobsComparison;
  } else if (routeSort.sortBy === 'route_key') {
    const routeKeyComparison = left.routeKey.localeCompare(right.routeKey, 'es');
    if (routeKeyComparison !== 0) {
      return routeSort.sortOrder === 'asc' ? routeKeyComparison : -routeKeyComparison;
    }
  }

  if (right.totalDistanceKm !== left.totalDistanceKm) return right.totalDistanceKm - left.totalDistanceKm;
  if (right.totalJobs !== left.totalJobs) return right.totalJobs - left.totalJobs;
  return left.routeKey.localeCompare(right.routeKey, 'es');
};

const userRankingMemoryCache = new Map();
const usersTopMemoryCache = new Map();
const CACHE_TTL_RANKING_MS = 15 * 60 * 1000; // 15 minutos

const getUserRankingCacheKey = ({ companyIds, period, status, limit, includeNoCompany }) => {
  const compKey = companyIds && companyIds.length > 0 ? companyIds.slice().sort().join(',') : 'all';
  const periodKey = period.allTime
    ? 'all_time'
    : period.label === 'custom'
      ? `custom_${period.from}_${period.to}`
      : `month_${period.year}_${period.month}`;
  return `ranking_${compKey}_${periodKey}_${status}_${includeNoCompany}_${limit}`;
};

const getUsersTopCacheKey = ({ companyIds, period, status, usersLimit, companiesLimit }) => {
  const compKey = companyIds && companyIds.length > 0 ? companyIds.slice().sort().join(',') : 'all';
  const periodKey = period.allTime
    ? 'all_time'
    : period.label === 'custom'
      ? `custom_${period.from}_${period.to}`
      : `month_${period.year}_${period.month}`;
  return `top_${compKey}_${periodKey}_${status}_${usersLimit}_${companiesLimit}`;
};

const buildUsersRankingPayload = async ({
  companyIds = [],
  period,
  status = 'completed',
  limit = DEFAULT_COMPANIES_LIMIT,
  includeNoCompany = true,
}) => {
  const select = [
    'job_id',
    'company_id',
    'driver_id',
    'driven_distance_km',
    'real_driven_distance_km',
    'status',
    'event_type',
    'created_at',
    'updated_at',
  ].join(',');

  const jobs = await fetchJobs({
    select,
    period,
    companyIds: companyIds.length > 0 ? companyIds : [],
    status,
  });

  const driversMap = new Map();

  for (const row of jobs) {
    const driverId = Number(row.driver_id);
    if (!Number.isFinite(driverId) || driverId <= 0) continue;

    const companyId = Number(row.company_id);
    const hasCompany = Number.isFinite(companyId) && companyId > 0;

    if (!includeNoCompany && !hasCompany) {
      continue;
    }

    const distanceKm = getJobDistanceKm(row);
    const jobTimestamp = row.updated_at || row.created_at || null;

    if (!driversMap.has(driverId)) {
      driversMap.set(driverId, {
        id: driverId,
        totalDistanceKm: 0,
        totalJobs: 0,
        companyIds: new Set(),
        jobsWithoutCompany: 0,
        lastJobAt: jobTimestamp,
      });
    }

    const entry = driversMap.get(driverId);
    entry.totalDistanceKm += distanceKm;
    entry.totalJobs += 1;

    if (hasCompany) {
      entry.companyIds.add(companyId);
    } else {
      entry.jobsWithoutCompany += 1;
    }

    if (jobTimestamp && (!entry.lastJobAt || jobTimestamp > entry.lastJobAt)) {
      entry.lastJobAt = jobTimestamp;
    }
  }

  const sortedDrivers = [...driversMap.values()].sort((left, right) => {
    if (right.totalDistanceKm !== left.totalDistanceKm) {
      return right.totalDistanceKm - left.totalDistanceKm;
    }
    return right.totalJobs - left.totalJobs;
  });

  const topSlice = sortedDrivers.slice(0, limit);
  const topDriverIds = topSlice.map((d) => d.id);
  const profilesMap = await enrichDriverProfiles(topDriverIds);

  const items = topSlice.map((d) => {
    const profile = profilesMap.get(d.id) || {
      id: d.id,
      name: `Usuario ${d.id}`,
      avatarUrl: null,
      publicUrl: `https://hub.truckyapp.com/user/${d.id}`,
    };

    return {
      id: d.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      publicUrl: profile.publicUrl,
      totalDistanceKm: Math.floor(d.totalDistanceKm),
      totalJobs: d.totalJobs,
      companyCount: d.companyIds.size,
      jobsWithoutCompany: d.jobsWithoutCompany,
      lastJobAt: d.lastJobAt,
    };
  });

  const generatedAt = nowUtc();

  return {
    ok: true,
    filters: {
      companyIds,
      status,
      includeNoCompany,
      limit,
    },
    period: {
      label: period.label,
      from: period.from,
      to: period.to,
      allTime: period.allTime,
      month: period.month || null,
      year: period.year || null,
      timezone: 'America/Lima',
    },
    jobsAnalyzed: jobs.length,
    totalUsers: items.length,
    items,
    timestamp: Math.floor(generatedAt.getTime() / 1000),
    timestampHuman: formatTimestampHuman(generatedAt),
  };
};

const buildUsersTopPayload = async ({
  companyIds = [],
  period,
  status = 'completed',
  usersLimit = DEFAULT_USERS_LIMIT,
  companiesLimit = DEFAULT_COMPANIES_LIMIT,
}) => {
  const select = [
    'job_id',
    'company_id',
    'driver_id',
    'driven_distance_km',
    'real_driven_distance_km',
    'status',
    'event_type',
    'created_at',
    'updated_at',
  ].join(',');

  const [companies, jobs] = await Promise.all([
    fetchCompanies(companyIds.length > 0 ? companyIds : null),
    fetchJobs({ select, period, companyIds: companyIds.length > 0 ? companyIds : [], status }),
  ]);

  const companiesMap = new Map(companies.map((company) => [company.id, company]));
  const rankingByCompany = new Map();

  if (companyIds.length > 0) {
    for (const companyId of companyIds) {
      const company = companiesMap.get(companyId) || { id: companyId, name: `Empresa ${companyId}` };
      rankingByCompany.set(companyId, {
        company,
        totalDistanceKm: 0,
        totalJobs: 0,
        users: new Map(),
      });
    }
  }

  for (const row of jobs) {
    const companyId = Number(row.company_id);
    const driverId = Number(row.driver_id);
    const distanceKm = getJobDistanceKm(row);
    const jobTimestamp = row.updated_at || row.created_at || null;

    if (!Number.isFinite(companyId) || companyId <= 0) continue;
    if (!Number.isFinite(driverId) || driverId <= 0) continue;

    if (!rankingByCompany.has(companyId)) {
      const company = companiesMap.get(companyId) || { id: companyId, name: `Empresa ${companyId}` };
      rankingByCompany.set(companyId, {
        company,
        totalDistanceKm: 0,
        totalJobs: 0,
        users: new Map(),
      });
    }

    const companyEntry = rankingByCompany.get(companyId);
    companyEntry.totalDistanceKm += distanceKm;
    companyEntry.totalJobs += 1;

    if (!companyEntry.users.has(driverId)) {
      companyEntry.users.set(driverId, {
        id: driverId,
        totalDistanceKm: 0,
        totalJobs: 0,
        lastJobAt: jobTimestamp,
      });
    }

    const userEntry = companyEntry.users.get(driverId);
    userEntry.totalDistanceKm += distanceKm;
    userEntry.totalJobs += 1;
    if (jobTimestamp && (!userEntry.lastJobAt || jobTimestamp > userEntry.lastJobAt)) {
      userEntry.lastJobAt = jobTimestamp;
    }
  }

  const allTopDriverIds = new Set();
  for (const entry of rankingByCompany.values()) {
    const sortedUsers = [...entry.users.values()]
      .sort((left, right) => {
        if (right.totalDistanceKm !== left.totalDistanceKm) return right.totalDistanceKm - left.totalDistanceKm;
        return right.totalJobs - left.totalJobs;
      })
      .slice(0, usersLimit);
    for (const u of sortedUsers) {
      allTopDriverIds.add(u.id);
    }
  }

  const profilesMap = await enrichDriverProfiles([...allTopDriverIds]);

  const items = [...rankingByCompany.values()]
    .map((entry) => ({
      company: entry.company,
      stats: {
        totalDistanceKm: Math.floor(entry.totalDistanceKm),
        totalJobs: entry.totalJobs,
        totalUsers: entry.users.size,
      },
      topUsers: [...entry.users.values()]
        .map((user) => {
          const profile = profilesMap.get(user.id) || {
            name: `Usuario ${user.id}`,
            avatarUrl: null,
            publicUrl: `https://hub.truckyapp.com/user/${user.id}`,
          };
          return {
            id: user.id,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            publicUrl: profile.publicUrl,
            totalDistanceKm: Math.floor(user.totalDistanceKm),
            totalJobs: user.totalJobs,
            lastJobAt: user.lastJobAt,
          };
        })
        .sort((left, right) => {
          if (right.totalDistanceKm !== left.totalDistanceKm) return right.totalDistanceKm - left.totalDistanceKm;
          if (right.totalJobs !== left.totalJobs) return right.totalJobs - left.totalJobs;
          return (left.name || '').localeCompare(right.name || '', 'es');
        })
        .slice(0, usersLimit),
    }))
    .sort((left, right) => {
      if (right.stats.totalDistanceKm !== left.stats.totalDistanceKm) {
        return right.stats.totalDistanceKm - left.stats.totalDistanceKm;
      }
      return left.company.name.localeCompare(right.company.name, 'es');
    })
    .slice(0, companiesLimit);

  const generatedAt = nowUtc();

  return {
    ok: true,
    filters: {
      companyIds,
      status,
      usersLimit,
      companiesLimit,
    },
    period: {
      label: period.label,
      from: period.from,
      to: period.to,
      allTime: period.allTime,
      month: period.month || null,
      year: period.year || null,
    },
    totalCompanies: items.length,
    items,
    timestamp: Math.floor(generatedAt.getTime() / 1000),
    timestampHuman: formatTimestampHuman(generatedAt),
  };
};

const buildRoutesPayload = async ({
  companyIds,
  period,
  status,
  routesLimit,
  includeCoordinates,
  jobsLimit,
  jobsOrder,
  routeSort,
}) => {
  const select = [
    'job_id',
    'company_id',
    'driver_id',
    'source_city_id',
    'destination_city_id',
    'cargo_id',
    'market',
    'planned_distance_km',
    'driven_distance_km',
    'real_driven_distance_km',
    'max_speed_kmh',
    'vehicle_damage',
    'trailers_damage',
    'cargo_damage',
    'total_damage',
    'status',
    'event_type',
    'created_at',
    'updated_at',
    'raw',
  ].join(',');

  const [companies, jobs] = await Promise.all([
    fetchCompanies(companyIds),
    fetchJobs({ select, period, companyIds, status, jobsLimit, jobsOrder }),
  ]);

  const companiesMap = new Map(companies.map((company) => [company.id, company]));
  const groupedRoutes = new Map();
  const routeKeys = new Set();

  for (const companyId of companyIds) {
    const company = companiesMap.get(companyId) || { id: companyId, name: `Empresa ${companyId}` };
    groupedRoutes.set(companyId, {
      company,
      totalDistanceKm: 0,
      totalDamage: 0,
      totalJobs: 0,
      uniqueRouteKeys: new Set(),
      routes: [],
    });
  }

  for (const row of jobs) {
    const companyId = Number(row.company_id);
    if (!Number.isFinite(companyId) || companyId <= 0) continue;
    if (!groupedRoutes.has(companyId)) continue;

    const route = parseRouteFromRaw(row);
    const driver = parseDriverFromRaw(row);
    const jobDetails = parseRouteJobDetails(row);
    const distanceKm = getJobDistanceKm(row);
    const plannedDistanceKm = getJobPlannedDistanceKm(row);
    const maxSpeedKmh = getJobMaxSpeedKmh(row);
    const totalDamage = getJobTotalDamage(row);
    const damageBreakdown = getJobDamageBreakdown(row);
    const group = groupedRoutes.get(companyId);
    const updatedAt = row.updated_at || row.created_at || null;

    group.totalDistanceKm += distanceKm;
    group.totalDamage += totalDamage;
    group.totalJobs += 1;
    group.uniqueRouteKeys.add(route.routeKey);
    routeKeys.add(route.routeKey);
    group.routes.push({
      jobId: Number(row.job_id || 0),
      routeKey: route.routeKey,
      source: route.source,
      destination: route.destination,
      driver: Number.isFinite(driver.id) && driver.id > 0 ? driver : null,
      cargoName: jobDetails.cargoName || (row.cargo_id ? String(row.cargo_id).trim() : null),
      market: jobDetails.market,
      publicUrl: jobDetails.publicUrl,
      startedAt: jobDetails.startedAt,
      createdAt: row.created_at || null,
      updatedAt,
      lastJobAt: updatedAt,
      status: row.status || null,
      eventType: row.event_type || null,
      distanceKm: Math.floor(distanceKm),
      plannedDistanceKm: Math.floor(plannedDistanceKm),
      totalDistanceKm: Math.floor(distanceKm),
      totalPlannedDistanceKm: Math.floor(plannedDistanceKm),
      maxSpeedKmh: maxSpeedKmh == null ? null : Math.round(maxSpeedKmh * 100) / 100,
      totalDamage: Math.round(totalDamage * 100) / 100,
      ...damageBreakdown,
      totalJobs: 1,
    });
  }

  const routeMetadataMap = await fetchRouteMetadata(Array.from(routeKeys), includeCoordinates);

  const items = [...groupedRoutes.values()]
    .map((entry) => ({
      company: entry.company,
      stats: {
        totalDistanceKm: Math.floor(entry.totalDistanceKm),
        totalDamage: Math.round(entry.totalDamage * 100) / 100,
        totalJobs: entry.totalJobs,
        totalRoutes: entry.uniqueRouteKeys.size,
        totalRouteEntries: entry.routes.length,
      },
      routes: entry.routes
        .map((route) => {
          const metadata = routeMetadataMap.get(route.routeKey) || null;
          return {
            ...route,
            routeCache: metadata ? {
              distanceMeters: metadata.distanceMeters,
              durationSeconds: metadata.durationSeconds,
              updatedAt: metadata.updatedAt,
              coordinates: metadata.coordinates,
            } : null,
          };
        })
        .sort((left, right) => compareRoutes(left, right, routeSort))
        .slice(0, routesLimit),
    }))
    .sort((left, right) => {
      if (right.stats.totalDistanceKm !== left.stats.totalDistanceKm) {
        return right.stats.totalDistanceKm - left.stats.totalDistanceKm;
      }
      return left.company.name.localeCompare(right.company.name, 'es');
    });

  const generatedAt = nowUtc();

  return {
    ok: true,
    filters: {
      companyIds,
      status,
      routesLimit,
      jobsLimit,
      jobsOrder,
      routeSort,
      includeCoordinates,
    },
    period: {
      label: period.label,
      from: period.from,
      to: period.to,
      allTime: period.allTime,
      month: period.month || null,
      year: period.year || null,
    },
    jobsAnalyzed: jobs.length,
    totalCompanies: items.length,
    items,
    timestamp: Math.floor(generatedAt.getTime() / 1000),
    timestampHuman: formatTimestampHuman(generatedAt),
  };
};

router.get('/', (req, res) => {
  res.json({
    message: 'API publica de Trucky para PeruServer',
    endpoints: {
      '/companies': 'Lista publica de empresas registradas',
      '/companies/:companyId': 'Informacion publica de una empresa',
      '/users/top': 'Top de usuarios por empresa en kilometros',
      '/users/ranking': 'Ranking global de usuarios en kilometros (todas las empresas o sin empresa)',
      '/routes': 'Rutas de una o varias empresas',
    },
    examples: {
      companies: '/v2/peruserver/trucky/public/companies?search=movil',
      company: '/v2/peruserver/trucky/public/companies/41407',
      usersTop: '/v2/peruserver/trucky/public/users/top?companyIds=41407,42815&month=3&year=2026&usersLimit=10',
      usersRanking: '/v2/peruserver/trucky/public/users/ranking?limit=100&includeNoCompany=true&allTime=true',
      routes: '/v2/peruserver/trucky/public/routes?companyIds=41407&month=3&year=2026&routesLimit=20&jobsLimit=2000&sort=damage_highest',
    },
  });
});

router.get('/companies', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_COMPANIES_LIMIT, 1, MAX_COMPANIES_LIMIT);
    const companyIds = parseCsvNumberList(req.query.companyIds ?? req.query.ids);
    const search = String(req.query.search || '').trim().toLowerCase();
    const companies = await fetchCompanies(companyIds.length > 0 ? companyIds : null);

    const filtered = companies.filter((company) => {
      if (!search) return true;
      return [
        company.name,
        company.tag,
        company.publicUrl,
        String(company.id),
      ].some((value) => String(value || '').toLowerCase().includes(search));
    });

    const offset = (page - 1) * limit;
    const items = filtered.slice(offset, offset + limit);
    const generatedAt = nowUtc();

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.json({
      ok: true,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      },
      items,
      timestamp: Math.floor(generatedAt.getTime() / 1000),
      timestampHuman: formatTimestampHuman(generatedAt),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error interno',
    });
  }
});

router.get('/companies/:companyId', async (req, res) => {
  try {
    const companyId = parsePositiveInt(req.params.companyId, NaN, 1, Number.MAX_SAFE_INTEGER);
    if (!Number.isFinite(companyId)) {
      return res.status(400).json({
        ok: false,
        error: 'El companyId no es valido',
      });
    }

    const company = await fetchCompanyById(companyId);
    if (!company) {
      return res.status(404).json({
        ok: false,
        error: `Empresa ${companyId} no encontrada`,
      });
    }

    const generatedAt = nowUtc();

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.json({
      ok: true,
      item: company,
      timestamp: Math.floor(generatedAt.getTime() / 1000),
      timestampHuman: formatTimestampHuman(generatedAt),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error interno',
    });
  }
});

router.get('/users/ranking', async (req, res) => {
  try {
    const companyIds = parseCsvNumberList(req.query.companyIds ?? req.query.ids ?? req.query.companyId);
    const limit = parsePositiveInt(req.query.limit ?? req.query.usersLimit, DEFAULT_COMPANIES_LIMIT, 1, 500);
    const includeNoCompany = parseBoolean(req.query.includeNoCompany ?? req.query.noCompany, true);
    const status = normalizeStatus(req.query.status);
    const period = parsePeriod(req.query);
    const forceRefresh = parseBoolean(req.query.refresh, false);

    if (period.error) {
      return res.status(400).json({ ok: false, error: period.error });
    }

    const cacheKey = getUserRankingCacheKey({ companyIds, period, status, limit, includeNoCompany });
    const cachedEntry = userRankingMemoryCache.get(cacheKey);

    if (!forceRefresh && cachedEntry && cachedEntry.payload && Date.now() < cachedEntry.expiresAt) {
      res.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=60');
      return res.json(cachedEntry.payload);
    }

    const payload = await buildUsersRankingPayload({
      companyIds,
      period,
      status,
      limit,
      includeNoCompany,
    });

    userRankingMemoryCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CACHE_TTL_RANKING_MS,
    });

    res.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=60');
    return res.json(payload);
  } catch (error) {
    console.error('Error en /users/ranking:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error interno',
    });
  }
});

router.get('/users/top', async (req, res) => {
  try {
    const companyIds = parseCsvNumberList(req.query.companyIds ?? req.query.ids ?? req.query.companyId);
    const usersLimit = parsePositiveInt(req.query.usersLimit ?? req.query.limitUsers, DEFAULT_USERS_LIMIT, 1, MAX_USERS_LIMIT);
    const companiesLimit = parsePositiveInt(req.query.companiesLimit ?? req.query.limitCompanies, DEFAULT_COMPANIES_LIMIT, 1, MAX_COMPANIES_LIMIT);
    const status = normalizeStatus(req.query.status);
    const period = parsePeriod(req.query);
    const forceRefresh = parseBoolean(req.query.refresh, false);

    if (period.error) {
      return res.status(400).json({ ok: false, error: period.error });
    }

    const cacheKey = getUsersTopCacheKey({ companyIds, period, status, usersLimit, companiesLimit });
    const cachedEntry = usersTopMemoryCache.get(cacheKey);

    if (!forceRefresh && cachedEntry && cachedEntry.payload && Date.now() < cachedEntry.expiresAt) {
      res.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=60');
      return res.json(cachedEntry.payload);
    }

    const payload = await buildUsersTopPayload({
      companyIds,
      period,
      status,
      usersLimit,
      companiesLimit,
    });

    usersTopMemoryCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CACHE_TTL_RANKING_MS,
    });

    res.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=60');
    return res.json(payload);
  } catch (error) {
    console.error('Error en /users/top:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error interno',
    });
  }
});

router.get('/routes', async (req, res) => {
  try {
    const companyIds = parseCsvNumberList(req.query.companyIds ?? req.query.ids ?? req.query.companyId);
    const routesLimit = parsePositiveInt(req.query.routesLimit ?? req.query.limitRoutes, DEFAULT_ROUTES_LIMIT, 1, MAX_ROUTES_LIMIT);
    const jobsLimit = parsePositiveInt(req.query.jobsLimit ?? req.query.limitJobs, DEFAULT_ROUTE_JOBS_LIMIT, 1, MAX_ROUTE_JOBS_LIMIT);
    const jobsOrder = normalizeRouteSortOrder(req.query.jobsOrder ?? req.query.jobsSortOrder, 'desc');
    const routeSort = parseRouteSort(req.query);
    const includeCoordinates = parseBoolean(req.query.includeCoordinates, false);
    const status = normalizeStatus(req.query.status);
    const period = parsePeriod(req.query);

    if (period.error) {
      return res.status(400).json({ ok: false, error: period.error });
    }

    if (companyIds.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debes enviar al menos un companyId o companyIds',
      });
    }

    const payload = await buildRoutesPayload({
      companyIds,
      period,
      status,
      routesLimit,
      jobsLimit,
      jobsOrder,
      routeSort,
      includeCoordinates,
    });

    res.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=60');
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error interno',
    });
  }
});

module.exports = router;
