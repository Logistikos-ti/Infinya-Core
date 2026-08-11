import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function test() {
  // Let's test with CANCELADO or check if we can insert
  const { data: testInsert, error } = await supabase.from('pedidos_expedicao').insert({
    codigo: 'PED-DIV-TEST-99',
    referencia_externa: 'PED-DIV-TEST-99',
    depositante_id: 'e89ee528-4a50-45bc-ab84-971e86582191',
    status: 'CANCELADO',
    cliente_nome: 'Teste Divergência',
  }).select('id, status').single();

  console.log("Insert result with CANCELADO:", testInsert, "error:", error?.message);
  if (testInsert?.id) {
    await supabase.from('pedidos_expedicao').delete().eq('id', testInsert.id);
  }
}

test();
