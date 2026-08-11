import { createClient } from '@supabase/supabase-js';
import { formatShippingStatusLabel } from '../src/lib/shipping.ts';

const prodDb = {
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

async function run() {
  const { data: orders } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, numero_wms, status, payload_origem')
    .eq('depositante_id', '6e246091-ec96-4e10-953d-193953a48cef');

  console.log("Total John Skull orders:", orders.length);

  for (const o of orders) {
    const label = formatShippingStatusLabel(o.status, o.payload_origem);
    if (label !== "Novo" && label !== "Expedido" && label !== "Em separação" && label !== "Aguardando conferência" && label !== "Pronto para Coleta") {
      console.log(`Order ${o.numero_wms} (${o.codigo}): Status=${o.status} -> Label="${label}"`);
    }
  }
}

run();
