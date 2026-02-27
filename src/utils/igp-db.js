const mysql = require('mysql2/promise');

// Crear pool de conexiones a MariaDB
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
});

/**
 * Convierte fecha ISO 8601 a formato MySQL DATETIME
 */
function convertToMySQLDatetime(isoDate) {
  if (!isoDate) return null;

  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return null;

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Error convirtiendo fecha:', error);
    return null;
  }
}

function toDateObject(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildUtcDateTimeFromFields(utcDateValue, utcTimeValue) {
  const dateObj = toDateObject(utcDateValue);
  const timeObj = toDateObject(utcTimeValue);

  if (!dateObj || !timeObj) return null;

  const year = dateObj.getUTCFullYear();
  const monthIndex = dateObj.getUTCMonth();
  const dayBase = dateObj.getUTCDate();

  const totalSeconds = Math.floor(timeObj.getTime() / 1000);
  const totalHours = Math.floor(totalSeconds / 3600);
  const daysToAdd = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return new Date(Date.UTC(year, monthIndex, dayBase + daysToAdd, hours, minutes, seconds));
}

function getPeruTimestampFromUTCFields(utcDateValue, utcTimeValue) {
  const utcDateTime = buildUtcDateTimeFromFields(utcDateValue, utcTimeValue);
  if (!utcDateTime) return null;

  return utcDateTime.getTime() - 5 * 60 * 60 * 1000;
}

function filterEarthquakesByPeruHours(rows, hours) {
  const nowPeruMs = Date.now() - 5 * 60 * 60 * 1000;
  const minPeruMs = nowPeruMs - hours * 60 * 60 * 1000;

  return rows.filter((row) => {
    const peruMs = getPeruTimestampFromUTCFields(row.utc_date, row.utc_time);
    if (!peruMs) return false;
    return peruMs >= minPeruMs && peruMs <= nowPeruMs;
  });
}

/**
 * Convierte campos del API del IGP a campos de BD
 */
function mapIGPToDatabase(sismo) {
  return {
    code: sismo.codigo,
    codes: sismo.codigos,
    report_number: sismo.numero_reporte,
    list_quake_id: sismo.idlistasismos,
    external_id: sismo.idlistasismos,
    date: sismo.fecha ? convertToMySQLDatetime(sismo.fecha) : null,
    local_date: sismo.fecha_local ? convertToMySQLDatetime(sismo.fecha_local) : null,
    local_time: sismo.hora_local ? convertToMySQLDatetime(sismo.hora_local) : null,
    utc_date: sismo.fecha_utc ? convertToMySQLDatetime(sismo.fecha_utc) : null,
    utc_time: sismo.hora_utc ? convertToMySQLDatetime(sismo.hora_utc) : null,
    datetime_utc: sismo.fecha_utc ? convertToMySQLDatetime(sismo.fecha_utc) : null,
    created_at: sismo.createdAt ? convertToMySQLDatetime(sismo.createdAt) : convertToMySQLDatetime(new Date().toISOString()),
    updated_at: sismo.updatedAt ? convertToMySQLDatetime(sismo.updatedAt) : convertToMySQLDatetime(new Date().toISOString()),
    latitude: parseFloat(sismo.latitud) || null,
    longitude: parseFloat(sismo.longitud) || null,
    reference: sismo.referencia,
    reference2: sismo.referencia2,
    reference3: sismo.referencia3,
    magnitude: parseFloat(sismo.magnitud) || null,
    magnitude_type: sismo.tipomagnitud || null,
    depth: parseInt(sismo.profundidad) || null,
    intensity: sismo.intensidad,
    intensities: sismo.intensidades,
    event_type: sismo.tipo_evento || null,
    surface: sismo.superficie || null,
    accelerometric_report_pdf: sismo.reporte_acelerometrico_pdf,
    map: sismo.mapa || null,
    report: sismo.informe || null,
    seismic_map_url: sismo.mapa_sismico_url || sismo.mapa_sismico_url,
    accelerometric_map_url: sismo.mapa_aceleracion_teorica_url || sismo.mapa_acelerometrico_url,
    max_acceleration_map_url: sismo.mapa_aceleracion_maxima_url,
    theoretical_acceleration_map_url: sismo.mapa_aceleracion_teorica_url,
    intensity_map_url: sismo.mapa_intensidades_url,
    pseudo_acceleration_map_url: sismo.mapa_pseudo_aceleracion_url,
    max_velocity_map_url: sismo.mapa_velocidades_maxima_url,
    published: sismo.publicado === '1' || sismo.publicado === 1,
    drill: sismo.simulacro === 1 || sismo.simulacro === true,
    thematic_pdf_id: sismo.id_pdf_tematico || null,
  };
}

/**
 * Guarda sismos en la BD (INSERT OR UPDATE)
 */
async function batchUpsertEarthquakes(sismos) {
  if (!sismos || sismos.length === 0) return 0;

  const connection = await pool.getConnection();
  try {
    let savedCount = 0;

    for (const sismo of sismos) {
      const mapped = mapIGPToDatabase(sismo);

      const query = `
        INSERT INTO earthquakes (
          \`code\`, \`codes\`, \`report_number\`, \`list_quake_id\`, \`external_id\`,
          \`date\`, \`local_date\`, \`local_time\`, \`utc_date\`, \`utc_time\`, \`datetime_utc\`,
          \`created_at\`, \`updated_at\`,
          \`latitude\`, \`longitude\`, \`reference\`, \`reference2\`, \`reference3\`,
          \`magnitude\`, \`magnitude_type\`, \`depth\`, \`intensity\`, \`intensities\`,
          \`event_type\`, \`surface\`, \`accelerometric_report_pdf\`,
          \`map\`, \`report\`,
          \`seismic_map_url\`, \`accelerometric_map_url\`, \`max_acceleration_map_url\`,
          \`theoretical_acceleration_map_url\`, \`intensity_map_url\`,
          \`pseudo_acceleration_map_url\`, \`max_velocity_map_url\`,
          \`published\`, \`drill\`, \`thematic_pdf_id\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          \`codes\` = VALUES(\`codes\`),
          \`report_number\` = VALUES(\`report_number\`),
          \`intensity\` = VALUES(\`intensity\`),
          \`intensities\` = VALUES(\`intensities\`),
          \`updated_at\` = VALUES(\`updated_at\`),
          \`seismic_map_url\` = VALUES(\`seismic_map_url\`),
          \`accelerometric_map_url\` = VALUES(\`accelerometric_map_url\`),
          \`max_acceleration_map_url\` = VALUES(\`max_acceleration_map_url\`),
          \`theoretical_acceleration_map_url\` = VALUES(\`theoretical_acceleration_map_url\`),
          \`intensity_map_url\` = VALUES(\`intensity_map_url\`),
          \`pseudo_acceleration_map_url\` = VALUES(\`pseudo_acceleration_map_url\`),
          \`max_velocity_map_url\` = VALUES(\`max_velocity_map_url\`),
          \`published\` = VALUES(\`published\`)
      `;

      const values = [
        mapped.code,
        mapped.codes,
        mapped.report_number,
        mapped.list_quake_id,
        mapped.external_id,
        mapped.date,
        mapped.local_date,
        mapped.local_time,
        mapped.utc_date,
        mapped.utc_time,
        mapped.datetime_utc,
        mapped.created_at,
        mapped.updated_at,
        mapped.latitude,
        mapped.longitude,
        mapped.reference,
        mapped.reference2,
        mapped.reference3,
        mapped.magnitude,
        mapped.magnitude_type,
        mapped.depth,
        mapped.intensity,
        mapped.intensities,
        mapped.event_type,
        mapped.surface,
        mapped.accelerometric_report_pdf,
        mapped.map,
        mapped.report,
        mapped.seismic_map_url,
        mapped.accelerometric_map_url,
        mapped.max_acceleration_map_url,
        mapped.theoretical_acceleration_map_url,
        mapped.intensity_map_url,
        mapped.pseudo_acceleration_map_url,
        mapped.max_velocity_map_url,
        mapped.published,
        mapped.drill,
        mapped.thematic_pdf_id,
      ];

      await connection.query(query, values);
      savedCount++;
    }

    return savedCount;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene sismos de los últimos N horas
 */
async function getEarthquakesByHoursRange(hours = 24) {
  const connection = await pool.getConnection();
  try {
    const daysWindow = Math.max(1, Math.ceil(hours / 24) + 1);
    const query = `
      SELECT * FROM earthquakes 
      WHERE (
        (utc_date IS NOT NULL AND utc_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY))
        OR (datetime_utc IS NOT NULL AND datetime_utc >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY))
      )
      ORDER BY COALESCE(utc_date, datetime_utc) DESC 
      LIMIT 5000
    `;
    const [rows] = await connection.query(query, [daysWindow, daysWindow]);
    return filterEarthquakesByPeruHours(rows, hours);
  } finally {
    connection.release();
  }
}

/**
 * Obtiene sismos de los últimos N días
 */
async function getEarthquakesByDaysRange(days = 7) {
  const connection = await pool.getConnection();
  try {
    const query = `
      SELECT * FROM earthquakes 
      WHERE datetime_utc >= DATE_SUB(NOW(), INTERVAL ? DAY) 
      ORDER BY datetime_utc DESC 
      LIMIT 5000
    `;
    const [rows] = await connection.query(query, [days]);
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene sismos de una magnitud mínima
 */
async function getEarthquakesByMinimumMagnitude(magnitude = 4.0, hours = 24) {
  const connection = await pool.getConnection();
  try {
    const daysWindow = Math.max(1, Math.ceil(hours / 24) + 1);
    const query = `
      SELECT * FROM earthquakes 
      WHERE magnitude >= ? 
      AND (
        (utc_date IS NOT NULL AND utc_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY))
        OR (datetime_utc IS NOT NULL AND datetime_utc >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY))
      )
      ORDER BY magnitude DESC, COALESCE(utc_date, datetime_utc) DESC 
      LIMIT 3000
    `;
    const [rows] = await connection.query(query, [magnitude, daysWindow, daysWindow]);
    return filterEarthquakesByPeruHours(rows, hours);
  } finally {
    connection.release();
  }
}

/**
 * Obtiene el último sismo
 */
async function getLastEarthquake() {
  const connection = await pool.getConnection();
  try {
    const query = `
      SELECT * FROM earthquakes 
      ORDER BY datetime_utc DESC 
      LIMIT 1
    `;
    const [rows] = await connection.query(query);
    return rows.length > 0 ? rows[0] : null;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene sismo por código
 */
async function getEarthquakeByCode(code) {
  const connection = await pool.getConnection();
  try {
    const query = `
      SELECT * FROM earthquakes 
      WHERE code = ? 
      LIMIT 1
    `;
    const [rows] = await connection.query(query, [code]);
    return rows.length > 0 ? rows[0] : null;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene sismos por referencia (región)
 */
async function getEarthquakesByReference(reference, hours = 72) {
  const connection = await pool.getConnection();
  try {
    const daysWindow = Math.max(1, Math.ceil(hours / 24) + 1);
    const query = `
      SELECT * FROM earthquakes 
      WHERE (reference LIKE ? OR reference2 LIKE ? OR reference3 LIKE ?)
      AND (
        (utc_date IS NOT NULL AND utc_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY))
        OR (datetime_utc IS NOT NULL AND datetime_utc >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY))
      )
      ORDER BY COALESCE(utc_date, datetime_utc) DESC 
      LIMIT 2000
    `;
    const searchTerm = `%${reference}%`;
    const [rows] = await connection.query(query, [searchTerm, searchTerm, searchTerm, daysWindow, daysWindow]);
    return filterEarthquakesByPeruHours(rows, hours);
  } finally {
    connection.release();
  }
}

/**
 * Obtiene estado de última actualización
 */
async function getEarthquakeLastUpdateStatus() {
  const connection = await pool.getConnection();
  try {
    const query = `
      SELECT 
        COUNT(*) as total_records,
        MAX(updated_at) as last_update,
        MAX(datetime_utc) as last_earthquake
      FROM earthquakes
    `;
    const [rows] = await connection.query(query);
    return rows[0] || { total_records: 0, last_update: null, last_earthquake: null };
  } finally {
    connection.release();
  }
}

/**
 * Obtiene sismos significativos (últimas 24 horas, magnitud >= 4.0)
 */
async function getSignificantEarthquakes(magnitudeThreshold = 4.0) {
  const connection = await pool.getConnection();
  try {
    const hours = 24;
    const daysWindow = Math.max(1, Math.ceil(hours / 24) + 1);
    const query = `
      SELECT * FROM earthquakes 
      WHERE magnitude >= ? 
      AND (
        (utc_date IS NOT NULL AND utc_date >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY))
        OR (datetime_utc IS NOT NULL AND datetime_utc >= DATE_SUB(UTC_DATE(), INTERVAL ? DAY))
      )
      ORDER BY magnitude DESC, COALESCE(utc_date, datetime_utc) DESC
    `;
    const [rows] = await connection.query(query, [magnitudeThreshold, daysWindow, daysWindow]);
    return filterEarthquakesByPeruHours(rows, hours);
  } finally {
    connection.release();
  }
}

/**
 * Obtiene estadísticas de campos faltantes en sismos
 * @returns {Promise<Object>} Estadísticas de campos
 */
async function getEarthquakeDataStats() {
  const connection = await pool.getConnection();
  try {
    const query = `
      SELECT 
        COUNT(*) as total_earthquakes,
        SUM(CASE WHEN seismic_map_url IS NULL THEN 1 ELSE 0 END) as missing_seismic_map,
        SUM(CASE WHEN theoretical_acceleration_map_url IS NULL THEN 1 ELSE 0 END) as missing_theoretical_acceleration,
        SUM(CASE WHEN intensity_map_url IS NULL THEN 1 ELSE 0 END) as missing_intensity_map,
        SUM(CASE WHEN pseudo_acceleration_map_url IS NULL THEN 1 ELSE 0 END) as missing_pseudo_acceleration,
        SUM(CASE WHEN max_acceleration_map_url IS NULL THEN 1 ELSE 0 END) as missing_max_acceleration,
        SUM(CASE WHEN max_velocity_map_url IS NULL THEN 1 ELSE 0 END) as missing_max_velocity,
        SUM(CASE WHEN accelerometric_report_pdf IS NULL THEN 1 ELSE 0 END) as missing_accelerometric_report,
        SUM(CASE WHEN code IS NULL AND codes IS NULL THEN 1 ELSE 0 END) as missing_code
      FROM earthquakes
    `;
    const [rows] = await connection.query(query);
    return rows[0] || {};
  } finally {
    connection.release();
  }
}

/**
 * Obtiene sismos que les faltan datos extras (mapas y reportes)
 * @param {number} limit - Límite de sismos a obtener
 * @returns {Promise<Array>} Sismos sin datos extras
 */
async function getEarthquakesWithoutExtraData(limit = 100) {
  const connection = await pool.getConnection();
  try {
    const query = `
      SELECT * FROM earthquakes 
      WHERE (seismic_map_url IS NULL 
        OR theoretical_acceleration_map_url IS NULL 
        OR intensity_map_url IS NULL
        OR pseudo_acceleration_map_url IS NULL
        OR max_acceleration_map_url IS NULL
        OR max_velocity_map_url IS NULL)
      AND (code IS NOT NULL OR codes IS NOT NULL)
      ORDER BY datetime_utc DESC 
      LIMIT ?
    `;
    const [rows] = await connection.query(query, [limit]);
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Actualiza solo los datos extras de un sismo (mapas y reportes)
 * @param {string} code - Código del sismo
 * @param {Object} extraData - Datos extras a actualizar
 * @returns {Promise<boolean>} True si se actualizó correctamente
 */
async function updateEarthquakeExtraData(code, extraData) {
  if (!code || !extraData) return false;

  const connection = await pool.getConnection();
  try {
    const query = `
      UPDATE earthquakes 
      SET 
        seismic_map_url = COALESCE(?, seismic_map_url),
        theoretical_acceleration_map_url = COALESCE(?, theoretical_acceleration_map_url),
        intensity_map_url = COALESCE(?, intensity_map_url),
        pseudo_acceleration_map_url = COALESCE(?, pseudo_acceleration_map_url),
        max_acceleration_map_url = COALESCE(?, max_acceleration_map_url),
        max_velocity_map_url = COALESCE(?, max_velocity_map_url),
        accelerometric_report_pdf = COALESCE(?, accelerometric_report_pdf),
        accelerometric_map_url = COALESCE(?, accelerometric_map_url),
        updated_at = NOW()
      WHERE code = ?
    `;

    const values = [
      extraData.mapa_sismico_url || null,
      extraData.mapa_aceleracion_teorica_url || null,
      extraData.mapa_intensidades_url || null,
      extraData.mapa_pseudo_aceleracion_url || null,
      extraData.mapa_aceleracion_maxima_url || null,
      extraData.mapa_velocidades_maxima_url || null,
      extraData.reporte_acelerometrico_pdf || null,
      extraData.mapa_aceleracion_teorica_url || null,
      code,
    ];

    const [result] = await connection.query(query, values);
    return result.affectedRows > 0;
  } catch (error) {
    console.error(`Error actualizando datos extras para ${code}:`, error.message);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Rellena los datos faltantes de sismos obteniendo la información desde la API del IGP
 * @param {number} limit - Límite de sismos a procesar
 * @param {number} delayMs - Delay entre peticiones en milisegundos
 * @returns {Promise<Object>} Resultado del proceso
 */
async function fillMissingEarthquakeData(limit = 100, delayMs = 1000) {
  const { fetchEarthquakeDetails } = require('./igp-scraper');
  
  try {
    console.log(`Buscando sismos sin datos extras (límite: ${limit})...`);
    const earthquakes = await getEarthquakesWithoutExtraData(limit);

    if (earthquakes.length === 0) {
      console.log('No hay sismos sin datos extras');
      return { total: 0, updated: 0, failed: 0 };
    }

    console.log(`Encontrados ${earthquakes.length} sismos sin datos completos`);

    let updated = 0;
    let failed = 0;

    for (const earthquake of earthquakes) {
      try {
        // Usar el campo 'code' o 'codes' el que esté disponible
        const codeToFetch = earthquake.code || earthquake.codes;
        
        if (!codeToFetch) {
          console.warn(`Sismo sin código válido, saltando...`);
          failed++;
          continue;
        }

        console.log(`Obteniendo datos extras para ${codeToFetch}...`);
        const details = await fetchEarthquakeDetails(codeToFetch);

        if (details) {
          const success = await updateEarthquakeExtraData(earthquake.code, details);
          if (success) {
            updated++;
            console.log(`✓ Actualizado ${codeToFetch}`);
          } else {
            failed++;
            console.warn(`✗ No se pudo actualizar ${codeToFetch}`);
          }
        } else {
          failed++;
          console.warn(`✗ No se obtuvieron detalles para ${codeToFetch}`);
        }

        // Delay para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error) {
        failed++;
        console.error(`Error procesando sismo ${earthquake.code}:`, error.message);
      }
    }

    console.log(`\nResultado: ${updated} actualizados, ${failed} fallidos de ${earthquakes.length} total`);
    return { total: earthquakes.length, updated, failed };
  } catch (error) {
    console.error('Error en fillMissingEarthquakeData:', error.message);
    throw error;
  }
}

module.exports = {
  batchUpsertEarthquakes,
  getEarthquakesByHoursRange,
  getEarthquakesByDaysRange,
  getEarthquakesByMinimumMagnitude,
  getLastEarthquake,
  getEarthquakeByCode,
  getEarthquakesByReference,
  getEarthquakeLastUpdateStatus,
  getSignificantEarthquakes,
  getEarthquakeDataStats,
  getEarthquakesWithoutExtraData,
  updateEarthquakeExtraData,
  fillMissingEarthquakeData,
  convertToMySQLDatetime,
  mapIGPToDatabase,
};
