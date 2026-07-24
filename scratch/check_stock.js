import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStock() {
  const { data: stock } = await supabase
    .from('estoque')
    .select('id, depositante_id, produto_id, quantidade, bloqueado, endereco_id, endereco:enderecos(codigo, area)')
    .eq('produto_id', '1391f062-3e9b-4f9d-a364-d480b7499eaf');
  
  console.log('Stock for Caldo Volcà:', JSON.stringify(stock, null, 2));

  // Also check Kit c/ 6 Refrigerante Vegano
  const { data: rules } = await supabase
    .from('produto_kit_comercial_regras')
    .select('*')
    .ilike('texto_gatilho', '%refrigerante%');
  
  console.log('Regras Refrigerante:', JSON.stringify(rules, null, 2));
}

checkStock();
