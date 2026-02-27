const fetch = require('node-fetch');

async function forceUpdate() {
  try {
    console.log('🔄 Forzando actualización manual de sismos...\n');

    const response = await fetch('http://localhost:4200/v2/peru/igp/earthquakes/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Actualización completada');
      console.log('\n⏳ Esperando 2 segundos y verificando resultados...\n');
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verificar los resultados
      const checkResponse = await fetch('http://localhost:4200/v2/peru/igp/earthquakes');
      const checkData = await checkResponse.json();
      
      console.log(`📊 Sismos en últimas 24h: ${checkData.count}`);
      console.log(`📅 Range: ${checkData.range}\n`);

      if (checkData.data && checkData.data.length > 0) {
        console.log('=== Todos los sismos ===\n');
        checkData.data.forEach((s, i) => {
          console.log(`${i + 1}. ${s.code}`);
          console.log(`   Mag: ${s.magnitude} | ${s.reference}`);
          console.log(`   datetime_utc: ${s.datetime_utc}`);
          
          if (s.datetime_utc) {
            const sismoDate = new Date(s.datetime_utc);
            const now = new Date();
            const hoursAgo = (now - sismoDate) / (1000 * 60 * 60);
            console.log(`   ⏰ Hace ${hoursAgo.toFixed(1)} horas`);
          }
          console.log('');
        });
      }

      console.log(`\n${checkData.count === 5 ? '✅' : '❌'} Esperados: 5 sismos | Obtenidos: ${checkData.count}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceUpdate();
