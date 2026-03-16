// Script para extraer todos los trabajos de jobs_webhooks sin filtros de fecha
// y mostrarlos por consola para depuración


require('dotenv').config();
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Faltan variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY');
    process.exit(1);
  }
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/jobs_webhooks?select=job_id,company_id,driver_id,driven_distance_km,status,created_at`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const jobs = await res.json();
  console.log('Total trabajos encontrados:', jobs.length);
  for (const job of jobs) {
    console.log(job);
  }
}

main().catch(err => {
  console.error('Error al obtener trabajos:', err);
  process.exit(1);
});
