import { createClient } from '@supabase/supabase-js';

const prodDb = {
  name: "Production (brevhcwdhqyjqseduwpb)",
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

async function checkEntradas() {
  const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

  // 1. Check pedidos_entrada_itens
  try {
    const { data: entItens } = await supabase
      .from('pedidos_entrada_itens')
      .select('*, pedidos_entrada(*)')
      .or('nome.ilike.%katbom%,sku.ilike.%katbom%');
    console.log("Entrada itens com katbom:", entItens);
  } catch (e) {
    console.log("pedidos_entrada_itens erro:", e.message);
  }

  // 2. Check estoque
  try {
    const { data: estoque } = await supabase
      .from('estoque_posicoes')
      .select('*, produtos(*)')
      .eq('produto_id', 'ef05452e-481f-4366-82d1-e40dbfd760a8');
    console.log("Posições de estoque para Areia katbom 3kg:", estoque);
  } catch (e) {
    console.log("estoque_posicoes erro:", e.message);
  }
}

checkEntradas().catch(console.error);
