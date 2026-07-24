import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugStockRows() {
  const { data: order } = await supabase
    .from('pedidos_expedicao')
    .select('*, itens:pedidos_expedicao_itens(*)')
    .eq('id', '86d2bc3a-a7cc-4fb6-b3a2-b662d94ec255')
    .single();

  const { data: rules } = await supabase
    .from('produto_kit_comercial_regras')
    .select('*')
    .eq('depositante_id', 'bfd8e3c7-b2d7-41ef-989b-1037ee8838c5');

  // Let's manually hydrate:
  const normalizeText = (text) => {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  };

  const productIds = new Set();

  order.itens.forEach(item => {
    let produto_id = item.produto_id;
    if (!produto_id) {
      const normalizedDescription = normalizeText(item.nome);
      const rule = rules.find(r => normalizedDescription.includes(normalizeText(r.texto_gatilho)));
      if (rule) {
        produto_id = rule.produto_base_id;
      }
    }
    if (produto_id) productIds.add(produto_id);
  });

  const productIdsArray = Array.from(productIds);
  console.log('Extracted Product IDs:', productIdsArray);

  if (productIdsArray.length > 0) {
    const { data: stockRows } = await supabase
      .from('estoque')
      .select('id, depositante_id, produto_id, quantidade, quantidade_reservada, bloqueado, lote, validade_em, created_at, endereco:enderecos(codigo, area, rua, modulo, nivel, posicao), produto:produtos(sku, nome, codigo_interno, codigo_externo, metodo_retirada)')
      .in('produto_id', productIdsArray);
    
    console.log('Stock Rows length:', stockRows?.length);
    console.log('First row:', JSON.stringify(stockRows?.[0], null, 2));
  }
}

debugStockRows();
