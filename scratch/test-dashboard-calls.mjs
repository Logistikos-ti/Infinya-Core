import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function testAll() {
  console.log("1. Testando query de romaneios_carga...");
  const { data: records, error: err1 } = await supabase
    .from('romaneios_carga')
    .select(`
      id,
      codigo,
      status,
      transportadora_nome,
      criado_em,
      fechado_em,
      motorista_nome,
      pedidos:romaneios_carga_pedidos(
        pedido:pedidos_expedicao(id, codigo, cliente_nome, cliente_cidade, cliente_uf, quantidade_itens, quantidade_unidades, valor_total)
      )
    `);

  console.log("Result records:", records?.length, "Error:", err1);

  console.log("\n2. Testando query de pedidos para sugestão...");
  const { data: suggestions, error: err2 } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, status, depositante_id, payload_origem, criado_em')
    .eq('status', 'PRONTO_ROMANEIO');

  console.log("Result suggestions:", suggestions?.length, "Error:", err2);

  console.log("\n3. Testando query de conferencia...");
  const orderId = 'd47ea1cb-a459-470c-8af7-4f625c62fe58';
  const { data: confOrder, error: err3 } = await supabase
    .from('pedidos_expedicao')
    .select(`
      id,
      codigo,
      numero_pedido,
      numero_wms,
      status,
      cliente_nome,
      quantidade_itens,
      quantidade_unidades,
      depositante_id,
      payload_origem,
      itens:pedidos_expedicao_itens(
        id,
        produto_id,
        sku,
        nome,
        quantidade,
        quantidade_separada,
        produto:produtos(id, sku, nome, codigo_barras)
      )
    `)
    .eq('id', orderId)
    .single();

  console.log("Result confOrder:", confOrder?.id, "Error:", err3);
}

testAll().catch(console.error);
