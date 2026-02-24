const fetch = require('node-fetch');

const DEFAULT_INDECI_URL = 'https://geosinpad.indeci.gob.pe/indeci/rest/services/Emergencias/EMERGENCIAS_SINPAD/FeatureServer/0/query?where=FECHA%3E=CURRENT_TIMESTAMP-1&outFields=*&returnGeometry=true&f=json';

/**
 * Determina el tipo de emergencia para INDECI
 */
function getEmergenciaTypeIndeci(fenomeno) {
  const fenomenoUpper = (fenomeno || '').toUpperCase();

  if (fenomenoUpper.includes('LLUVIA') || fenomenoUpper.includes('TORMENTA')) return 'LLUVIA INTENSA';
  if (fenomenoUpper.includes('DESLIZA') || fenomenoUpper.includes('DERRUMBE')) return 'DESLIZAMIENTO';
  if (fenomenoUpper.includes('INUNDA')) return 'INUNDACION';
  if (fenomenoUpper.includes('SISMO') || fenomenoUpper.includes('TERREMOTO')) return 'SISMO';
  if (fenomenoUpper.includes('HELADA') || fenomenoUpper.includes('FRIO')) return 'HELADA';
  if (fenomenoUpper.includes('SEQUIA') || fenomenoUpper.includes('DEFICIT') || fenomenoUpper.includes('DÉFICIT')) return 'SEQUIA';
  if (fenomenoUpper.includes('INCENDIO') || fenomenoUpper.includes('FUEGO')) return 'INCENDIO FORESTAL';
  if (fenomenoUpper.includes('VANDALISMO')) return 'VANDALISMO';
  if (fenomenoUpper.includes('ACCIDENTE')) return 'ACCIDENTE';

  return fenomeno || 'OTRO';
}

function getPeruDateParts(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return map;
}

/**
 * La API de INDECI retorna la fecha sin hora.
 * Esta funcion combina la fecha (INDECI) con la hora actual de Peru.
 */
function mergeIndeciDateWithCurrentPeruTime(timestampMs, now = new Date()) {
  if (!timestampMs) return null;

  const dateFromIndeci = new Date(timestampMs);
  if (isNaN(dateFromIndeci.getTime())) return null;

  const indeciParts = getPeruDateParts(dateFromIndeci);
  const nowParts = getPeruDateParts(now);

  const isoPeru = `${indeciParts.year}-${indeciParts.month}-${indeciParts.day}T${nowParts.hour}:${nowParts.minute}:${nowParts.second}-05:00`;
  return new Date(isoPeru).toISOString();
}

async function fetchIndeciEmergencias() {
  const url = process.env.INDECI_API_URL || DEFAULT_INDECI_URL;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://geosinpad.indeci.gob.pe',
    },
    timeout: 30000,
  });

  if (!response.ok) {
    throw new Error(`INDECI API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.features || data.features.length === 0) {
    return [];
  }

  const now = new Date();
  const emergencias = data.features.map((feature, idx) => {
    const attrs = feature.attributes || {};
    const geom = feature.geometry || {};
    const objectId = attrs.OBJECTID ?? idx;
    const occurredAtIso = mergeIndeciDateWithCurrentPeruTime(attrs.FECHA, now) || now.toISOString();

    return {
      id: `indeci-${objectId}`,
      sinpad_code: `INDECI-${objectId}`,
      type: getEmergenciaTypeIndeci(attrs.FENOMENO),
      description: attrs.DESCRIPCION || attrs.FENOMENO || 'Sin descripcion',
      location: attrs.DISTRITO || 'Ubicacion desconocida',
      district: attrs.DISTRITO || '',
      province: attrs.PROVINCIA || '',
      region: attrs.REGION || '',
      occurred_at: occurredAtIso,
      latitude: geom.y || attrs.NUM_POSY || 0,
      longitude: geom.x || attrs.NUM_POSX || 0,
      affected_people: attrs.AFECTADOS_DIRECTOS || 0,
      object_id: attrs.OBJECTID || null,
      raw_timestamp_ms: attrs.FECHA || null,
      raw: feature,
    };
  });

  return emergencias;
}

module.exports = {
  fetchIndeciEmergencias,
  getEmergenciaTypeIndeci,
  mergeIndeciDateWithCurrentPeruTime,
};
