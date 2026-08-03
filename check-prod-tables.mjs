import { createClient } from '@supabase/supabase-js';

const prodUrl = 'https://brevhcwdhqyjqseduwpb.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk';

const supabase = createClient(prodUrl, prodKey, { auth: { persistSession: false } });

async function run() {
  console.log('Testing PROD romaneios_carga table...');
  const { data: records, error: recErr } = await supabase.from('romaneios_carga').select('*');
  console.log('PROD romaneios_carga error:', recErr);

  console.log('Testing PROD romaneios_carga_pedidos table...');
  const { data: links, error: linkErr } = await supabase.from('romaneios_carga_pedidos').select('*');
  console.log('PROD romaneios_carga_pedidos error:', linkErr);
}

run().catch(console.error);
