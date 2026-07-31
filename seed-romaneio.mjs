import { createClient } from '@supabase/supabase-js';

const url = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const serviceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Seeding fake data for Romaneio...');

  const { data: depList } = await supabase.from('depositantes').select('id').limit(1);
  const depositanteId = depList[0].id;
  console.log('Using depositante:', depositanteId);

  // 2. Create a Transportadora
  const { error: transError } = await supabase.from('transportadoras').insert({
    nome: 'Jadlog',
    razao_social: 'Jadlog Logistica SA',
    cnpj: '04.884.082/0001-35'
  });
  if (transError) console.log('TransError ignored:', transError.message);

  // 3. Create Orders for Romaneio
  const pedidos = [
    {
      codigo: 'PED-MOCK-01',
      referencia_externa: 'EXT-01',
      status: 'PRONTO_ROMANEIO',
      origem: 'BLING',
      depositante_id: depositanteId,
      cliente_nome: 'Marcos Oliveira',
      cliente_cidade: 'São Paulo',
      cliente_uf: 'SP',
      quantidade_unidades: 3,
      valor_total: 250.50,
      data_pedido: new Date().toISOString(),
      previsao_envio_em: new Date().toISOString(),
      payload_origem: { transporte: { contato: { nome: 'Jadlog' } } }
    },
    {
      codigo: 'PED-MOCK-02',
      referencia_externa: 'EXT-02',
      status: 'PRONTO_ROMANEIO',
      origem: 'BLING',
      depositante_id: depositanteId,
      cliente_nome: 'Juliana Costa',
      cliente_cidade: 'Campinas',
      cliente_uf: 'SP',
      quantidade_unidades: 1,
      valor_total: 89.90,
      data_pedido: new Date().toISOString(),
      previsao_envio_em: new Date().toISOString(),
      payload_origem: { transporte: { contato: { nome: 'Jadlog' } } }
    },
    {
      codigo: 'PED-MOCK-03',
      referencia_externa: 'EXT-03',
      status: 'PRONTO_ROMANEIO',
      origem: 'BLING',
      depositante_id: depositanteId,
      cliente_nome: 'Roberto Silva',
      cliente_cidade: 'Osasco',
      cliente_uf: 'SP',
      quantidade_unidades: 5,
      valor_total: 620.00,
      data_pedido: new Date().toISOString(),
      previsao_envio_em: new Date().toISOString(),
      payload_origem: { transporte: { contato: { nome: 'Jadlog' } } }
    },
    {
      codigo: 'PED-MOCK-04',
      referencia_externa: 'EXT-04',
      status: 'PRONTO_ROMANEIO',
      origem: 'BLING',
      depositante_id: depositanteId,
      cliente_nome: 'Ana Clara',
      cliente_cidade: 'Rio de Janeiro',
      cliente_uf: 'RJ',
      quantidade_unidades: 2,
      valor_total: 120.00,
      data_pedido: new Date().toISOString(),
      previsao_envio_em: new Date().toISOString(),
      payload_origem: { transporte: { contato: { nome: 'Correios' } } }
    }
  ];

  const { error: pedError } = await supabase.from('pedidos_expedicao').insert(pedidos);
  if (pedError) {
    console.error('Error inserting pedidos:', pedError);
  } else {
    console.log('Inserted fake orders successfully!');
  }
}

run().catch(console.error);
