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

async function deduplicateIndeciRecords() {
  const connection = await pool.getConnection();
  try {
    // Obtener todos los registros con su created_at para preservar el más viejo
    const [rows] = await connection.query('SELECT id, raw, created_at FROM indeci_incidentes WHERE raw IS NOT NULL');
    
    const ideMap = {}; // IDE_SINPAD -> {id, created_at}
    const allIdsByIde = {}; // IDE_SINPAD -> array de todos los IDs
    
    // Agrupar por IDE_SINPAD extraído del raw
    for (const row of rows) {
      try {
        const raw = typeof row.raw === 'string' ? JSON.parse(row.raw) : row.raw;
        const ideSinpad = raw?.attributes?.IDE_SINPAD;
        
        if (ideSinpad) {
          // Trackear todos los IDs para este IDE_SINPAD
          if (!allIdsByIde[ideSinpad]) {
            allIdsByIde[ideSinpad] = [];
          }
          allIdsByIde[ideSinpad].push(row.id);
          
          // Mantener el registro más viejo
          if (!ideMap[ideSinpad]) {
            ideMap[ideSinpad] = row;
          } else {
            const existingDate = new Date(ideMap[ideSinpad].created_at);
            const currentDate = new Date(row.created_at);
            
            if (currentDate < existingDate) {
              ideMap[ideSinpad] = row;
            }
          }
        }
      } catch (e) {
        // Saltar si hay error parseando raw
      }
    }
    
    // Identificar IDs a ELIMINAR (solo de los grupos que tienen duplicados)
    const idsToDelete = [];
    for (const ideSinpad in allIdsByIde) {
      if (allIdsByIde[ideSinpad].length > 1) {
        // Hay duplicados, eliminar todos excepto el más viejo
        const keepId = ideMap[ideSinpad].id;
        const otherIds = allIdsByIde[ideSinpad].filter(id => id !== keepId);
        idsToDelete.push(...otherIds);
      }
    }
    
    // Eliminar solo los IDs duplicados identificados
    let totalDeleted = 0;
    if (idsToDelete.length > 0) {
      const placeholders = idsToDelete.map(() => '?').join(',');
      const deleteQuery = `DELETE FROM indeci_incidentes WHERE id IN (${placeholders})`;
      const result = await connection.query(deleteQuery, idsToDelete);
      totalDeleted = result[0]?.affectedRows || 0;
    }
    
    console.log(`INDECI: eliminados ${totalDeleted} registros duplicados (mantenidos los más viejos por IDE_SINPAD)`);
    return totalDeleted;
  } finally {
    connection.release();
  }
}

async function countIndeciDuplicates() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT id, raw, created_at FROM indeci_incidentes WHERE raw IS NOT NULL');
    
    const ideMap = {}; // IDE_SINPAD -> array de {id, created_at}
    
    // Agrupar por IDE_SINPAD extraído del raw
    for (const row of rows) {
      try {
        const raw = typeof row.raw === 'string' ? JSON.parse(row.raw) : row.raw;
        const ideSinpad = raw?.attributes?.IDE_SINPAD;
        
        if (ideSinpad) {
          if (!ideMap[ideSinpad]) {
            ideMap[ideSinpad] = [];
          }
          ideMap[ideSinpad].push(row);
        }
      } catch (e) {
        // Saltar si hay error parseando raw
      }
    }
    
    // Retornar solo los que tienen duplicados con detalles
    return Object.entries(ideMap)
      .filter(([_, records]) => records.length > 1)
      .map(([ideSinpad, records]) => ({
        ide_sinpad: ideSinpad,
        count: records.length,
        records: records.map(r => ({ id: r.id, created_at: r.created_at }))
      }));
  } finally {
    connection.release();
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
  deduplicateIndeciRecords,
  countIndeciDuplicates,
  getIndeciByHoursRange,
  getIndeciByDaysRange,
  getIndeciByDistrito,
  getIndeciLastUpdateStatus,
};
