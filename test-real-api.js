const fetch = require('node-fetch');

async function testRealAPIData() {
  try {
    console.log('📡 Obteniendo datos reales del API del IGP...\n');

    const url = 'https://ultimosismo.igp.gob.pe/api/ultimo-sismo/ajaxb/2026';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API retornó status ${response.status}`);
    }

    const data = await response.json();
    console.log(`✓ Obtenidos ${data.length} sismos\n`);

    // Mostrar los primeros 3 sismos con sus campos de fecha/hora
    console.log('=== Estructura de datos del API ===\n');
    data.slice(0, 3).forEach((sismo, i) => {
      console.log(`${i + 1}. Sismo ${sismo.codigo}:`);
      console.log(`   fecha_local: ${sismo.fecha_local}`);
      console.log(`   hora_local:  ${sismo.hora_local}`);
      console.log(`   fecha_utc:   ${sismo.fecha_utc}`);
      console.log(`   hora_utc:    ${sismo.hora_utc}`);
      console.log(`   magnitud:    ${sismo.magnitud}`);
      console.log(`   referencia:  ${sismo.referencia}`);
      console.log('');
    });

    // Probar la función de combinación
    console.log('=== Probando combineDatetimeFields() ===\n');

    function combineDatetimeFields(dateStr, timeStr) {
      if (!dateStr) return null;

      try {
        if (!timeStr) {
          // Convertir directamente
          const date = new Date(dateStr);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          const hours = String(date.getUTCHours()).padStart(2, '0');
          const minutes = String(date.getUTCMinutes()).padStart(2, '0');
          const seconds = String(date.getUTCSeconds()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }

        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) return null;

        const timeObj = new Date(timeStr);
        if (isNaN(timeObj.getTime())) {
          const year = dateObj.getUTCFullYear();
          const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getUTCDate()).padStart(2, '0');
          const hours = String(dateObj.getUTCHours()).padStart(2, '0');
          const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
          const seconds = String(dateObj.getUTCSeconds()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
        return null;
      }
    }

    data.slice(0, 3).forEach((sismo, i) => {
      const combined = combineDatetimeFields(sismo.fecha_utc, sismo.hora_utc);
      console.log(`${i + 1}. ${sismo.codigo}:`);
      console.log(`   fecha_utc + hora_utc = ${combined}`);
      
      // Calcular antigüedad
      if (combined) {
        const sismoDate = new Date(combined + 'Z'); // Agregar Z para que lo trate como UTC
        const now = new Date();
        const hoursAgo = (now - sismoDate) / (1000 * 60 * 60);
        console.log(`   ⏰ Hace ${hoursAgo.toFixed(1)} horas`);
        console.log(`   ${hoursAgo <= 24 ? '✅ Dentro de 24h' : '❌ Fuera de 24h'}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRealAPIData();
