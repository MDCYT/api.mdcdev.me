const fs = require('fs');
const file = 'src/routes/v2/peruserver/trucky/live-jobs/index.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '${SUPABASE_URL.replace(/\\/+$/, \'\')}/rest/v1/trucky_companies',
  '${supabaseUrl}/rest/v1/trucky_companies'
);

content = content.replace(
  '${SUPABASE_URL.replace(/\\/+$/, \'\')}/rest/v1/jobs_webhooks',
  '${supabaseUrl}/rest/v1/jobs_webhooks'
);

content = content.replace(
  'apikey: getSupabaseKey(),\r\n          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,',
  'apikey: supabaseKey,\r\n          Authorization: `Bearer ${supabaseKey}`,',
);

content = content.replace(
  'apikey: getSupabaseKey(),\n          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,',
  'apikey: supabaseKey,\n          Authorization: `Bearer ${supabaseKey}`,',
);

content = content.replace(
  'apikey: getSupabaseKey(),\r\n          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,',
  'apikey: supabaseKey,\r\n          Authorization: `Bearer ${supabaseKey}`,',
);

content = content.replace(
  'apikey: getSupabaseKey(),\n          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,',
  'apikey: supabaseKey,\n          Authorization: `Bearer ${supabaseKey}`,',
);

fs.writeFileSync(file, content, 'utf8');
console.log('Done');

