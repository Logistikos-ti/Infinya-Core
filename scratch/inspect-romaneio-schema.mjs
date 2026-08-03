import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function check() {
  const { data: inserted, error: insertErr } = await supabase.from('romaneios_carga').insert({
    codigo: 'ROM-TEST-0001',
    status: 'ABERTO',
    transportadora_nome: 'Shopee',
  }).select('*');

  console.log("Insert result:", inserted);
  console.log("Insert error:", insertErr);

  if (inserted && inserted.length > 0) {
    console.log("Columns of romaneios_carga:", Object.keys(inserted[0]));
    await supabase.from('romaneios_carga').delete().eq('id', inserted[0].id);
  }
}

check().catch(console.error);
