import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRules() {
  const { data: rules } = await supabase
    .from('produto_kit_comercial_regras')
    .select('*');
  
  console.log('Regras:', JSON.stringify(rules, null, 2));
}

checkRules();
