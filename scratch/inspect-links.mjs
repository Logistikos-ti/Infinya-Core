import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function check() {
  const { data: r } = await supabase.from('romaneios_carga').insert({
    codigo: 'ROM-TEST-TMP',
    status: 'ABERTO',
    transportadora_nome: 'Shopee',
  }).select('id').single();

  const { data: p } = await supabase.from('pedidos_expedicao').select('id').limit(1).single();

  const { data: link, error: linkErr } = await supabase.from('romaneios_carga_pedidos').insert({
    romaneio_id: r.id,
    pedido_expedicao_id: p.id,
    sequencia: 1,
  }).select('*');

  console.log("Inserted link:", link);
  console.log("Error:", linkErr);
  if (link && link.length > 0) {
    console.log("Columns of romaneios_carga_pedidos:", Object.keys(link[0]));
  }

  // Cleanup
  if (r) {
    await supabase.from('romaneios_carga_pedidos').delete().eq('romaneio_id', r.id);
    await supabase.from('romaneios_carga').delete().eq('id', r.id);
  }
}

check().catch(console.error);
