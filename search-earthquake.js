const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

async function searchEarthquake() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 Buscando sismo del 26/2 con magnitud ~4.10...\n');

    // Búsqueda 1: Por magnitud cercana a 4.10
    console.log('=== Búsqueda 1: Por magnitud (3.9 - 4.2) ===');
    const [queryMag] = await connection.query(`
      SELECT code, codes, magnitude, 
             date, datetime_utc, utc_date, local_date,
             reference, latitude, longitude
      FROM earthquakes 
      WHERE magnitude BETWEEN 3.9 AND 4.2
      ORDER BY magnitude DESC
      LIMIT 20
    `);
    
    console.log(`Encontrados: ${queryMag.length}`);
    queryMag.forEach((row, i) => {
      console.log(`\n  ${i+1}. ${row.code || row.codes} - Mag: ${row.magnitude}`);
      console.log(`     Fecha: ${row.datetime_utc || row.utc_date || row.date}`);
      console.log(`     Ref: ${row.reference}`);
      console.log(`     Coords: ${row.latitude}, ${row.longitude}`);
    });

    // Búsqueda 2: Por referencia (Pucallpa)
    console.log('\n\n=== Búsqueda 2: Por referencia (Pucallpa) ===');
    const [queryPucallpa] = await connection.query(`
      SELECT code, codes, magnitude, 
             date, datetime_utc, utc_date, local_date,
             reference, latitude, longitude
      FROM earthquakes 
      WHERE reference LIKE '%Pucallpa%' OR reference LIKE '%Coronel Portillo%'
      ORDER BY datetime_utc DESC
      LIMIT 20
    `);
    
    console.log(`Encontrados: ${queryPucallpa.length}`);
    queryPucallpa.forEach((row, i) => {
      console.log(`\n  ${i+1}. ${row.code || row.codes} - Mag: ${row.magnitude}`);
      console.log(`     Fecha: ${row.datetime_utc || row.utc_date || row.date}`);
      console.log(`     Ref: ${row.reference}`);
      console.log(`     Coords: ${row.latitude}, ${row.longitude}`);
    });

    // Búsqueda 3: Por coordenadas (-8.320000, -74.330000)
    console.log('\n\n=== Búsqueda 3: Por coordenadas cercanas (-8.32, -74.33) ===');
    const [queryCoordsClose] = await connection.query(`
      SELECT code, codes, magnitude, 
             date, datetime_utc, utc_date, local_date,
             reference, latitude, longitude
      FROM earthquakes 
      WHERE latitude BETWEEN -8.5 AND -8.1 
        AND longitude BETWEEN -74.5 AND -74.1
      ORDER BY datetime_utc DESC
      LIMIT 20
    `);
    
    console.log(`Encontrados: ${queryCoordsClose.length}`);
    queryCoordsClose.forEach((row, i) => {
      console.log(`\n  ${i+1}. ${row.code || row.codes} - Mag: ${row.magnitude}`);
      console.log(`     Fecha: ${row.datetime_utc || row.utc_date || row.date}`);
      console.log(`     Ref: ${row.reference}`);
      console.log(`     Coords: ${row.latitude}, ${row.longitude}`);
    });

    // Búsqueda 4: Todos los sismos del 26/2
    console.log('\n\n=== Búsqueda 4: Todos los sismos del 26/2 (sin filtro de hora) ===');
    const [query26] = await connection.query(`
      SELECT code, codes, magnitude, 
             date, datetime_utc, utc_date, local_date,
             reference, latitude, longitude
      FROM earthquakes 
      WHERE DATE(COALESCE(datetime_utc, utc_date, date)) = '2026-02-26'
      ORDER BY COALESCE(datetime_utc, utc_date, date) DESC
      LIMIT 20
    `);
    
    console.log(`Encontrados: ${query26.length}`);
    query26.forEach((row, i) => {
      console.log(`\n  ${i+1}. ${row.code || row.codes} - Mag: ${row.magnitude}`);
      console.log(`     Fecha: ${row.datetime_utc || row.utc_date || row.date}`);
      console.log(`     Ref: ${row.reference}`);
      console.log(`     Coords: ${row.latitude}, ${row.longitude}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

searchEarthquake();
