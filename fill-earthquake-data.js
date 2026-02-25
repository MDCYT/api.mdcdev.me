/**
 * Script para rellenar datos faltantes de sismos
 * 
 * Este script obtiene los sismos que no tienen datos completos
 * (mapas y reportes) y los actualiza consultando la API del IGP
 */

require('dotenv').config();
const { fillMissingEarthquakeData, getEarthquakeDataStats } = require('./src/utils/igp-db');

async function main() {
  console.log('=== Rellenando datos faltantes de sismos ===\n');

  try {
    // Obtener estadísticas primero
    console.log('Obteniendo estadísticas de la base de datos...\n');
    const stats = await getEarthquakeDataStats();
    
    console.log('Estadísticas de sismos:');
    console.log(`- Total de sismos: ${stats.total_earthquakes || 0}`);
    console.log(`- Sin mapa sísmico: ${stats.missing_seismic_map || 0}`);
    console.log(`- Sin mapa de aceleración teórica: ${stats.missing_theoretical_acceleration || 0}`);
    console.log(`- Sin mapa de intensidades: ${stats.missing_intensity_map || 0}`);
    console.log(`- Sin mapa de pseudo aceleración: ${stats.missing_pseudo_acceleration || 0}`);
    console.log(`- Sin mapa de aceleración máxima: ${stats.missing_max_acceleration || 0}`);
    console.log(`- Sin mapa de velocidad máxima: ${stats.missing_max_velocity || 0}`);
    console.log(`- Sin reporte acelerométrico: ${stats.missing_accelerometric_report || 0}`);
    console.log(`- Sin código válido: ${stats.missing_code || 0}\n`);

    // Parámetros configurables
    const LIMIT = parseInt(process.env.FILL_LIMIT) || 100; // Cantidad de sismos a procesar
    const DELAY = parseInt(process.env.FILL_DELAY) || 1000; // Delay entre peticiones (ms)

    console.log(`Configuración del proceso:`);
    console.log(`- Límite de sismos: ${LIMIT}`);
    console.log(`- Delay entre peticiones: ${DELAY}ms\n`);

    const result = await fillMissingEarthquakeData(LIMIT, DELAY);

    console.log('\n=== Proceso completado ===');
    console.log(`Total procesados: ${result.total}`);
    console.log(`Actualizados exitosamente: ${result.updated}`);
    console.log(`Fallidos: ${result.failed}`);
    console.log(`Tasa de éxito: ${result.total > 0 ? ((result.updated / result.total) * 100).toFixed(2) : 0}%`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Manejo de señales para cierre limpio
process.on('SIGINT', () => {
  console.log('\n\nProceso interrumpido por el usuario');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nProceso terminado');
  process.exit(0);
});

// Ejecutar
main();
