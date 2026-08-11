import { createClient } from '@supabase/supabase-js';

const prodDb = {
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

async function run() {
  const { data: order } = await supabase
    .from('pedidos_expedicao')
    .select('*')
    .eq('id', '5d2f6309-0344-4984-b3b7-393178e8f991')
    .single();

  console.log("Order:", order);

  const { data: romaneioItems } = await supabase
    .from('romaneio_itens')
    .select('*, romaneio:romaneios(*)')
    .eq('pedido_expedicao_id', '5d2f6309-0344-4984-b3b7-393178e8f991');

  console.log("Romaneio items:", romaneioItems);
}

run();
