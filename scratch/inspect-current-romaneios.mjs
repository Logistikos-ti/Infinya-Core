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

async function inspect(db) {
  console.log(`\n========================================`);
  console.log(`INSPECIONANDO: ${db.name}`);
  console.log(`========================================`);

  const supabase = createClient(db.url, db.key, { auth: { persistSession: false } });

  // 1. Check romaneios_carga
  const { data: romaneios, error: rErr } = await supabase
    .from('romaneios_carga')
    .select('id, codigo, status, transportadora_nome, criado_em');
  console.log(`Romaneios em romaneios_carga (${romaneios?.length ?? 0}):`, romaneios);

  // 2. Check romaneios_carga_pedidos
  const { data: links } = await supabase
    .from('romaneios_carga_pedidos')
    .select('*');
  console.log(`Links em romaneios_carga_pedidos (${links?.length ?? 0}):`, links);

  // 3. Check legacy romaneios table if any
  try {
    const { data: legacy } = await supabase.from('romaneios').select('id, codigo, status');
    console.log(`Romaneios na tabela legada 'romaneios' (${legacy?.length ?? 0}):`, legacy);
  } catch (e) {
    console.log(`Tabela legada não existe ou erro:`, e.message);
  }

  // 4. Check pedidos_expedicao by status
  const { data: orders } = await supabase
    .from('pedidos_expedicao')
    .select('id, codigo, status, payload_origem')
    .limit(10);
  console.log(`Amostra de pedidos_expedicao (${orders?.length ?? 0}):`);
  for (const o of orders || []) {
    console.log(`- ${o.codigo}: status=${o.status}, transportadora=${o.payload_origem?.transportadora || o.payload_origem?.marketplace}`);
  }

  // Count orders in suggestion statuses
  const SUGGESTION_SOURCE_STATUSES = [
    "PRONTO_ROMANEIO",
    "EM_SEPARACAO",
    "SEPARADO",
    "EM_CONFERENCIA",
    "CONFERIDO",
    "EM_EMBALAGEM",
    "EMBALADO",
    "PRONTO_ENVIO",
    "EXPEDIDO",
    "EM_TRANSITO",
  ];
  const { count: sugCount } = await supabase
    .from('pedidos_expedicao')
    .select('*', { count: 'exact', head: true })
    .in('status', SUGGESTION_SOURCE_STATUSES);
  console.log(`Total de pedidos nos status de sugestão (${SUGGESTION_SOURCE_STATUSES.join(',')}): ${sugCount}`);
}

async function main() {
  for (const db of databases) {
    await inspect(db);
  }
}

main().catch(console.error);
