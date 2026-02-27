const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function analyzeEarthquake() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📋 Analizando sismo 2026-0103 (26/2 Pucallpa)...\n');

    // Obtener todos los campos disponibles
    const [rows] = await connection.query(`
      SELECT * FROM earthquakes WHERE code = '2026-0103'
    `);

    if (rows.length === 0) {
      console.log('❌ Sismo no encontrado');
      return;
    }

    const sismo = rows[0];
    console.log('=== CAMPOS DE FECHA ===');
    console.log(`  date: ${sismo.date}`);
    console.log(`  local_date: ${sismo.local_date}`);
    console.log(`  local_time: ${sismo.local_time}`);
    console.log(`  utc_date: ${sismo.utc_date}`);
    console.log(`  utc_time: ${sismo.utc_time}`);
    console.log(`  datetime_utc: ${sismo.datetime_utc}`);
    console.log(`  created_at: ${sismo.created_at}`);
    console.log(`  updated_at: ${sismo.updated_at}`);

    console.log('\n=== OTROS CAMPOS ===');
    console.log(`  code: ${sismo.code}`);
    console.log(`  magnitude: ${sismo.magnitude}`);
    console.log(`  reference: ${sismo.reference}`);
    console.log(`  latitude: ${sismo.latitude}`);
    console.log(`  longitude: ${sismo.longitude}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

analyzeEarthquake();
