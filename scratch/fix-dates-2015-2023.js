const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('estoque').select('id, validade_em, created_at').not('validade_em', 'is', null);
  if (error) { console.error(error); return; }
  
  let toFix = [];
  for(const row of data) {
    const [y, m, d] = row.validade_em.split('-');
    const yearInt = parseInt(y, 10);
    
    // If year is between 2015 and 2023, it's definitely inverted
    if (yearInt >= 2015 && yearInt <= 2023) {
      toFix.push(row);
    }
  }
  
  let count = 0;
  for (const row of toFix) {
    const [yStr, mStr, dStr] = row.validade_em.split('-');
    
    const correctYear = '20' + dStr;
    const correctMonth = mStr;
    const correctDayStr = (parseInt(yStr, 10) % 100).toString().padStart(2, '0');
    
    const correctDate = `${correctYear}-${correctMonth}-${correctDayStr}`;
    
    console.log(`Fixing ${row.validade_em} -> ${correctDate}`);
    
    const { error: updErr } = await supabase.from('estoque').update({ validade_em: correctDate }).eq('id', row.id);
    if (updErr) {
      console.error('Error updating', row.id, updErr);
    } else {
      count++;
    }
  }
  console.log(`Fixed ${count} rows.`);
}
run();
