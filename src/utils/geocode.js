const fetch = require('node-fetch');

const cache = new Map();
let lastRequestAt = 0;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1100;

function isValidCoord(lat, lon) {
  if (lat == null || lon == null) return false;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la === 0 && lo === 0) return false;
  return la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}

function normalizeLocation(location) {
  if (!location) return '';
  let cleaned = location;

  // Try to fix mojibake (latin1 -> utf8) only when common bad sequences appear
  if (cleaned.includes('Ã') || cleaned.includes('Â')) {
    try {
      cleaned = Buffer.from(cleaned, 'latin1').toString('utf8');
    } catch (error) {
      // Keep original if conversion fails
    }
  }

  return cleaned
    .replace(/\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLocationNoise(location) {
  if (!location) return '';
  return location
    .replace(/\bNro\.?\b/gi, '')
    .replace(/\bN°\b/gi, '')
    .replace(/\bS\/N\b/gi, '')
    .replace(/\bCRUCE\s+CON\b/gi, '')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCacheKey({ location, district, region, country }) {
  return [location, district, region, country].filter(Boolean).join('|').toLowerCase();
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeApprox({ location, district, region, country = 'Peru' }) {
  const clean = normalizeLocation(location);
  if (!clean && !district && !region) return null;

  const key = buildCacheKey({ location: clean, district, region, country });
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const cleanedNoNoise = stripLocationNoise(clean);
  const queries = [
    [cleanedNoNoise, district, region, country].filter(Boolean).join(', '),
    [district, region, country].filter(Boolean).join(', '),
    [region, country].filter(Boolean).join(', '),
  ].filter(Boolean);

  for (const q of queries) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'pe');

    const now = Date.now();
    const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (now - lastRequestAt));
    if (waitMs > 0) {
      await delay(waitMs);
    }
    lastRequestAt = Date.now();

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': process.env.GEOCODE_USER_AGENT || 'MDCDEV-incident-geocoder/1.0 (contact: you@example.com)'
      },
      timeout: 30000,
    });

    if (!res.ok) continue;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) continue;

    const hit = data[0];
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);

    if (!isValidCoord(lat, lon)) continue;

    const value = {
      latitude: lat,
      longitude: lon,
      display_name: hit.display_name,
      importance: hit.importance,
      osm_type: hit.osm_type,
      osm_id: hit.osm_id,
    };

    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  return null;
}

module.exports = {
  isValidCoord,
  normalizeLocation,
  geocodeApprox,
};
