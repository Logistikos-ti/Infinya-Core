import { createClient } from '@supabase/supabase-js';

const prodDb = {
  name: "Production (brevhcwdhqyjqseduwpb)",
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

function buildRomaneioCode() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = String(now.getTime()).slice(-4);
  return `ROM-${date}-${suffix}`;
}

async function transferOrder() {
  const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

  const oldRomaneioId = '550bb1fb-29ab-454d-8de8-79dc75bc9a5e'; // ROM-20260806-8555
  const orderId = 'd43df962-d631-4234-8015-54b9f19d48cc'; // WMS-GOO-00976

  console.log("1. Removing order from ROM-20260806-8555...");
  const { data: deleted, error: delErr } = await supabase
    .from('romaneios_carga_pedidos')
    .delete()
    .eq('romaneio_id', oldRomaneioId)
    .eq('pedido_expedicao_id', orderId)
    .select('*');

  console.log("Deleted link:", deleted, delErr);

  console.log("2. Re-sequencing remaining orders in ROM-20260806-8555...");
  const { data: remaining, error: remErr } = await supabase
    .from('romaneios_carga_pedidos')
    .select('*')
    .eq('romaneio_id', oldRomaneioId)
    .order('sequencia', { ascending: true });

  for (let i = 0; i < (remaining || []).length; i++) {
    await supabase
      .from('romaneios_carga_pedidos')
      .update({ sequencia: i + 1 })
      .eq('id', remaining[i].id);
  }
  console.log(`Re-sequenced ${remaining?.length ?? 0} orders.`);

  console.log("3. Creating new Lalamove romaneio...");
  const newCode = buildRomaneioCode();
  const { data: newRomaneio, error: createErr } = await supabase
    .from('romaneios_carga')
    .insert({
      codigo: newCode,
      transportadora_id: null,
      transportadora_nome: 'Lalamove',
      transportadora_cnpj: null,
      criado_por: '6897b573-d293-4698-bfc2-3779688df793',
      status: 'ABERTO',
    })
    .select('*')
    .single();

  if (createErr || !newRomaneio) {
    throw new Error(`Error creating romaneio: ${createErr?.message}`);
  }

  console.log("Created new romaneio:", newRomaneio);

  console.log("4. Linking order to new Lalamove romaneio...");
  const { data: newLink, error: linkErr } = await supabase
    .from('romaneios_carga_pedidos')
    .insert({
      romaneio_id: newRomaneio.id,
      pedido_expedicao_id: orderId,
      sequencia: 1,
    })
    .select('*')
    .single();

  console.log("New link:", newLink, linkErr);

  console.log("\n5. Updating order payload transportadora if needed...");
  const { data: orderData } = await supabase
    .from('pedidos_expedicao')
    .select('payload_origem')
    .eq('id', orderId)
    .single();

  const currentPayload = orderData?.payload_origem || {};
  const updatedPayload = {
    ...currentPayload,
    transportadora: 'Lalamove',
    transporte: {
      ...(currentPayload.transporte || {}),
      contato: {
        nome: 'Lalamove',
      },
      volumes: [
        {
          servico: 'Lalamove',
          quantidade: 1,
        }
      ]
    }
  };

  await supabase
    .from('pedidos_expedicao')
    .update({ payload_origem: updatedPayload })
    .eq('id', orderId);

  console.log("Updated order payload with Lalamove carrier info.");
  console.log("\nSUCCESS!");
  console.log(`Order WMS-GOO-00976 moved to new Romaneio: ${newRomaneio.codigo} (${newRomaneio.id})`);
}

transferOrder().catch(console.error);
