/**
 * Script para recrear la tabla crime_points con el índice correcto
 * 
 * ADVERTENCIA: Esto eliminará todos los datos existentes en la tabla crime_points
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  console.log('=== Recrear tabla crime_points ===\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('🗑️  Eliminando tabla existente...');
    await connection.query('DROP TABLE IF EXISTS crime_points');
    console.log('✓ Tabla eliminada\n');

    console.log('📦 Creando tabla nueva...');
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
    console.log('✓ Tabla creada\n');

    console.log('🔑 Creando índice único (con todas las coordenadas y núcleo urbano)...');
    await connection.query(`
      CREATE UNIQUE INDEX idx_unique_crime 
      ON crime_points(longitude, latitude, crime_type(50), urban_nucleus(50))
    `);
    console.log('✓ Índice único creado\n');

    console.log('✅ Tabla recreada exitosamente');
    console.log('\nAhora ejecuta: npm run update:crime');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
