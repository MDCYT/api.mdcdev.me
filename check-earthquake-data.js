/**
 * Script para verificar el estado de los datos de sismos
 */

require('dotenv').config();
const { getEarthquakeDataStats, getEarthquakesWithoutExtraData, getLastEarthquake } = require('./src/utils/igp-db');

async function main() {
  console.log('=== Diagnóstico de datos de sismos ===\n');

  try {
    // Estadísticas generales
    console.log('📊 Estadísticas generales:');
    const stats = await getEarthquakeDataStats();
    
    console.log(`   Total de sismos: ${stats.total_earthquakes || 0}`);
    console.log(`   Sin mapa sísmico: ${stats.missing_seismic_map || 0}`);
    console.log(`   Sin mapa de aceleración teórica: ${stats.missing_theoretical_acceleration || 0}`);
    console.log(`   Sin mapa de intensidades: ${stats.missing_intensity_map || 0}`);
    console.log(`   Sin mapa de pseudo aceleración: ${stats.missing_pseudo_acceleration || 0}`);
    console.log(`   Sin mapa de aceleración máxima: ${stats.missing_max_acceleration || 0}`);
    console.log(`   Sin mapa de velocidad máxima: ${stats.missing_max_velocity || 0}`);
    console.log(`   Sin reporte acelerométrico: ${stats.missing_accelerometric_report || 0}`);
    console.log(`   Sin código válido: ${stats.missing_code || 0}\n`);

    // Último sismo
    console.log('🔍 Último sismo registrado:');
    const lastEarthquake = await getLastEarthquake();
    
    if (lastEarthquake) {
      console.log(`   Código: ${lastEarthquake.code || 'N/A'} (${lastEarthquake.codes || 'N/A'})`);
      console.log(`   Fecha: ${lastEarthquake.datetime_utc}`);
      console.log(`   Magnitud: ${lastEarthquake.magnitude}`);
      console.log(`   Referencia: ${lastEarthquake.reference}`);
      console.log(`   Tiene mapa sísmico: ${lastEarthquake.seismic_map_url ? '✓' : '✗'}`);
      console.log(`   Tiene mapa aceleración teórica: ${lastEarthquake.theoretical_acceleration_map_url ? '✓' : '✗'}`);
      console.log(`   Tiene mapa intensidades: ${lastEarthquake.intensity_map_url ? '✓' : '✗'}`);
      console.log(`   Tiene mapa pseudo aceleración: ${lastEarthquake.pseudo_acceleration_map_url ? '✓' : '✗'}`);
      console.log(`   Tiene mapa aceleración máxima: ${lastEarthquake.max_acceleration_map_url ? '✓' : '✗'}`);
      console.log(`   Tiene mapa velocidad máxima: ${lastEarthquake.max_velocity_map_url ? '✓' : '✗'}`);
      console.log(`   Tiene reporte acelerométrico: ${lastEarthquake.accelerometric_report_pdf ? '✓' : '✗'}\n`);
    } else {
      console.log('   No hay sismos registrados\n');
    }

    // Sismos sin datos completos
    console.log('📋 Sismos sin datos completos (primeros 5):');
    const incomplete = await getEarthquakesWithoutExtraData(5);
    
    if (incomplete.length > 0) {
      incomplete.forEach((eq, i) => {
        console.log(`\n   ${i + 1}. ${eq.codes || eq.code || 'sin código'}`);
        console.log(`      Fecha: ${eq.datetime_utc}`);
        console.log(`      Magnitud: ${eq.magnitude}`);
        console.log(`      Faltan:`);
        if (!eq.seismic_map_url) console.log(`         - Mapa sísmico`);
        if (!eq.theoretical_acceleration_map_url) console.log(`         - Mapa aceleración teórica`);
        if (!eq.intensity_map_url) console.log(`         - Mapa intensidades`);
        if (!eq.pseudo_acceleration_map_url) console.log(`         - Mapa pseudo aceleración`);
        if (!eq.max_acceleration_map_url) console.log(`         - Mapa aceleración máxima`);
        if (!eq.max_velocity_map_url) console.log(`         - Mapa velocidad máxima`);
        if (!eq.accelerometric_report_pdf) console.log(`         - Reporte acelerométrico`);
      });
    } else {
      console.log('   ✓ Todos los sismos tienen datos completos');
    }

    console.log('\n\n=== Diagnóstico completado ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
