import { createClient } from '@supabase/supabase-js';

const stgUrl = 'https://etlylcdcxrwdmnqulxtu.supabase.co';
const stgKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM';

const supabase = createClient(stgUrl, stgKey, { auth: { persistSession: false } });

async function seed() {
  const { data: romaneios } = await supabase.from('romaneios_carga').select('id, transportadora_nome').limit(2);
  if (romaneios && romaneios.length > 0) {
    await supabase.from('romaneios_carga').update({
      motorista_nome: 'Marcos Vinícius Santos',
      motorista_documento: '382.491.028-19',
      veiculo_modelo: 'Renault Master 2022',
      veiculo_placa: 'BRA2E19',
    }).eq('id', romaneios[0].id);
    console.log('Driver seeded for test.');
  }
}

seed().catch(console.error);
