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
    const dayInt = parseInt(d, 10);
    
    // If year is between 2015 and 2023, it's definitely inverted (nobody has expiry in 2015-2023)
    if (yearInt >= 2015 && yearInt <= 2023) {
      toFix.push(row);
    } 
    // If year is 2024 or 2025... check if the day is 26, 27, 28, 29, 30.
    // If it was created recently (before the fix), it might be inverted.
    else if (yearInt >= 2024 && yearInt <= 2031) {
       // Let's just log them to see
       if (dayInt >= 24) {
          console.log(`Ambiguous or inverted: ${row.validade_em} (ID: ${row.id})`);
       }
    }
  }
  console.log(`Found ${toFix.length} definitely inverted dates (2015-2023).`);
  for (const row of toFix) {
     console.log(`Will fix: ${row.validade_em}`);
  }
}
run();
