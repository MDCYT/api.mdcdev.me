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
 * @param {string} isoDate - Fecha en formato ISO (ej: "2026-02-24T05:39:52.000Z")
 * @returns {string|null} Fecha en formato MySQL DATETIME (ej: "2026-02-24 05:39:52")
 */
function convertToMySQLDatetime(isoDate) {
  if (!isoDate) return null;
  
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return null;
    
    // Formato: YYYY-MM-DD HH:MM:SS
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

/**
 * Obtiene todos los incidentes de la BD
 */
async function getIncidentes() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT * FROM bomberos_incidentes ORDER BY occurred_at DESC LIMIT 1000');
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene incidentes con coordenadas faltantes o invalidas
 */
async function getIncidentesMissingGeo(limit = 50) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `
        SELECT id, location, district, latitude, longitude
        FROM bomberos_incidentes
        WHERE latitude IS NULL
          OR longitude IS NULL
          OR (latitude = 0 AND longitude = 0)
          OR location REGEXP '\\([^)]*\\)'
        ORDER BY occurred_at DESC
        LIMIT ?
      `,
      [limit]
    );
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Actualiza coordenadas y ubicacion de un incidente
 */
async function updateIncidenteGeo(id, latitude, longitude, location) {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      `
        UPDATE bomberos_incidentes
        SET location = COALESCE(NULLIF(?, ''), location),
            latitude = COALESCE(?, latitude),
            longitude = COALESCE(?, longitude)
        WHERE id = ?
      `,
      [location, latitude, longitude, id]
    );
    return true;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene un incidente por ID
 */
async function getIncidenteById(id) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT * FROM bomberos_incidentes WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  } finally {
    connection.release();
  }
}

/**
 * Inserta un nuevo incidente o actualiza si ya existe
 */
async function upsertIncidente(incidente) {
  const connection = await pool.getConnection();
  try {
    const query = `
      INSERT INTO bomberos_incidentes (id, report_number, type, district, location, occurred_at, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        report_number = VALUES(report_number),
        type = VALUES(type),
        district = VALUES(district),
        location = VALUES(location),
        occurred_at = VALUES(occurred_at),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        created_at = CURRENT_TIMESTAMP
    `;
    
    const values = [
      incidente.id || incidente.numparte,
      incidente.numparte || incidente.report_number,
      incidente.tipo || incidente.type,
      incidente.distrito || incidente.district,
      incidente.ubicacion || incidente.location,
      convertToMySQLDatetime(incidente.hora || incidente.occurred_at),
      incidente.latitud !== undefined ? incidente.latitud : incidente.latitude,
      incidente.longitud !== undefined ? incidente.longitud : incidente.longitude,
    ];
    
    await connection.query(query, values);
    return true;
  } finally {
    connection.release();
  }
}

/**
 * Inserta múltiples incidentes
 */
async function batchUpsertIncidentes(incidentes) {
  const connection = await pool.getConnection();
  try {
    for (const incidente of incidentes) {
      const query = `
        INSERT INTO bomberos_incidentes (id, report_number, type, district, location, occurred_at, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          report_number = VALUES(report_number),
          type = VALUES(type),
          district = VALUES(district),
          location = VALUES(location),
          occurred_at = VALUES(occurred_at),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude)
      `;
      
      const values = [
        incidente.id || incidente.numparte,
        incidente.numparte || incidente.report_number,
        incidente.tipo || incidente.type,
        incidente.distrito || incidente.district,
        incidente.ubicacion || incidente.location,
        convertToMySQLDatetime(incidente.hora || incidente.occurred_at),
        incidente.latitud !== undefined ? incidente.latitud : incidente.latitude,
        incidente.longitud !== undefined ? incidente.longitud : incidente.longitude,
      ];
      
      await connection.query(query, values);
    }
    return true;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene incidentes dentro de un rango de horas
 */
async function getIncidentesByHoursRange(hours = 24) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM bomberos_incidentes WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL ? HOUR) ORDER BY occurred_at DESC LIMIT 2000',
      [hours]
    );
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene incidentes dentro de un rango de días
 */
async function getIncidentesByDaysRange(days = 1) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM bomberos_incidentes WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY occurred_at DESC LIMIT 5000',
      [days]
    );
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene incidentes por distrito
 */
async function getIncidentesByDistrito(distrito) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM bomberos_incidentes WHERE district LIKE ? ORDER BY occurred_at DESC LIMIT 1000',
      [`%${distrito}%`]
    );
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene el estado de la última actualización
 */
async function getLastUpdateStatus() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT MAX(created_at) as last_update, COUNT(*) as total_records FROM bomberos_incidentes'
    );
    return rows[0] || { last_update: null, total_records: 0 };
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  convertToMySQLDatetime,
  getIncidentes,
  getIncidentesMissingGeo,
  getIncidenteById,
  upsertIncidente,
  batchUpsertIncidentes,
  getIncidentesByHoursRange,
  getIncidentesByDaysRange,
  getIncidentesByDistrito,
  getLastUpdateStatus,
  updateIncidenteGeo,
};
