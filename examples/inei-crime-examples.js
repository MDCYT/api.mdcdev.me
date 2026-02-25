/**
 * Ejemplos de uso de la API INEI - Puntos de Delitos
 * 
 * Este archivo muestra ejemplos de cómo consultar la API de delitos del INEI
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000/v2/peru/inei/crime';

async function ejemplo1_obtenerEstadisticas() {
  console.log('\n=== Ejemplo 1: Obtener estadísticas generales ===\n');
  
  const response = await fetch(`${API_BASE}/stats`);
  const data = await response.json();
  
  console.log('Estadísticas:');
  console.log(`- Total de delitos registrados: ${data.data.total_points}`);
  console.log(`- Tipos de delitos: ${data.data.total_crime_types}`);
  console.log(`- Departamentos: ${data.data.total_departments}`);
  console.log(`- Ubicaciones únicas: ${data.data.total_locations}`);
  
  if (data.data.top_crime_types) {
    console.log('\nTop 3 tipos de delitos:');
    data.data.top_crime_types.slice(0, 3).forEach((crime, i) => {
      console.log(`  ${i + 1}. ${crime.crime_type}: ${crime.count} casos`);
    });
  }
}

async function ejemplo2_obtenerDelitosPorDepartamento() {
  console.log('\n=== Ejemplo 2: Obtener delitos en Lima ===\n');
  
  const response = await fetch(`${API_BASE}?dept_code=15&limit=5`);
  const data = await response.json();
  
  console.log(`Total de delitos en Lima: ${data.pagination.total}`);
  console.log(`\nPrimeros ${data.data.length} delitos:`);
  
  data.data.forEach((crime, i) => {
    console.log(`\n${i + 1}. ${crime.crime_type}`);
    console.log(`   Ubicación: ${crime.dist_name}, ${crime.prov_name}`);
    console.log(`   Coordenadas: ${crime.latitude}, ${crime.longitude}`);
    console.log(`   Núcleo urbano: ${crime.urban_nucleus || 'N/A'}`);
  });
}

async function ejemplo3_filtrarPorTipoDelito() {
  console.log('\n=== Ejemplo 3: Filtrar por tipo de delito (ROBO) ===\n');
  
  const response = await fetch(`${API_BASE}?crime_type=ROBO&dept_code=15&limit=5`);
  const data = await response.json();
  
  console.log(`Total de robos en Lima: ${data.pagination.total}`);
  console.log(`\nPrimeros ${data.data.length} casos:`);
  
  data.data.forEach((crime, i) => {
    console.log(`${i + 1}. ${crime.crime_type} - ${crime.dist_name}`);
  });
}

async function ejemplo4_obtenerTiposDelitos() {
  console.log('\n=== Ejemplo 4: Obtener todos los tipos de delitos ===\n');
  
  const response = await fetch(`${API_BASE}/types`);
  const data = await response.json();
  
  console.log(`Total de tipos de delitos: ${data.total}\n`);
  
  console.log('Tipos de delitos disponibles:');
  data.data.slice(0, 10).forEach((type, i) => {
    console.log(`  ${i + 1}. ${type.crime_type}: ${type.count} casos`);
  });
}

async function ejemplo5_obtenerPorUbicacionEspecifica() {
  console.log('\n=== Ejemplo 5: Obtener delitos por ubicación específica ===\n');
  
  const response = await fetch(`${API_BASE}/by-location?dept_code=15&limit=5`);
  const data = await response.json();
  
  console.log(`Departamento: ${data.location.dept_code}`);
  console.log(`Total de delitos: ${data.total}`);
  console.log(`\nDelitos encontrados: ${data.data.length}`);
  
  data.data.forEach((crime, i) => {
    console.log(`\n${i + 1}. ${crime.crime_type}`);
    console.log(`   Distrito: ${crime.dist_name}`);
    console.log(`   Provincia: ${crime.prov_name}`);
    console.log(`   UBIGEO: ${crime.ubigeo_code}`);
  });
}

async function ejemplo6_obtenerDatosHeatmap() {
  console.log('\n=== Ejemplo 6: Obtener datos para mapa de calor ===\n');
  
  const response = await fetch(`${API_BASE}/heatmap?dept_code=15&crime_type=ROBO`);
  const data = await response.json();
  
  console.log(`Total de puntos para el heatmap: ${data.total}`);
  console.log(`\nPrimeros 5 puntos:`);
  
  data.data.slice(0, 5).forEach((point, i) => {
    console.log(`${i + 1}. [${point.lat}, ${point.lon}] - ${point.type}`);
  });
  
  console.log('\nEjemplo de integración con Leaflet.js:');
  console.log(`
var heat = L.heatLayer(
  data.data.map(p => [p.lat, p.lon, p.intensity]),
  { radius: 25 }
).addTo(map);
  `);
}

async function ejemplo7_paginacion() {
  console.log('\n=== Ejemplo 7: Uso de paginación ===\n');
  
  // Primera página
  const page1 = await fetch(`${API_BASE}?dept_code=15&limit=10&offset=0`);
  const data1 = await page1.json();
  
  console.log(`Total de registros: ${data1.pagination.total}`);
  console.log(`Página 1 (${data1.pagination.returned} registros):`);
  data1.data.slice(0, 3).forEach((crime, i) => {
    console.log(`  ${i + 1}. ${crime.crime_type} - ${crime.dist_name}`);
  });
  
  // Segunda página
  const page2 = await fetch(`${API_BASE}?dept_code=15&limit=10&offset=10`);
  const data2 = await page2.json();
  
  console.log(`\nPágina 2 (${data2.pagination.returned} registros):`);
  data2.data.slice(0, 3).forEach((crime, i) => {
    console.log(`  ${i + 11}. ${crime.crime_type} - ${crime.dist_name}`);
  });
}

async function ejemplo8_filtrarPorAreaGeografica() {
  console.log('\n=== Ejemplo 8: Filtrar por área geográfica (bounding box) ===\n');
  
  // Área aproximada del centro de Lima
  const minLat = -12.1;
  const maxLat = -12.0;
  const minLon = -77.1;
  const maxLon = -77.0;
  
  const response = await fetch(
    `${API_BASE}?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}&limit=5`
  );
  const data = await response.json();
  
  console.log(`Área buscada:`);
  console.log(`  Latitud: ${minLat} a ${maxLat}`);
  console.log(`  Longitud: ${minLon} a ${maxLon}`);
  console.log(`\nDelitos encontrados en el área: ${data.pagination.total}`);
  
  if (data.data.length > 0) {
    console.log(`\nPrimeros ${data.data.length} delitos:`);
    data.data.forEach((crime, i) => {
      console.log(`${i + 1}. ${crime.crime_type} en [${crime.latitude}, ${crime.longitude}]`);
    });
  }
}

// Ejecutar todos los ejemplos
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Ejemplos de uso - API INEI Puntos de Delitos             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    await ejemplo1_obtenerEstadisticas();
    await ejemplo2_obtenerDelitosPorDepartamento();
    await ejemplo3_filtrarPorTipoDelito();
    await ejemplo4_obtenerTiposDelitos();
    await ejemplo5_obtenerPorUbicacionEspecifica();
    await ejemplo6_obtenerDatosHeatmap();
    await ejemplo7_paginacion();
    await ejemplo8_filtrarPorAreaGeografica();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  Todos los ejemplos completados exitosamente               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ Error ejecutando ejemplos:', error.message);
    console.error('\nAsegúrate de que:');
    console.error('1. La API esté ejecutándose (npm start)');
    console.error('2. La base de datos tenga datos (node update-crime-data.js)');
    console.error('3. El puerto sea el correcto (default: 3000)');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = {
  ejemplo1_obtenerEstadisticas,
  ejemplo2_obtenerDelitosPorDepartamento,
  ejemplo3_filtrarPorTipoDelito,
  ejemplo4_obtenerTiposDelitos,
  ejemplo5_obtenerPorUbicacionEspecifica,
  ejemplo6_obtenerDatosHeatmap,
  ejemplo7_paginacion,
  ejemplo8_filtrarPorAreaGeografica,
};
