import { createClient } from '@supabase/supabase-js';

const prodDb = {
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

async function run() {
  const { data: order, error: fetchErr } = await supabase
    .from('pedidos_expedicao')
    .select('*')
    .eq('id', '5d2f6309-0344-4984-b3b7-393178e8f991')
    .single();

  if (fetchErr) {
    console.error("Fetch error:", fetchErr);
    return;
  }

  const payload = order.payload_origem || {};
  // Remove separation cancellation and divergence if order was expedited successfully
  delete payload.divergencia;
  if (payload.separacao) {
    delete payload.separacao.cancelado;
    delete payload.separacao.canceladoEm;
    delete payload.separacao.canceladoPor;
    delete payload.separacao.canceladoPorNome;
    delete payload.separacao.motivoCancelamento;
  }

  const { data: updated, error: updateErr } = await supabase
    .from('pedidos_expedicao')
    .update({
      status: 'EXPEDIDO',
      payload_origem: payload,
      updated_at: new Date().toISOString()
    })
    .eq('id', '5d2f6309-0344-4984-b3b7-393178e8f991')
    .select()
    .single();

  if (updateErr) {
    console.error("Update error:", updateErr);
    return;
  }

  console.log("Successfully updated order WMS-VEG-00681:");
  console.log("New status:", updated.status);
  console.log("Payload:", JSON.stringify(updated.payload_origem, null, 2));
}

run();
