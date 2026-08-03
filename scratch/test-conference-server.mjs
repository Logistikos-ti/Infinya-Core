import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function test() {
  const orderId = 'd47ea1cb-a459-470c-8af7-4f625c62fe58';

  console.log("1. Fetching order for conference...");
  const { data: order, error: orderError } = await supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, created_at, status, numero_pedido, numero_loja, cliente_nome, cliente_cidade, cliente_uf, quantidade_itens, quantidade_unidades, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, produto_id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada, payload_origem, produto:produtos(codigo_externo, imagem_principal_url))",
    )
    .eq("id", orderId)
    .maybeSingle();

  console.log("Order error:", orderError);
  console.log("Order:", order ? "FOUND" : "NOT FOUND");

  console.log("\n2. Fetching kit rules...");
  const { data: kitRules, error: kitError } = await supabase
    .from("produto_kit_comercial_regras")
    .select(
      "id, depositante_id, produto_base_id, texto_gatilho, quantidade_operacional, ativo, produto:produtos!produto_kit_comercial_regras_produto_base_id_fkey(id, nome, sku, codigo_interno, codigo_externo, imagem_principal_url)",
    )
    .eq("ativo", true);

  console.log("Kit rules error:", kitError);

  console.log("\n3. Fetching operators...");
  const { data: operators, error: opError } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, ativo")
    .eq("ativo", true);

  console.log("Operators error:", opError);
}

test().catch(console.error);
