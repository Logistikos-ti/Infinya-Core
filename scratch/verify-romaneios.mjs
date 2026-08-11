import { createClient } from '@supabase/supabase-js';

const prodDb = {
  name: "Production (brevhcwdhqyjqseduwpb)",
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

async function verify() {
  const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

  console.log("=== ROM-20260806-8555 ===");
  const { data: r1 } = await supabase
    .from('romaneios_carga')
    .select('*, items:romaneios_carga_pedidos(*, pedidos_expedicao(*, depositantes(nome)))')
    .eq('codigo', 'ROM-20260806-8555')
    .single();

  console.log(`Romaneio: ${r1.codigo} | Status: ${r1.status} | Transportadora: ${r1.transportadora_nome} | Total Pedidos: ${r1.items.length}`);
  for (const item of r1.items) {
    const p = item.pedidos_expedicao;
    console.log(`  [Seq ${item.sequencia}] Codigo: ${p.codigo} | numero_wms: ${p.numero_wms} | Cliente: ${p.cliente_nome} | NF: ${p.numero_pedido}`);
  }

  console.log("\n=== NOVO ROMANEIO LALAMOVE ===");
  const { data: r2 } = await supabase
    .from('romaneios_carga')
    .select('*, items:romaneios_carga_pedidos(*, pedidos_expedicao(*, depositantes(nome)))')
    .eq('codigo', 'ROM-20260806-3509')
    .single();

  console.log(`Romaneio: ${r2.codigo} | Status: ${r2.status} | Transportadora: ${r2.transportadora_nome} | Total Pedidos: ${r2.items.length}`);
  for (const item of r2.items) {
    const p = item.pedidos_expedicao;
    console.log(`  [Seq ${item.sequencia}] Codigo: ${p.codigo} | numero_wms: ${p.numero_wms} | Cliente: ${p.cliente_nome} | NF: ${p.numero_pedido} | Transportadora: ${p.payload_origem?.transportadora}`);
  }
}

verify().catch(console.error);
