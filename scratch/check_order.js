import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrder() {
  const { data: orders } = await supabase
    .from('pedidos_expedicao')
    .select('id, numero_wms, status, created_at, itens:pedidos_expedicao_itens(id, nome, codigo_produto, produto_id)')
    .in('status', ['NOVO', 'EM_SEPARACAO'])
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Orders:', JSON.stringify(orders, null, 2));
}

checkOrder();
