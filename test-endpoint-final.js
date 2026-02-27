const fetch = require('node-fetch');

async function testEndpoint() {
  console.log('⏳ Esperando que el servidor inicie...\n');
  
  // Esperar 3 segundos
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    console.log('🌐 Probando endpoint /v2/peru/igp/earthquakes...\n');

    const response = await fetch('http://localhost:4200/v2/peru/igp/earthquakes');
    
    if (!response.ok) {
      console.log(`❌ Status: ${response.status}`);
      const text = await response.text();
      console.log(text);
      return;
    }

    const data = await response.json();
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Count: ${data.count}`);
    console.log(`📅 Range: ${data.range}`);
    console.log(`📌 Source: ${data.source}`);
    
    if (data.data && data.data.length > 0) {
      console.log(`\n=== Primeros 3 sismos ===\n`);
      data.data.slice(0, 3).forEach((s, i) => {
        console.log(`${i + 1}. ${s.code || s.codes}`);
        console.log(`   Mag: ${s.magnitude} | Ref: ${s.reference}`);
        console.log(`   datetime_utc: ${s.datetime_utc}`);
        
        if (s.datetime_utc) {
          const sismoDate = new Date(s.datetime_utc);
          const now = new Date();
          const hoursAgo = (now - sismoDate) / (1000 * 60 * 60);
          console.log(`   ⏰ Hace ${hoursAgo.toFixed(1)} horas`);
          console.log(`   ${hoursAgo <= 24 ? '✅ Dentro de 24h' : '❌ Fuera de 24h'}`);
        }
        console.log('');
      });
    }

    // Buscar el sismo del 26/2 específicamente
    console.log('\n=== Verificando sismo del 26/2 ===\n');
    const sismo26 = data.data.find(s => (s.code === '2026-0103' || s.codes === '2026-0103'));
    
    if (sismo26) {
      console.log(`❌ ERROR: El sismo 2026-0103 del 26/2 SÍ aparece en la lista`);
      console.log(`   datetime_utc: ${sismo26.datetime_utc}`);
      console.log(`   No debería estar aquí (> 24h)`);
    } else {
      console.log(`✅ CORRECTO: El sismo 2026-0103 del 26/2 NO aparece (filtrado correctamente)`);
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ No se pudo conectar al servidor. ¿Está corriendo en el puerto 4200?');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testEndpoint();
