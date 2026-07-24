import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMatch() {
  const { data: item } = await supabase
    .from('pedidos_expedicao_itens')
    .select('id, nome, codigo_produto, payload_origem, produto_id')
    .eq('id', 'cb724e1e-7be4-4347-b871-ec3d43ed64a5')
    .single();

  const { data: rules } = await supabase
    .from('produto_kit_comercial_regras')
    .select('*')
    .eq('depositante_id', 'bfd8e3c7-b2d7-41ef-989b-1037ee8838c5');

  console.log('Item:', item);
  
  // Normalize text logic
  const normalizeText = (text) => {
    if (!text) return "";
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  };

  const normalizedDescription = normalizeText(item.nome);
  console.log('Normalized Description:', normalizedDescription);

  const matchedRule = rules.find((rule) =>
    normalizedDescription.includes(normalizeText(rule.texto_gatilho))
  );

  console.log('Matched Rule:', matchedRule);
}

testMatch();
