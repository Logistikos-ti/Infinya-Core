import { createClient } from '@supabase/supabase-js';

const prodDb = {
  name: "Production (brevhcwdhqyjqseduwpb)",
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

async function main() {
  const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

  const { data: romaneios } = await supabase
    .from('romaneios_carga')
    .select('id, codigo, status, transportadora_nome, criado_em')
    .order('criado_em', { ascending: false });

  console.log("Todos os romaneios em produção:", romaneios);
}

main().catch(console.error);
