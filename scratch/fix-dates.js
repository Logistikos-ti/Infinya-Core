const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('estoque').select('id, validade_em').lt('validade_em', '2015-01-01');
  if (error) { console.error(error); return; }
  
  let count = 0;
  for (const row of data) {
    const [yStr, mStr, dStr] = row.validade_em.split('-');
    
    const correctYear = '20' + dStr;
    const correctMonth = mStr;
    
    let correctDayStr = (parseInt(yStr) % 100).toString().padStart(2, '0');
    if (yStr === '0280') correctDayStr = '28';
    
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
