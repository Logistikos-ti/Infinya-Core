const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_KEY';

async function checkDates() {
  require('dotenv').config({ path: '.env.local' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('estoque_lotes')
    .select('*')
    .in('data_validade', ['2024-10-25', '2026-04-30', '2026-06-15']);

  if (error) {
    console.error('Error fetching lotes:', error);
  } else {
    console.log('Lotes found:', data);
  }
}

checkDates();
