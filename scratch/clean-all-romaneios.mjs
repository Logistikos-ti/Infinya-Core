import { createClient } from '@supabase/supabase-js';

const databases = [
  {
    name: "Production (brevhcwdhqyjqseduwpb)",
    url: "https://brevhcwdhqyjqseduwpb.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
  },
  {
    name: "Staging (etlylcdcxrwdmnqulxtu)",
    url: "https://etlylcdcxrwdmnqulxtu.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHlsY2RjeHJ3ZG1ucXVseHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQyNjU4NywiZXhwIjoyMTAxMDAyNTg3fQ.yqixP87CGS-bD8CoMBeOdYJIyLE2N2eqAdsiBcyJwTM"
  }
];

async function cleanDatabase(db) {
  console.log(`\n========================================`);
  console.log(`Limpando Romaneios em: ${db.name}`);
  console.log(`========================================`);

  const supabase = createClient(db.url, db.key, { auth: { persistSession: false } });

  // 1. Delete all links in romaneios_carga_pedidos
  try {
    const { error: errLinks, count: countLinks } = await supabase
      .from('romaneios_carga_pedidos')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log(`- romaneios_carga_pedidos excluídos: ${countLinks ?? 'OK'} (erro: ${errLinks?.message || 'nenhum'})`);
  } catch (e) {
    console.log(`- romaneios_carga_pedidos erro:`, e.message);
  }

  // 2. Delete all records in romaneios_carga
  try {
    const { error: errCarga, count: countCarga } = await supabase
      .from('romaneios_carga')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    console.log(`- romaneios_carga excluídos: ${countCarga ?? 'OK'} (erro: ${errCarga?.message || 'nenhum'})`);
  } catch (e) {
    console.log(`- romaneios_carga erro:`, e.message);
  }

  // 3. Delete any records in legacy romaneios table if present
  try {
    const { error: errLegacy, count: countLegacy } = await supabase
      .from('romaneios')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (!errLegacy) {
      console.log(`- romaneios (legado) excluídos: ${countLegacy ?? 'OK'}`);
    }
  } catch (e) {
    // Ignored if table doesn't exist
  }

  // Check remaining count
  const { data: remaining } = await supabase.from('romaneios_carga').select('id, codigo, status');
  console.log(`-> Total de romaneios restantes na base: ${remaining?.length ?? 0}`);
}

async function main() {
  for (const db of databases) {
    await cleanDatabase(db);
  }
  console.log(`\n🎉 Limpeza concluída com sucesso em todas as bases!`);
}

main().catch(console.error);
