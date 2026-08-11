import { createClient } from '@supabase/supabase-js';

const db = {
  name: "Production (brevhcwdhqyjqseduwpb)",
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

async function checkStock() {
  const supabase = createClient(db.url, db.key, { auth: { persistSession: false } });

  const { data: estoque } = await supabase
    .from('estoque')
    .select(`
      id,
      quantidade,
      quantidade_reservada,
      endereco:enderecos(codigo),
      produto:produtos(sku, nome)
    `)
    .in('produto_id', ['5e7b2578-cc7d-457e-bbdd-86c279622bc8', '45f70da5-ca36-49b5-86b1-89c37b715c31']);

  console.log("Estoque atual:", estoque);
}

checkStock().catch(console.error);
