// Test directo de la función corregida
function combineDatetimeFields(dateStr, timeStr) {
  if (!dateStr) return null;

  try {
    if (!timeStr) {
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

    // Extraer componentes directamente
    const year = dateObj.getUTCFullYear();
    const month = dateObj.getUTCMonth();
    const day = dateObj.getUTCDate();
    const hours = timeObj.getUTCHours();
    const minutes = timeObj.getUTCMinutes();
    const seconds = timeObj.getUTCSeconds();

    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    const secondsStr = String(seconds).padStart(2, '0');

    return `${year}-${monthStr}-${dayStr} ${hoursStr}:${minutesStr}:${secondsStr}`;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

console.log('=== Test con datos del API IGP ===\n');

// Caso real del API
const fecha = '2026-01-01T00:00:00.000Z';
const hora = '1970-01-01T10:20:25.000Z';

console.log(`fecha_utc: ${fecha}`);
console.log(`hora_utc:  ${hora}`);

const timeObj = new Date(hora);
console.log(`\nExtracción de hora:`);
console.log(`  getUTCHours(): ${timeObj.getUTCHours()}`);
console.log(`  getUTCMinutes(): ${timeObj.getUTCMinutes()}`);
console.log(`  getUTCSeconds(): ${timeObj.getUTCSeconds()}`);

const result = combineDatetimeFields(fecha, hora);
console.log(`\n✓ Resultado: ${result}`);
console.log(`  Esperado:  2026-01-01 10:20:25`);
console.log(`  ${result === '2026-01-01 10:20:25' ? '✅ CORRECTO' : '❌ INCORRECTO'}`);

// Caso del sismo del 26/2
console.log('\n\n=== Test con sismo del 26/2 ===\n');
const fecha26 = '2026-02-26T00:00:00.000Z';
const hora26 = '1970-01-01T06:54:13.000Z'; // 01:54:13 hora local = 06:54:13 UTC

console.log(`fecha_utc: ${fecha26}`);
console.log(`hora_utc:  ${hora26}`);

const result26 = combineDatetimeFields(fecha26, hora26);
console.log(`\n✓ Resultado: ${result26}`);
console.log(`  Esperado:  2026-02-26 06:54:13 (UTC)`);

// Calcular antigüedad
if (result26) {
  const sismoDate = new Date(result26 + 'Z');
  const now = new Date();
  const hoursAgo = (now - sismoDate) / (1000 * 60 * 60);
  console.log(`\n  ⏰ Antigüedad: ${hoursAgo.toFixed(1)} horas`);
  console.log(`  ${hoursAgo > 24 ? '✅ Será filtrado (> 24h)' : '❌ NO será filtrado (< 24h)'}`);
}
