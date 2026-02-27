const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function checkTimestamps() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 Verificando timestamps de los 5 sismos más recientes...\n');

    const [rows] = await connection.query(`
      SELECT code, magnitude, reference,
             datetime_utc, utc_date, utc_time,
             DATE_FORMAT(datetime_utc, '%Y-%m-%d %H:%i:%s') as formatted_datetime
      FROM earthquakes 
      WHERE code IN ('2026-0105', '2026-0106', '2026-0107', '2026-0108', '2026-0109')
      ORDER BY datetime_utc DESC
    `);

    rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.code}`);
      console.log(`   datetime_utc (raw): ${row.datetime_utc}`);
      console.log(`   datetime_utc (formatted): ${row.formatted_datetime}`);
      console.log(`   utc_date: ${row.utc_date}`);
      console.log(`   utc_time: ${row.utc_time}`);
      console.log(`   Mag: ${row.magnitude} | ${row.reference}`);
      console.log('');
    });

    console.log('=== Datos esperados del API ===\n');
    console.log('2026-0105: hora_utc = 1970-01-01T23:21:08 -> debería ser 2026-02-26 23:21:08');
    console.log('2026-0106: hora_utc = 1970-01-01T23:48:33 -> debería ser 2026-02-26 23:48:33');
    console.log('2026-0107: hora_utc = 1970-01-01T04:47:29 -> debería ser 2026-02-27 04:47:29');
    console.log('2026-0108: hora_utc = 1970-01-01T08:30:39 -> debería ser 2026-02-27 08:30:39');
    console.log('2026-0109: hora_utc = 1970-01-01T13:01:47 -> debería ser 2026-02-27 13:01:47');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkTimestamps();
