import { createClient } from '@supabase/supabase-js';

const prodUrl = 'https://brevhcwdhqyjqseduwpb.supabase.co';
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const prodClient = createClient(prodUrl, prodKey, { auth: { persistSession: false } });
const stgClient = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function run() {
  console.log('Fetching suggestions from PROD...');
  const { data: orders, error: fetchErr } = await prodClient
    .from('pedidos_expedicao')
    .select('*')
    .eq('status', 'PRONTO_ROMANEIO')
    .order('data_pedido', { ascending: false })
    .limit(100);

  if (fetchErr) {
    console.error('Error fetching from prod:', fetchErr);
    return;
  }

  if (!orders || orders.length === 0) {
    console.log('No suggestions found in PROD.');
    return;
  }

  console.log(`Found ${orders.length} suggestions. Syncing depositantes first...`);

  // Get unique depositante IDs
  const depIds = [...new Set(orders.map(o => o.depositante_id).filter(Boolean))];

  if (depIds.length > 0) {
    const { data: deps } = await prodClient.from('depositantes').select('*').in('id', depIds);
    if (deps && deps.length > 0) {
      console.log(`Upserting ${deps.length} depositantes into STAGING...`);
      const { error: depErr } = await stgClient.from('depositantes').upsert(deps);
      if (depErr) console.error('Error upserting depositantes:', depErr);
    }
  }

  console.log('Upserting orders into STAGING...');
  const { error: insertErr } = await stgClient.from('pedidos_expedicao').upsert(orders);
  
  if (insertErr) {
    console.error('Error upserting orders:', insertErr);
  } else {
    console.log(`Successfully synced ${orders.length} orders!`);
  }
}

run().catch(console.error);
