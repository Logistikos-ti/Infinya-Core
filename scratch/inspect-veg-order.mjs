import { createClient } from '@supabase/supabase-js';

const prodDb = {
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

async function run() {
  const { data: orders } = await supabase
    .from('pedidos_expedicao')
    .select('*, depositante:depositantes(nome)')
    .or('numero_wms.ilike.%00681%,codigo.ilike.%00681%,numero_pedido.ilike.%00681%');

  console.log("Found orders:", orders?.length);
  for (const o of orders || []) {
    console.log(`\nOrder ID: ${o.id}`);
    console.log(`Codigo: ${o.codigo}`);
    console.log(`Numero WMS: ${o.numero_wms}`);
    console.log(`Numero Pedido: ${o.numero_pedido}`);
    console.log(`Depositante: ${o.depositante?.nome} (${o.depositante_id})`);
    console.log(`Status: ${o.status}`);
    console.log(`Status Origem: ${o.status_origem}`);
    console.log(`Payload Origem:`, JSON.stringify(o.payload_origem, null, 2));
  }
}

run();
