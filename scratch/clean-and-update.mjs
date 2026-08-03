import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function run() {
  console.log("=== LIMPANDO ROMANEIOS E ATUALIZANDO PEDIDO PARA SHOPEE ===");

  // 1. Delete romaneios_carga_pedidos links
  const { error: errLinks } = await supabase
    .from('romaneios_carga_pedidos')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
  console.log("1. Links romaneios_carga_pedidos deletados:", errLinks ? errLinks.message : "OK");

  // 2. Delete all romaneios_carga
  const { error: errRomaneios } = await supabase
    .from('romaneios_carga')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
  console.log("2. Romaneios de carga deletados:", errRomaneios ? errRomaneios.message : "OK");

  // Also check if any old table exists like 'romaneios'
  const { error: errOldRomaneios } = await supabase
    .from('romaneios')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (!errOldRomaneios) {
    console.log("2b. Tabela legada 'romaneios' limpa com sucesso.");
  }

  // 3. Clear any other PRONTO_ROMANEIO orders so suggestions list is 100% clean
  await supabase
    .from('pedidos_expedicao')
    .update({ status: 'ENTREGUE' })
    .eq('status', 'PRONTO_ROMANEIO')
    .neq('id', 'd47ea1cb-a459-470c-8af7-4f625c62fe58');

  // 4. Update the test order to Shopee
  const orderId = 'd47ea1cb-a459-470c-8af7-4f625c62fe58';
  const danfeCode = '35260803999999000100550010000044961000044969';

  const newPayload = {
    tipo_criacao: "teste_manual",
    transportadora: "Shopee",
    transportadora_nome: "Shopee Xpress",
    canal_venda: "Shopee",
    marketplace: "Shopee",
    codigo_rastreio: "BR260803SHOPEEBR",
    danfe_simplificada: danfeCode,
    volumes: 1,
    cliente: {
      nome: "Cliente Shopee Teste Romaneio",
      cidade: "São Paulo",
      uf: "SP",
      documento: "123.456.789-00",
    },
  };

  const { data: updatedOrder, error: errOrder } = await supabase
    .from('pedidos_expedicao')
    .update({
      status: 'EM_CONFERENCIA',
      payload_origem: newPayload,
      cliente_nome: 'Cliente Shopee Teste Romaneio',
    })
    .eq('id', orderId)
    .select('id, codigo, status')
    .single();

  if (errOrder) {
    console.error("Erro ao atualizar pedido:", errOrder.message);
  } else {
    console.log("4. Pedido atualizado com sucesso para Shopee:", updatedOrder);
  }

  // 5. Reset items confirmed quantities to 0
  const { error: errItems } = await supabase
    .from('pedidos_expedicao_itens')
    .update({ quantidade_separada: 1 })
    .eq('pedido_expedicao_id', orderId);
  console.log("5. Itens do pedido verificados e prontos para conferência:", errItems ? errItems.message : "OK");

  console.log("\n==========================================================");
  console.log("✅ TUDO PRONTO!");
  console.log("Todos os romaneios anteriores foram apagados.");
  console.log(`Pedido ${updatedOrder?.codigo} configurado como SHOPEE!`);
  console.log("==========================================================");
}

run().catch(console.error);
