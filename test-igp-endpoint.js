const fetch = require('node-fetch');

async function testEarthquakeEndpoint() {
  try {
    console.log('🌐 Probando endpoint /v2/peru/igp/earthquakes\n');

    // Test 1: Últimas 24 horas (default)
    console.log('=== Test 1: GET /earthquakes (últimas 24h) ===\n');
    const res24h = await fetch('http://localhost:4200/v2/peru/igp/earthquakes', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data24h = await res24h.json();
    console.log(`Status: ${res24h.status}`);
    console.log(`Sismos en últimas 24h: ${data24h.count}`);
    console.log(`Range: ${data24h.range}`);
    
    if (data24h.data && data24h.data.length > 0) {
      console.log('\nPrimeros 3 sismos:');
      data24h.data.slice(0, 3).forEach((s, i) => {
        console.log(`  ${i+1}. ${s.code || s.codes} | Mag: ${s.magnitude} | Ref: ${s.reference}`);
      });
    }

    // Test 2: Últimos 7 días
    console.log('\n\n=== Test 2: GET /earthquakes?rango=dias&cantidad=7 ===\n');
    const res7d = await fetch('http://localhost:4200/v2/peru/igp/earthquakes?rango=dias&cantidad=7', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data7d = await res7d.json();
    console.log(`Status: ${res7d.status}`);
    console.log(`Sismos en últimos 7 días: ${data7d.count}`);
    console.log(`Range: ${data7d.range}`);

    // Test 3: Significativos
    console.log('\n\n=== Test 3: GET /earthquakes/significant ===\n');
    const resSignificant = await fetch('http://localhost:4200/v2/peru/igp/earthquakes/significant');
    const dataSignificant = await resSignificant.json();
    console.log(`Status: ${resSignificant.status}`);
    console.log(`Sismos significativos (mag >= 4.0): ${dataSignificant.count || dataSignificant.data?.length || 0}`);

    // Test 4: Por referencia Pucallpa
    console.log('\n\n=== Test 4: GET /earthquakes/reference/Pucallpa ===\n');
    const resRef = await fetch('http://localhost:4200/v2/peru/igp/earthquakes/reference/Pucallpa');
    const dataRef = await resRef.json();
    console.log(`Status: ${resRef.status}`);
    console.log(`Sismos cerca de Pucallpa: ${dataRef.count || dataRef.data?.length || 0}`);
    
    if (dataRef.data && dataRef.data.length > 0) {
      console.log('\nPrimero encontrado:');
      const s = dataRef.data[0];
      console.log(`  ${s.code || s.codes} | Mag: ${s.magnitude} | Ref: ${s.reference}`);
    }

    console.log('\n✅ Tests completados');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Esperar a que el servidor esté disponible
setTimeout(testEarthquakeEndpoint, 2000);
