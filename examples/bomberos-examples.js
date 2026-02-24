#!/usr/bin/env node
/**
 * Script de ejemplo para consumir la API de Bomberos
 * Ejecutar: node examples/bomberos-examples.js
 */

if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';

async function ejemplo1_UltimasHoras() {
  console.log('\n📋 Ejemplo 1: Obtener incidentes de las últimas 24 horas\n');
  
  try {
    const response = await fetch(`${BASE_URL}/v2/peru/bomberos/incidentes`);
    const data = await response.json();
    
    console.log(`✅ Total de incidentes: ${data.count}`);
    console.log(`📅 Rango: ${data.range}`);
    console.log(`🕐 Última actualización BD: ${data.lastUpdate.timestamp}`);
    
    if (data.data.length > 0) {
      console.log('\n📝 Primeros 3 incidentes:');
      data.data.slice(0, 3).forEach((inc, i) => {
        console.log(`\n   ${i + 1}. ${inc.type}`);
        console.log(`      📍 ${inc.district}`);
        console.log(`      🕐 ${inc.occurred_at}`);
        if (inc.latitude && inc.longitude) {
          console.log(`      🗺️  (${inc.latitude}, ${inc.longitude})`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function ejemplo2_UltimosSieteDias() {
  console.log('\n\n📋 Ejemplo 2: Obtener incidentes de los últimos 7 días\n');
  
  try {
    const response = await fetch(`${BASE_URL}/v2/peru/bomberos/incidentes?rango=dias&cantidad=7`);
    const data = await response.json();
    
    console.log(`✅ Total de incidentes en 7 días: ${data.count}`);
    console.log(`📅 Rango: ${data.range}`);
    
    // Agrupar por tipo
    const tipos = {};
    data.data.forEach(inc => {
      tipos[inc.type] = (tipos[inc.type] || 0) + 1;
    });
    
    console.log('\n📊 Incidentes por tipo:');
    Object.entries(tipos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([tipo, count]) => {
        console.log(`   - ${tipo}: ${count}`);
      });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function ejemplo3_PorDistrito() {
  console.log('\n\n📋 Ejemplo 3: Obtener incidentes por distrito (Lima)\n');
  
  try {
    const response = await fetch(`${BASE_URL}/v2/peru/bomberos/incidentes/distrito/Lima`);
    const data = await response.json();
    
    console.log(`✅ Total de incidentes en Lima: ${data.count}`);
    console.log(`📍 Distrito: ${data.distrito}`);
    
    if (data.data.length > 0) {
      console.log('\n📝 Últimos 3 incidentes en Lima:');
      data.data.slice(0, 3).forEach((inc, i) => {
        console.log(`\n   ${i + 1}. ${inc.type}`);
        console.log(`      📌 ${inc.location.substring(0, 60)}...`);
        console.log(`      🕐 ${inc.occurred_at}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function ejemplo4_EstadoSistema() {
  console.log('\n\n📋 Ejemplo 4: Obtener estado del sistema\n');
  
  try {
    const response = await fetch(`${BASE_URL}/v2/peru/bomberos/incidentes/status`);
    const data = await response.json();
    
    console.log('🔄 Estado de Actualizaciones:');
    console.log(`   - En progreso: ${data.updateStatus.isUpdating ? 'Sí' : 'No'}`);
    console.log(`   - Última actualización: ${data.updateStatus.lastUpdateTime || 'N/A'}`);
    console.log(`   - Última exitosa: ${data.updateStatus.lastSuccessfulUpdate || 'N/A'}`);
    console.log(`   - Próxima actualización: ${data.updateStatus.nextUpdateIn}`);
    
    console.log('\n🌐 Estado de Proxies:');
    console.log(`   - Total proxies cargados: ${data.proxyStatus.totalProxies}`);
    console.log(`   - Última actualización: ${data.proxyStatus.lastUpdate || 'N/A'}`);
    
    console.log('\n💾 Estado de Base de Datos:');
    console.log(`   - Total registros: ${data.database.totalRecords}`);
    console.log(`   - Última actualización: ${data.database.lastUpdate || 'Sin datos'}`);
    
    console.log('\n⚙️  Configuración:');
    console.log(`   - Rango por defecto: ${data.configuration.defaultRangeHours} horas`);
    console.log(`   - Máximo rango: ${data.configuration.maxRangeDays} días`);
    console.log(`   - Intervalo de actualización: ${data.configuration.updateIntervalMinutes} min`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function ejemplo5_AnalisisEstadistico() {
  console.log('\n\n📋 Ejemplo 5: Análisis estadístico del último mes\n');
  
  try {
    const response = await fetch(`${BASE_URL}/v2/peru/bomberos/incidentes?rango=dias&cantidad=30`);
    const data = await response.json();
    
    console.log(`✅ Total de incidentes en 30 días: ${data.count}`);
    
    // Agrupar por distrito
    const distritos = {};
    data.data.forEach(inc => {
      distritos[inc.district] = (distritos[inc.district] || 0) + 1;
    });
    
    console.log('\n📊 Top 10 distritos con más incidentes:');
    Object.entries(distritos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([distrito, count], i) => {
        console.log(`   ${i + 1}. ${distrito}: ${count} incidentes`);
      });
    
    // Incidentes con coordenadas
    const conCoordenadas = data.data.filter(inc => inc.latitude && inc.longitude).length;
    const porcentaje = ((conCoordenadas / data.count) * 100).toFixed(1);
    
    console.log(`\n🗺️  Incidentes con coordenadas: ${conCoordenadas} (${porcentaje}%)`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  console.log('🔥 Ejemplos de uso de la API de Bomberos del Perú');
  console.log('=' .repeat(60));
  
  await ejemplo1_UltimasHoras();
  await ejemplo2_UltimosSieteDias();
  await ejemplo3_PorDistrito();
  await ejemplo4_EstadoSistema();
  await ejemplo5_AnalisisEstadistico();
  
  console.log('\n\n' + '=' .repeat(60));
  console.log('✅ Todos los ejemplos completados\n');
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  console.log('\n⚠️  Asegúrate de que el servidor esté corriendo en', BASE_URL);
  console.log('   Ejecuta: npm start\n');
  
  // Esperar 2 segundos antes de empezar
  setTimeout(() => {
    main().catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
  }, 2000);
}

module.exports = { 
  ejemplo1_UltimasHoras,
  ejemplo2_UltimosSieteDias,
  ejemplo3_PorDistrito,
  ejemplo4_EstadoSistema,
  ejemplo5_AnalisisEstadistico
};
