import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Find depositante Evolveg
  const { data: deps } = await supabase.from('depositantes').select('id, nome').ilike('nome', '%evolveg%').limit(1);
  if (!deps || deps.length === 0) {
    console.error("Evolveg not found");
    return;
  }
  const depositanteId = deps[0].id;
  
  // Find some products
  const { data: prods } = await supabase.from('produtos').select('codigo, nome, id').eq('depositante_id', depositanteId).limit(2);
  
  // Create order
  const { data: order, error } = await supabase.from('pedidos_expedicao').insert({
    depositante_id: depositanteId,
    status: 'NOVO',
    codigo: 'TESTE-CANCEL-001',
    referencia_externa: 'REF-CANCEL-001',
    numero_pedido: 'TC001',
    cliente_nome: 'Cliente Teste Cancelamento',
    quantidade_itens: prods ? prods.length : 1,
    quantidade_unidades: prods ? prods.length : 1,
    origem: 'MANUAL',
    canal: 'TESTE',
    valor_total: 100,
    payload_origem: {
      observacoes: "Pedido criado para teste de cancelamento."
    }
  }).select('id').single();

  if (error) {
    console.error("Error creating order", error);
    return;
  }
  
  console.log("Order created:", order.id);
  
  // Insert items if prods exist
  if (prods && prods.length > 0) {
    for (const p of prods) {
      await supabase.from('pedidos_expedicao_itens').insert({
        pedido_id: order.id,
        codigo_produto: p.codigo,
        nome: p.nome,
        quantidade: 1,
        referencia_externa: 'REF-ITEM-CANCEL-001'
      });
    }
  }
  
  console.log("Done");
}

main();
