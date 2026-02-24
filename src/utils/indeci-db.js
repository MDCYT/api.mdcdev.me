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

async function batchUpsertIndeci(incidentes) {
  const connection = await pool.getConnection();
  try {
    for (const incidente of incidentes) {
      const query = `
        INSERT INTO indeci_incidentes (
          id, sinpad_code, type, description, location, district, province, region,
          occurred_at, latitude, longitude, affected_people, object_id, raw_timestamp_ms, raw
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          sinpad_code = VALUES(sinpad_code),
          type = VALUES(type),
          description = VALUES(description),
          location = VALUES(location),
          district = VALUES(district),
          province = VALUES(province),
          region = VALUES(region),
          occurred_at = VALUES(occurred_at),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude),
          affected_people = CASE
            WHEN VALUES(affected_people) <> 0 AND affected_people <> VALUES(affected_people)
              THEN VALUES(affected_people)
            ELSE affected_people
          END,
          object_id = VALUES(object_id),
          raw_timestamp_ms = VALUES(raw_timestamp_ms),
          raw = VALUES(raw)
      `;

      const values = [
        incidente.id,
        incidente.sinpad_code,
        incidente.type,
        incidente.description,
        incidente.location,
        incidente.district,
        incidente.province,
        incidente.region,
        convertToMySQLDatetime(incidente.occurred_at),
        incidente.latitude,
        incidente.longitude,
        incidente.affected_people,
        incidente.object_id,
        incidente.raw_timestamp_ms,
        JSON.stringify(incidente.raw || {}),
      ];

      await connection.query(query, values);
    }
    return true;
  } finally {
    connection.release();
  }
}

async function getIndeciByHoursRange(hours = 24) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM indeci_incidentes WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL ? HOUR) ORDER BY occurred_at DESC LIMIT 2000',
      [hours]
    );
    return rows;
  } finally {
    connection.release();
  }
}

async function getIndeciByDaysRange(days = 1) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM indeci_incidentes WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY occurred_at DESC LIMIT 5000',
      [days]
    );
    return rows;
  } finally {
    connection.release();
  }
}

async function getIndeciByDistrito(distrito) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM indeci_incidentes WHERE district LIKE ? ORDER BY occurred_at DESC LIMIT 1000',
      [`%${distrito}%`]
    );
    return rows;
  } finally {
    connection.release();
  }
}

async function getIndeciLastUpdateStatus() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT MAX(created_at) as last_update, COUNT(*) as total_records FROM indeci_incidentes'
    );
    return rows[0] || { last_update: null, total_records: 0 };
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  convertToMySQLDatetime,
  batchUpsertIndeci,
  getIndeciByHoursRange,
  getIndeciByDaysRange,
  getIndeciByDistrito,
  getIndeciLastUpdateStatus,
};
