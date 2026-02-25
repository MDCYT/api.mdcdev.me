/**
 * Script para actualizar los datos de puntos de delitos desde el INEI
 * 
 * Este script descarga los puntos de delitos desde el servicio ArcGIS del INEI
 * y los almacena en la base de datos SQLite local, evitando duplicados.
 */

require('dotenv').config();
const { initializeDatabase, upsertCrimePoints, getCrimeStats } = require('./src/utils/inei-crime-db');
const { fetchCrimePoints, fetchCrimePointsByDepartment, fetchAllCrimePoints } = require('./src/utils/inei-crime-scraper');

async function main() {
  console.log('=== Actualización de datos de delitos INEI ===\n');

  try {
    // 1. Inicializar base de datos
    console.log('📦 Inicializando base de datos...');
    await initializeDatabase();
    console.log('✓ Base de datos inicializada\n');

    // 2. Mostrar estadísticas actuales
    console.log('📊 Estadísticas actuales:');
    try {
      const currentStats = await getCrimeStats();
      console.log(`   Total de puntos: ${currentStats.total_points || 0}`);
      console.log(`   Tipos de delitos: ${currentStats.total_crime_types || 0}`);
      console.log(`   Departamentos: ${currentStats.total_departments || 0}`);
      console.log(`   Último registro: ${currentStats.newest_record || 'N/A'}\n`);
    } catch (statError) {
      console.log('   (Base de datos vacía)\n');
    }

    // 3. Obtener datos desde el INEI
    console.log('🌐 Descargando datos del INEI...');
    console.log('   (Esto puede tomar varios segundos)\n');

    // Configurar departamentos a consultar
    const DEPARTMENTS = process.env.INEI_DEPARTMENTS ? process.env.INEI_DEPARTMENTS.split(',') : ['15']; // Default: Solo Lima
    
    let allPoints = [];

    if (DEPARTMENTS.length === 1 && DEPARTMENTS[0] === '*') {
      // Obtener TODOS los puntos con paginación automática (sin filtro de departamento ni bbox)
      console.log('   Consultando TODOS los departamentos con paginación...');
      allPoints = await fetchAllCrimePoints();
    } else {
      // Obtener por departamento específico
      for (const deptCode of DEPARTMENTS) {
        console.log(`   Consultando departamento ${deptCode}...`);
        try {
          const points = await fetchCrimePointsByDepartment(deptCode.trim());
          allPoints = allPoints.concat(points);
          console.log(`   ✓ ${points.length} puntos obtenidos para dept. ${deptCode}`);
          
          // Pequeño delay para no sobrecargar el servidor
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`   ✗ Error consultando dept. ${deptCode}:`, error.message);
        }
      }
    }

    console.log(`\n✓ Total descargado: ${allPoints.length} puntos\n`);

    if (allPoints.length === 0) {
      console.log('⚠️  No se obtuvieron puntos de delitos');
      console.log('   Verifica la conexión o los filtros de consulta\n');
      process.exit(0);
    }

    // 4. Guardar en base de datos
    console.log('💾 Guardando en base de datos...');
    const result = await upsertCrimePoints(allPoints);

    console.log('\n📈 Resultado de la actualización:');
    console.log(`   ✓ Insertados: ${result.inserted}`);
    console.log(`   ↻ Actualizados: ${result.updated}`);
    console.log(`   = Duplicados (ignorados): ${result.duplicated}`);
    console.log(`   ✗ Fallidos: ${result.failed}`);

    // 5. Mostrar estadísticas finales
    console.log('\n📊 Estadísticas finales:');
    const finalStats = await getCrimeStats();
    console.log(`   Total de puntos: ${finalStats.total_points || 0}`);
    console.log(`   Tipos de delitos: ${finalStats.total_crime_types || 0}`);
    console.log(`   Departamentos: ${finalStats.total_departments || 0}`);
    console.log(`   Ubicaciones únicas: ${finalStats.total_locations || 0}`);
    
    if (finalStats.top_crime_types && finalStats.top_crime_types.length > 0) {
      console.log('\n   Top tipos de delitos:');
      finalStats.top_crime_types.slice(0, 5).forEach((ct, i) => {
        console.log(`      ${i + 1}. ${ct.crime_type}: ${ct.count} casos`);
      });
    }

    console.log('\n=== Actualización completada exitosamente ===');
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
