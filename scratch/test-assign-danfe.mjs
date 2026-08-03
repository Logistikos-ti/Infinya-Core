import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function testAssign() {
  const user = { id: '00000000-0000-0000-0000-000000000000', nome: 'Administrador Teste', email: 'admin@test.com' };
  const orderId = 'd47ea1cb-a459-470c-8af7-4f625c62fe58';
  const scannedDanfe = '35260803999999000100550010000044961000044969';

  console.log("Testing insert into romaneios_carga with criado_por = user.nome...");
  const { data: r1, error: e1 } = await supabase.from('romaneios_carga').insert({
    codigo: 'ROM-TEST-UUID',
    status: 'ABERTO',
    transportadora_nome: 'Shopee',
    criado_por: user.nome, // STRING
  }).select('*');
  console.log("Insert with user.nome:", { r1, error: e1 });

  console.log("Testing insert into romaneios_carga_pedidos with adicionado_por = user.nome...");
  const { data: r2, error: e2 } = await supabase.from('romaneios_carga_pedidos').insert({
    romaneio_id: '00000000-0000-0000-0000-000000000000',
    pedido_expedicao_id: orderId,
    sequencia: 1,
    adicionado_por: user.nome,
  }).select('*');
  console.log("Insert romaneios_carga_pedidos:", { r2, error: e2 });
}

testAssign().catch(console.error);
