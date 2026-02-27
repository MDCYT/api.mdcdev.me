const mysql = require('mysql2/promise');

// Configuración de BD desde .env
const dbConfig = {
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

const UTC_COMBINED_EXPR = 'COALESCE(datetime_utc, utc_date, date)';

async function testEarthquakeFilter() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('✓ Conectado a la base de datos');
    console.log(`\n📊 Probando filtros de sismos...\n`);

    // Test 1: Obtener sismos de las últimas 24 horas
    console.log('=== Test 1: Sismos últimas 24 horas ===');
    const query24h = `
      SELECT code, codes, magnitude, 
             ${UTC_COMBINED_EXPR} as fecha_sismo,
             TIMESTAMPDIFF(HOUR, ${UTC_COMBINED_EXPR}, UTC_TIMESTAMP()) as horas_atras
      FROM earthquakes 
      WHERE ${UTC_COMBINED_EXPR} IS NOT NULL
      AND ${UTC_COMBINED_EXPR} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
      AND ${UTC_COMBINED_EXPR} <= UTC_TIMESTAMP()
      ORDER BY ${UTC_COMBINED_EXPR} DESC
      LIMIT 10
    `;
    
    const [rows24h] = await connection.query(query24h);
    console.log(`Sismos encontrados en últimas 24h: ${rows24h.length}\n`);
    
    if (rows24h.length > 0) {
      rows24h.forEach(sismo => {
        console.log(`  • ${sismo.code || sismo.codes} | Mag: ${sismo.magnitude} | Hace ${sismo.horas_atras}h | ${sismo.fecha_sismo}`);
      });
    } else {
      console.log('  ℹ No hay sismos en las últimas 24 horas');
    }

    // Test 2: Obtener el sismo del 26/2 para verificar que esté en BD pero filtrado
    console.log('\n=== Test 2: Buscando sismo del 26/2 (debe existir pero ser filtrado) ===');
    const querySismo26 = `
      SELECT code, codes, magnitude, 
             ${UTC_COMBINED_EXPR} as fecha_sismo,
             TIMESTAMPDIFF(HOUR, ${UTC_COMBINED_EXPR}, UTC_TIMESTAMP()) as horas_atras
      FROM earthquakes 
      WHERE ${UTC_COMBINED_EXPR} IS NOT NULL
      AND ${UTC_COMBINED_EXPR} >= '2026-02-26 01:00:00'
      AND ${UTC_COMBINED_EXPR} <= '2026-02-26 02:00:00'
      ORDER BY ${UTC_COMBINED_EXPR} DESC
    `;
    
    const [rowsSismo26] = await connection.query(querySismo26);
    console.log(`Sismos encontrados el 26/2 01:54 AM: ${rowsSismo26.length}\n`);
    
    if (rowsSismo26.length > 0) {
      rowsSismo26.forEach(sismo => {
        console.log(`  • ${sismo.code || sismo.codes} | Mag: ${sismo.magnitude} | Hace ${sismo.horas_atras}h | ${sismo.fecha_sismo}`);
        console.log(`    ✓ EN BASE DE DATOS pero ✗ FILTRADO por ser > 24h`);
      });
    } else {
      console.log('  ℹ No hay sismos registrados en esa fecha/hora');
    }

    // Test 3: Verificar todos los sismos sin importar antigüedad
    console.log('\n=== Test 3: Total de sismos en la BD ===');
    const queryTotal = `
      SELECT COUNT(*) as total,
             MIN(${UTC_COMBINED_EXPR}) as fecha_mas_antigua,
             MAX(${UTC_COMBINED_EXPR}) as fecha_mas_nueva
      FROM earthquakes
      WHERE ${UTC_COMBINED_EXPR} IS NOT NULL
    `;
    
    const [statsRows] = await connection.query(queryTotal);
    const stats = statsRows[0];
    console.log(`  Total de sismos: ${stats.total}`);
    console.log(`  Más antiguo: ${stats.fecha_mas_antigua}`);
    console.log(`  Más reciente: ${stats.fecha_mas_nueva}`);

    // Test 4: Verificar sismos significativos (magnitud >= 4.0)
    console.log('\n=== Test 4: Sismos significativos (mag >= 4.0) últimas 24h ===');
    const querySignificant = `
      SELECT code, codes, magnitude, 
             ${UTC_COMBINED_EXPR} as fecha_sismo,
             TIMESTAMPDIFF(HOUR, ${UTC_COMBINED_EXPR}, UTC_TIMESTAMP()) as horas_atras
      FROM earthquakes 
      WHERE magnitude >= 4.0
      AND ${UTC_COMBINED_EXPR} IS NOT NULL
      AND ${UTC_COMBINED_EXPR} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
      AND ${UTC_COMBINED_EXPR} <= UTC_TIMESTAMP()
      ORDER BY magnitude DESC, ${UTC_COMBINED_EXPR} DESC
      LIMIT 10
    `;
    
    const [rowsSignificant] = await connection.query(querySignificant);
    console.log(`Sismos significativos encontrados: ${rowsSignificant.length}\n`);
    
    if (rowsSignificant.length > 0) {
      rowsSignificant.forEach(sismo => {
        console.log(`  • ${sismo.code || sismo.codes} | Mag: ${sismo.magnitude} | Hace ${sismo.horas_atras}h | ${sismo.fecha_sismo}`);
      });
    } else {
      console.log('  ℹ No hay sismos significativos en las últimas 24 horas');
    }

    console.log('\n✅ Pruebas completadas\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testEarthquakeFilter();
