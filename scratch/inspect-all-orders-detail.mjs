import { createClient } from '@supabase/supabase-js';

const prodDb = {
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

async function run() {
  const { data: orders } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, numero_pedido, depositante_id, status, payload_origem, created_at');

  console.log("Total orders:", orders.length);

  const { data: deps } = await supabase.from('depositantes').select('id, nome');
  const depMap = new Map(deps.map(d => [d.id, d.nome]));

  for (const o of orders) {
    const isCancelado = o.status === 'CANCELADO';
    const isDiv = o.status === 'DIVERGENCIA' || o.status === 'DIVERGENTE' || o.status === 'ERRO';
    const hasDivInPayload = Boolean(
      o.payload_origem?.motivoDivergencia || 
      o.payload_origem?.divergenceReason || 
      o.payload_origem?.divergenceReporter || 
      o.payload_origem?.divergencia ||
      o.payload_origem?.divergenciaMotivo ||
      o.payload_origem?.cancellationReason ||
      o.payload_origem?.cancellationReporter
    );

    if (isCancelado || isDiv || hasDivInPayload) {
      console.log(`- Depositante: ${depMap.get(o.depositante_id)} | Codigo: ${o.codigo} | Num: ${o.numero_pedido} | Status: ${o.status} | hasDivPayload: ${hasDivInPayload} | Payload keys:`, Object.keys(o.payload_origem || {}));
    }
  }
}

run();
