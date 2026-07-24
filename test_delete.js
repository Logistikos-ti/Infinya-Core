import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDelete() {
  const { data: waves } = await supabase.from('ondas_separacao').select('id');
  if (!waves || waves.length === 0) return console.log('No waves');
  
  const waveIds = waves.map(w => w.id);
  console.log('Trying to delete waves:', waveIds);
  
  const { data: links, error: err1 } = await supabase
    .from('ondas_separacao_pedidos')
    .delete()
    .in('onda_separacao_id', waveIds)
    .select();
    
  console.log('Deleted links:', links?.length, err1);
  
  const { data: deletedWaves, error: err2 } = await supabase
    .from('ondas_separacao')
    .delete()
    .in('id', waveIds)
    .select();
    
  console.log('Deleted waves:', deletedWaves?.length, err2);
}

testDelete();
