import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function verify() {
  const { data: romaneios } = await supabase.from('romaneios_carga').select('*');
  console.log("Romaneios de Carga no banco:", romaneios?.length || 0);

  const { data: order } = await supabase.from('pedidos_expedicao').select('id, codigo, status, payload_origem').eq('id', 'd47ea1cb-a459-470c-8af7-4f625c62fe58').single();
  console.log("Pedido de Teste:", {
    id: order.id,
    codigo: order.codigo,
    status: order.status,
    transportadora: order.payload_origem?.transportadora,
    marketplace: order.payload_origem?.marketplace,
    danfe: order.payload_origem?.danfe_simplificada,
  });
}

verify().catch(console.error);
