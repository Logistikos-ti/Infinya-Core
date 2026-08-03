import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function testDetail() {
  const orderId = 'd47ea1cb-a459-470c-8af7-4f625c62fe58';

  const { data: order, error } = await supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, created_at, status, status_origem, numero_pedido, numero_loja, cliente_nome, cliente_documento, cliente_cidade, cliente_uf, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, observacoes, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, payload_origem, produto:produtos(codigo_externo, imagem_principal_url))",
    )
    .eq("id", orderId)
    .maybeSingle();

  console.log("Error fetching detail:", error);
  console.log("Detail found:", order ? "YES" : "NO");

  // Let's check attachments query
  const { data: attachments, error: attachError } = await supabase
    .from("documentos_operacionais")
    .select("id, tipo, nome_arquivo, storage_path, content_type, tamanho_bytes, criado_em")
    .eq("referencia_id", orderId);

  console.log("Error attachments:", attachError);
}

testDetail().catch(console.error);
