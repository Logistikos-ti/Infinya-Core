import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function debugOrder() {
  const orderId = 'd47ea1cb-a459-470c-8af7-4f625c62fe58';

  const { data: order, error: orderError } = await supabase
    .from('pedidos_expedicao')
    .select(`
      *,
      depositante:depositantes(id, nome),
      itens:pedidos_expedicao_itens(
        *,
        produto:produtos(*)
      )
    `)
    .eq('id', orderId)
    .single();

  console.log("Order fetch error:", orderError);
  console.log("Order found:", order?.id, order?.codigo);
  console.log("Depositante:", order?.depositante);
  console.log("Itens count:", order?.itens?.length);
  order?.itens?.forEach(i => {
    console.log("  - Item:", i.nome, "produto:", i.produto?.id, i.produto?.nome);
  });
}

debugOrder().catch(console.error);
