import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDep() {
  const { data: deps } = await supabase.from('depositantes').select('id, nome').in('id', ['8731c632-d2d6-4c9a-9f82-61e5db9ca341', 'bfd8e3c7-b2d7-41ef-989b-1037ee8838c5']);
  console.log('Deps:', deps);
}

checkDep();
