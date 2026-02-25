const mysql = require('mysql2/promise');

// Crear pool de conexiones a MariaDB (igual que en igp-db.js)
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
 * Inicializa la base de datos creando las tablas necesarias
 */
async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    // Primero, verificar si la tabla existe
    const [tables] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'crime_points'
    `);

    const tableExists = tables[0].count > 0;

    if (!tableExists) {
      // Crear tabla principal de puntos de delitos
      await connection.query(`
        CREATE TABLE crime_points (
          id                  INT AUTO_INCREMENT PRIMARY KEY,
          source_id           INT,
          ubigeo_code         VARCHAR(10),
          longitude           DECIMAL(10, 7) NOT NULL,
          latitude            DECIMAL(10, 7) NOT NULL,
          crime_type          VARCHAR(100),
          dept_code           VARCHAR(5),
          dept_name           VARCHAR(50),
          prov_code           VARCHAR(5),
          prov_name           VARCHAR(50),
          dist_code           VARCHAR(5),
          dist_name           VARCHAR(50),
          capital_name        VARCHAR(50),
          geom_area           DECIMAL(15, 8),
          geom_length         DECIMAL(15, 8),
          origin_desc         VARCHAR(100),
          urban_nucleus       VARCHAR(100),
          influence_zone      VARCHAR(100),
          INDEX idx_crime_type (crime_type),
          INDEX idx_ubigeo (ubigeo_code),
          INDEX idx_dept (dept_code),
          INDEX idx_location (longitude, latitude),
          INDEX idx_source (source_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Crear índice único más completo (coordenadas + tipo + núcleo urbano)
      await connection.query(`
        CREATE UNIQUE INDEX idx_unique_crime 
        ON crime_points(longitude, latitude, crime_type(50), urban_nucleus(50))
      `);

      console.log('✓ Tabla crime_points creada');
    } else {
      console.log('✓ Tabla crime_points ya existe');
    }
  } finally {
    connection.release();
  }
}

/**
 * Inserta o actualiza puntos de delitos
 * @param {Array} crimePoints - Array de puntos de delitos
 * @returns {Promise<Object>} Resultado con contadores
 */
async function upsertCrimePoints(crimePoints) {
  if (!crimePoints || crimePoints.length === 0) {
    return { inserted: 0, updated: 0, duplicated: 0, failed: 0 };
  }

  const connection = await pool.getConnection();
  let inserted = 0;
  let updated = 0;
  let duplicated = 0;
  let failed = 0;

  try {
    for (const point of crimePoints) {
      try {
        const attrs = point.attributes || {};

        // Usar INSERT IGNORE para ignorar duplicados sin actualizar
        const query = `
          INSERT IGNORE INTO crime_points (
            source_id, ubigeo_code, longitude, latitude, crime_type,
            dept_code, dept_name, prov_code, prov_name, dist_code,
            dist_name, capital_name, geom_area, geom_length, origin_desc,
            urban_nucleus, influence_zone
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
          attrs.OBJECTID || null,
          attrs.UBIGEO || null,
          point.x || point.longitude,
          point.y || point.latitude,
          attrs.DELITO_ESP || null,
          attrs.CCDD || null,
          attrs.NOMBDEP || null,
          attrs.CCPP || null,
          attrs.NOMBPROV || null,
          attrs.CCDI || null,
          attrs.NOMBDIST || null,
          attrs.CAPITAL || null,
          attrs.geom_STAre || null,
          attrs.geom_STLen || null,
          attrs.PROCEDEN_D || null,
          attrs.NUCLEO_URB || null,
          attrs.ZONA__INFL || null,
        ];

        const [result] = await connection.query(query, values);
        
        if (result.affectedRows === 1) {
          inserted++;
        } else if (result.affectedRows === 0) {
          // Si affectedRows es 0, significa que fue duplicado e ignorado
          duplicated++;
        }
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          duplicated++;
        } else {
          failed++;
          console.error('Error insertando punto:', error.message);
        }
      }
    }

    return { inserted, updated, duplicated, failed };
  } finally {
    connection.release();
  }
}

/**
 * Obtiene puntos de delitos con filtros
 */
async function getCrimePoints(filters = {}) {
  const connection = await pool.getConnection();
  try {
    const {
      limit = 100,
      offset = 0,
      crimeType,
      deptCode,
      provCode,
      distCode,
      ubigeo,
      minLat,
      maxLat,
      minLon,
      maxLon,
    } = filters;

    let query = 'SELECT * FROM crime_points WHERE 1=1';
    const params = [];

    if (crimeType) {
      query += ' AND crime_type LIKE ?';
      params.push(`%${crimeType}%`);
    }

    if (deptCode) {
      query += ' AND dept_code = ?';
      params.push(deptCode);
    }

    if (provCode) {
      query += ' AND prov_code = ?';
      params.push(provCode);
    }

    if (distCode) {
      query += ' AND dist_code = ?';
      params.push(distCode);
    }

    if (ubigeo) {
      query += ' AND ubigeo_code = ?';
      params.push(ubigeo);
    }

    // Filtro por bounding box
    if (minLat !== undefined && maxLat !== undefined && minLon !== undefined && maxLon !== undefined) {
      query += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
      params.push(minLat, maxLat, minLon, maxLon);
    }

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await connection.query(query, params);
    return rows || [];
  } finally {
    connection.release();
  }
}

/**
 * Obtiene estadísticas de delitos
 */
async function getCrimeStats() {
  const connection = await pool.getConnection();
  try {
    const [statsRows] = await connection.query(`
      SELECT 
        COUNT(*) as total_points,
        COUNT(DISTINCT crime_type) as total_crime_types,
        COUNT(DISTINCT dept_code) as total_departments,
        COUNT(DISTINCT ubigeo_code) as total_locations,
        MIN(id) as first_id,
        MAX(id) as last_id
      FROM crime_points
    `);

    const [crimeTypes] = await connection.query(`
      SELECT crime_type, COUNT(*) as count 
      FROM crime_points 
      GROUP BY crime_type 
      ORDER BY count DESC 
      LIMIT 10
    `);

    return {
      ...statsRows[0],
      top_crime_types: crimeTypes,
    };
  } finally {
    connection.release();
  }
}

/**
 * Cuenta puntos de delitos con filtros
 */
async function countCrimePoints(filters = {}) {
  const connection = await pool.getConnection();
  try {
    const { crimeType, deptCode, provCode, distCode, ubigeo } = filters;

    let query = 'SELECT COUNT(*) as count FROM crime_points WHERE 1=1';
    const params = [];

    if (crimeType) {
      query += ' AND crime_type LIKE ?';
      params.push(`%${crimeType}%`);
    }

    if (deptCode) {
      query += ' AND dept_code = ?';
      params.push(deptCode);
    }

    if (provCode) {
      query += ' AND prov_code = ?';
      params.push(provCode);
    }

    if (distCode) {
      query += ' AND dist_code = ?';
      params.push(distCode);
    }

    if (ubigeo) {
      query += ' AND ubigeo_code = ?';
      params.push(ubigeo);
    }

    const [rows] = await connection.query(query, params);
    return rows[0].count || 0;
  } finally {
    connection.release();
  }
}

/**
 * Obtiene tipos de delitos únicos
 */
async function getCrimeTypes() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(`
      SELECT DISTINCT crime_type, COUNT(*) as count 
      FROM crime_points 
      WHERE crime_type IS NOT NULL 
      GROUP BY crime_type 
      ORDER BY count DESC
    `);
    return rows || [];
  } finally {
    connection.release();
  }
}

/**
 * Limpia registros antiguos (basado en ID, no en fecha)
 * Mantiene solo los últimos N registros
 */
async function cleanOldRecords(keepCount = 10000) {
  const connection = await pool.getConnection();
  try {
    // Eliminar registros excepto los últimos N
    const [result] = await connection.query(
      `DELETE FROM crime_points 
       WHERE id NOT IN (
         SELECT id FROM (
           SELECT id FROM crime_points ORDER BY id DESC LIMIT ?
         ) AS keep_ids
       )`,
      [keepCount]
    );
    return result.affectedRows;
  } finally {
    connection.release();
  }
}

module.exports = {
  initializeDatabase,
  upsertCrimePoints,
  getCrimePoints,
  getCrimeStats,
  countCrimePoints,
  getCrimeTypes,
  cleanOldRecords,
};
