import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function run() {
  console.log('Testing romaneios_carga table...');
  const { data: records, error: recErr } = await supabase.from('romaneios_carga').select('*');
  console.log('romaneios_carga error:', recErr);
  console.log('romaneios_carga count:', records?.length);

  console.log('Testing romaneios_carga_pedidos table...');
  const { data: links, error: linkErr } = await supabase.from('romaneios_carga_pedidos').select('*');
  console.log('romaneios_carga_pedidos error:', linkErr);
  console.log('romaneios_carga_pedidos count:', links?.length);

  console.log('Testing pedidos_expedicao suggestions query...');
  const { data: orders, error: pedErr } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, numero_wms, status, numero_pedido, numero_loja, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, cliente_nome, cliente_cidade, cliente_uf, payload_origem, depositante_id, depositante:depositantes(nome)')
    .in('status', ['PRONTO_ROMANEIO']);
  console.log('pedidos_expedicao error:', pedErr);
  console.log('pedidos_expedicao count:', orders?.length);

  console.log('Testing transportadoras query...');
  const { data: trans, error: transErr } = await supabase.from('transportadoras').select('id, nome, cnpj').eq('ativo', true);
  console.log('transportadoras error:', transErr);
  console.log('transportadoras count:', trans?.length);
}

run().catch(console.error);
