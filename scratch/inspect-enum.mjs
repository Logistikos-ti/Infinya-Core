import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function inspectEnum() {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'status_pedido_expedicao' }).catch(() => ({ data: null }));
  
  // Or check distinct statuses in pedidos_expedicao
  const { data: statuses } = await supabase.from('pedidos_expedicao').select('status').limit(50);
  console.log("Distinct statuses present:", [...new Set(statuses?.map(s => s.status))]);
}

inspectEnum();
