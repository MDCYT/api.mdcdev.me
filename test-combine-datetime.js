const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function testCombineDatetime() {
  // Simular la función combineDatetimeFields
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
      console.error('Error:', error);
      return null;
    }
  }

  function combineDatetimeFields(dateStr, timeStr) {
    if (!dateStr) return null;

    try {
      if (!timeStr) {
        return convertToMySQLDatetime(dateStr);
      }

      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return null;

      const timeObj = new Date(timeStr);
      if (isNaN(timeObj.getTime())) {
        return convertToMySQLDatetime(dateStr);
      }

      const combined = new Date(
        dateObj.getUTCFullYear(),
        dateObj.getUTCMonth(),
        dateObj.getUTCDate(),
        timeObj.getUTCHours(),
        timeObj.getUTCMinutes(),
        timeObj.getUTCSeconds()
      );

      const year = combined.getUTCFullYear();
      const month = String(combined.getUTCMonth() + 1).padStart(2, '0');
      const day = String(combined.getUTCDate()).padStart(2, '0');
      const hours = String(combined.getUTCHours()).padStart(2, '0');
      const minutes = String(combined.getUTCMinutes()).padStart(2, '0');
      const seconds = String(combined.getUTCSeconds()).padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('Error combinando:', error);
      return convertToMySQLDatetime(dateStr);
    }
  }

  // Test casos
  console.log('✅ Pruebas de combineDatetimeFields:\n');

  // Caso 1: Fecha y hora separadas
  const result1 = combineDatetimeFields('2026-02-26T00:00:00Z', '1970-01-01T01:54:13Z');
  console.log(`Test 1 - Fecha UTC + Hora UTC:`);
  console.log(`  Entrada: '2026-02-26T00:00:00Z' + '1970-01-01T01:54:13Z'`);
  console.log(`  Resultado: ${result1}`);
  console.log(`  ✓ Esperado: 2026-02-26 01:54:13\n`);

  // Caso 2: Solo fecha
  const result2 = combineDatetimeFields('2026-02-26T00:00:00Z', null);
  console.log(`Test 2 - Solo fecha:`);
  console.log(`  Entrada: '2026-02-26T00:00:00Z' + null`);
  console.log(`  Resultado: ${result2}`);
  console.log(`  ✓ Esperado: 2026-02-26 00:00:00\n`);

  // Caso 3: Desde BD
  console.log('✅ Probando con datos de la BD:\n');

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.query(`
      SELECT code, codes, magnitude, local_date, local_time, utc_date, utc_time, datetime_utc
      FROM earthquakes 
      WHERE code = '2026-0103'
    `);

    if (rows.length > 0) {
      const sismo = rows[0];
      console.log(`Sismo actual 2026-0103:`);
      console.log(`  local_date: ${sismo.local_date}`);
      console.log(`  local_time: ${sismo.local_time}`);
      console.log(`  utc_date: ${sismo.utc_date}`);
      console.log(`  utc_time: ${sismo.utc_time}`);
      console.log(`  datetime_utc: ${sismo.datetime_utc}`);
      
      // Simular qué sería si se combinaran correctamente
      if (sismo.utc_date && sismo.utc_time) {
        const corrected = combineDatetimeFields(sismo.utc_date.toISOString(), sismo.utc_time.toISOString());
        console.log(`\n  ✓ Debería ser: ${corrected}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

testCombineDatetime();
