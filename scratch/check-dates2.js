const { createClient } = require('@supabase/supabase-js');

async function checkDates() {
  require('dotenv').config({ path: '.env.local' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('estoque')
    .select('id, produto_id, lote, validade_em')
    .in('validade_em', ['2024-10-25', '2026-04-30', '2026-06-15']);

  if (error) {
    console.error('Error fetching estoque:', error);
  } else {
    console.log('Estoque items found:', data);
  }
}

checkDates();
