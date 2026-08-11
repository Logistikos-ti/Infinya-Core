import { createClient } from '@supabase/supabase-js';

const prodDb = {
  name: "Production (brevhcwdhqyjqseduwpb)",
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

async function main() {
  const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

  const { data: order, error } = await supabase
    .from('pedidos_expedicao')
    .select('*, depositantes(*)')
    .eq('numero_wms', 976);

  console.log("Order with numero_wms = 976:", order, error);

  // Let's also check all orders currently linked to ROM-20260806-8555 and print their numero_wms
  const { data: romaneioOrders } = await supabase
    .from('romaneios_carga_pedidos')
    .select('*, pedidos_expedicao(*, depositantes(*))')
    .eq('romaneio_id', '550bb1fb-29ab-454d-8de8-79dc75bc9a5e');

  console.log("\nOrders in ROM-20260806-8555 with numero_wms:");
  for (const item of romaneioOrders) {
    const p = item.pedidos_expedicao;
    console.log(`- Pedido ID: ${p.id} | Codigo: ${p.codigo} | numero_wms: ${p.numero_wms} | Cliente: ${p.cliente_nome} | Numero: ${p.numero_pedido} | Depositante: ${p.depositantes?.nome}`);
  }
}

main().catch(console.error);
