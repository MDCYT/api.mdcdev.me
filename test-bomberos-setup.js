/**
 * Script de prueba para verificar la conexión a la base de datos
 * y las funcionalidades básicas del sistema de Bomberos
 */

if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const { pool, getLastUpdateStatus } = require('./src/utils/bomberos-db');
const { fetchProxiesFromAPI } = require('./src/utils/proxy-manager');

async function testDatabase() {
  console.log('🔍 Probando conexión a la base de datos...\n');
  
  try {
    // Test conexión
    const connection = await pool.getConnection();
    console.log('✅ Conexión exitosa a MariaDB');
    connection.release();
    
    // Test estado
    const status = await getLastUpdateStatus();
    console.log('\n📊 Estado de la base de datos:');
    console.log(`   - Última actualización: ${status.last_update || 'N/A'}`);
    console.log(`   - Total de registros: ${status.total_records}`);
    
    console.log('\n✅ Todas las pruebas de BD pasaron correctamente\n');
  } catch (error) {
    console.error('❌ Error en pruebas de BD:', error.message);
    process.exit(1);
  }
}

async function testProxies() {
  console.log('🌐 Probando sistema de proxies...\n');
  
  try {
    const proxies = await fetchProxiesFromAPI();
    console.log(`✅ Se obtuvieron ${proxies.length} proxies`);
    
    if (proxies.length > 0) {
      console.log(`\n📝 Ejemplos (primeros 5):`);
      proxies.slice(0, 5).forEach((proxy, i) => {
        console.log(`   ${i + 1}. ${proxy}`);
      });
    }
    
    console.log('\n✅ Todas las pruebas de proxies pasaron correctamente\n');
  } catch (error) {
    console.error('❌ Error en pruebas de proxies:', error.message);
    console.log('⚠️  El sistema puede funcionar sin proxies (pero con menos confiabilidad)\n');
  }
}

async function main() {
  console.log('🚀 Iniciando pruebas del sistema de Bomberos...\n');
  console.log('=' .repeat(60));
  console.log('\n');
  
  await testDatabase();
  await testProxies();
  
  console.log('=' .repeat(60));
  console.log('\n🎉 Todas las pruebas completadas!\n');
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
