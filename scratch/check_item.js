import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkItem() {
  const { data: item } = await supabase
    .from('pedidos_expedicao_itens')
    .select('id, produto_id, nome, sku, codigo_produto, quantidade, created_at, pedido:pedidos_expedicao(id, status)')
    .ilike('nome', '%caldo%volc%')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('Itens do pedido:', JSON.stringify(item, null, 2));
}

checkItem();
