import { createClient } from '@supabase/supabase-js';

const prodDb = {
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

async function run() {
  const { data: depositantes } = await supabase.from('depositantes').select('id, nome');
  const { data: allOrders } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, depositante_id, status, observacoes, payload_origem');

  console.log(`Total orders in DB: ${allOrders?.length}`);

  for (const dep of depositantes) {
    const depOrders = allOrders?.filter(o => o.depositante_id === dep.id) || [];
    const divOrders = depOrders.filter(o =>
      ["DIVERGENCIA", "DIVERGENTE", "ERRO", "CANCELADO"].includes(o.status) &&
      (o.status !== "CANCELADO" || Boolean(o.payload_origem?.divergenceReporter || o.payload_origem?.motivoDivergencia || o.payload_origem?.cancellationReason || o.payload_origem?.divergencia))
    );
    console.log(`\nDepositante: ${dep.nome} (${dep.id})`);
    console.log(`  Total: ${depOrders.length}`);
    console.log(`  Divergences for portal: ${divOrders.length}`);
    for (const d of divOrders) {
      console.log(`    - Codigo: ${d.codigo}, Status: ${d.status}`);
    }
  }
}

run();
