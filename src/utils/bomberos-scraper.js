const fetch = require('node-fetch');
const { load } = require('cheerio');
const { getRandomProxy, getCachedProxies } = require('./proxy-manager');

/**
 * Extrae coordenadas del formato "(-12.0828,-77.0513)"
 */
function extractCoordinates(text) {
  const coordMatch = text.match(/\((-?\d+\.\d+),(-?\d+\.\d+)\)/);
  if (coordMatch) {
    return {
      latitud: parseFloat(coordMatch[1]),
      longitud: parseFloat(coordMatch[2]),
    };
  }
  return {};
}

/**
 * Parsea fecha en formato Perú: "12/01/2026 08:30:54 p.m."
 * Retorna ISO string con zona horaria de Perú (UTC-5)
 */
function parsePeruDate(fechaStr) {
  try {
    // Formato esperado: "12/01/2026 08:30:54 p.m." o "12/01/2026 08:30:54 a.m."
    const match = fechaStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(a\.m\.|p\.m\.)/i);
    
    if (!match) {
      console.warn(`No se pudo parsear fecha: ${fechaStr}`);
      return new Date().toISOString();
    }

    const [, dia, mes, año, horas, minutos, segundos, ampm] = match;
    
    // Convertir a 24 horas
    let hours = parseInt(horas);
    if (ampm.toLowerCase().includes('p') && hours !== 12) {
      hours += 12;
    } else if (ampm.toLowerCase().includes('a') && hours === 12) {
      hours = 0;
    }

    // Crear fecha en formato ISO interpretada como hora de Perú (UTC-5)
    // DD/MM/YYYY -> YYYY-MM-DD
    const isoDateStr = `${año}-${mes}-${dia}T${String(hours).padStart(2, '0')}:${minutos}:${segundos}-05:00`;
    
    return new Date(isoDateStr).toISOString();
  } catch (error) {
    console.error(`Error al parsear fecha "${fechaStr}":`, error);
    return new Date().toISOString();
  }
}

/**
 * Extrae el distrito del final de la ubicación
 */
function extractDistrito(ubicacion) {
  const parts = ubicacion.split('-');
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return 'Lima';
}

/**
 * Parsea la tabla HTML de emergencias en tiempo real de los bomberos
 */
async function parseBomberos24HorasReal() {
  const MAX_RETRIES = parseInt(process.env.BOMBEROS_MAX_RETRIES) || 5;
  const BOMBEROS_API_URL = process.env.BOMBEROS_API_URL || 'https://sgonorte.bomberosperu.gob.pe/24horas';
  const usedProxies = new Set();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let fetchOptions = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-PE,es;q=0.9',
          'Referer': 'https://sgonorte.bomberosperu.gob.pe/',
          'Cache-Control': 'no-cache',
        },
        timeout: 30000,
      };

      let attempText = `Intento ${attempt}/${MAX_RETRIES}`;

      // Intentar con proxy si disponible
      if (attempt > 1 && getCachedProxies().length > 0) {
        let proxy = null;
        let retryProxy = 0;
        
        // Buscar un proxy no usado
        while (retryProxy < 5 && !proxy) {
          const candidate = getRandomProxy();
          if (candidate && !usedProxies.has(candidate)) {
            proxy = candidate;
            usedProxies.add(proxy);
          }
          retryProxy++;
        }

        if (proxy) {
          fetchOptions.agent = new (require('http')).Agent({ httpAgent: proxy });
          attempText += ` (proxy: ${proxy.substring(0, 40)}...)`;
        }
      } else if (attempt === 1) {
        attempText += ' - Conexión directa';
      }

      console.log(`🔥 ${attempText}`);

      const response = await fetch(BOMBEROS_API_URL, fetchOptions);

      if (!response.ok) {
        console.error(`   ❌ Error: ${response.status}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error(`Error al obtener datos: ${response.status}`);
      }

      const html = await response.text();
      const $ = load(html);

      const emergencias = [];

      // Buscar tabla y parsear filas
      console.log('📋 Parseando filas de la tabla...');
      $('table tbody tr').each((index, element) => {
        try {
          const $row = $(element);
          const cells = $row.find('td');

          if (cells.length >= 4) {
            // TD[0]: numparte (dentro de span)
            const numparte = $(cells[0]).find('span').text().trim();

            // TD[1]: hora (dentro de span) - parsear en formato Perú
            const horaRaw = $(cells[1]).find('span').text().trim();
            const horaISO = parsePeruDate(horaRaw);

            // TD[2]: ubicación con coordenadas
            let ubicacionRaw = $(cells[2]).find('p').text().trim();
            if (!ubicacionRaw) {
              ubicacionRaw = $(cells[2]).text().trim();
            }

            // TD[3]: tipo (dentro de span)
            const tipo = $(cells[3]).find('span').text().trim();

            if (numparte && ubicacionRaw && tipo) {
              const { latitud, longitud } = extractCoordinates(ubicacionRaw);
              const distrito = extractDistrito(ubicacionRaw);

              emergencias.push({
                id: numparte,
                numparte,
                tipo,
                ubicacion: ubicacionRaw,
                distrito,
                hora: horaISO || undefined,
                latitud,
                longitud,
              });

              if (index < 3) {
                console.log(`   Parseado: ${numparte} - ${tipo.substring(0, 40)}...`);
              }
            }
          }
        } catch (rowError) {
          console.error(`Error al parsear fila ${index}:`, rowError.message);
        }
      });

      console.log(`✨ Total de emergencias parseadas: ${emergencias.length}`);
      
      if (emergencias.length > 0) {
        return emergencias;
      } else if (attempt < MAX_RETRIES) {
        console.warn(`No se encontraron datos, reintentando...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      throw new Error('No se encontraron datos de emergencias después de todos los reintentos');
    } catch (error) {
      console.error(`   ❌ Error en intento ${attempt}:`, error.message);
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new Error('Error al obtener datos de bomberos después de todos los reintentos');
}

module.exports = {
  parseBomberos24HorasReal,
  extractCoordinates,
  parsePeruDate,
  extractDistrito,
};
