import { createClient } from '@supabase/supabase-js';

const prodDb = {
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

async function run() {
  const { data: depositantes } = await supabase.from('depositantes').select('id, nome');
  console.log("Depositantes:", depositantes);

  const js = depositantes.find(d => d.nome.toLowerCase().includes('john'));
  console.log("John Skull Depositante:", js);

  if (!js) return;

  const { data: orders, error } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, numero_pedido, status, observacoes, payload_origem')
    .eq('depositante_id', js.id);

  if (error) console.error("Query error:", error);

  console.log(`Total orders for John Skull: ${orders?.length}`);

  // Count by status
  const byStatus = {};
  orders?.forEach(o => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });
  console.log("Orders by status:", byStatus);

  const withDivergence = orders?.filter(o => 
    o.status === "DIVERGENCIA" || 
    o.status === "DIVERGENTE" || 
    o.payload_origem?.divergenceReporter || 
    o.payload_origem?.motivoDivergencia ||
    o.payload_origem?.divergencia
  );
  console.log(`Orders specifically with divergence flag/status (${withDivergence?.length}):`);
  withDivergence?.forEach(o => {
    console.log(`- ID: ${o.id}, Codigo: ${o.codigo}, Num: ${o.numero_pedido}, Status: ${o.status}, Divergence:`, o.payload_origem?.motivoDivergencia || o.payload_origem?.divergenceReason || o.payload_origem?.divergencia, "Tratamento:", o.payload_origem?.tratamentoDivergencia);
  });

  const cancelled = orders?.filter(o => o.status === "CANCELADO");
  console.log(`Total CANCELADO: ${cancelled?.length}`);
}

run();
