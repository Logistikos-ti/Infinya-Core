import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}
const admin = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: deps } = await admin.from('depositantes').select('id').ilike('nome', '%evolveg%').limit(1);
  if (!deps || deps.length === 0) return;
  const depositanteId = deps[0].id;

  const { data: tickets } = await admin.from('suporte_chamados').select('id').eq('depositante_id', depositanteId);
  if (tickets && tickets.length > 0) {
    const ids = tickets.map(t => t.id);
    await admin.from('suporte_comentarios').delete().in('chamado_id', ids);
    await admin.from('suporte_chamados').delete().in('id', ids);
    console.log("Deleted tickets:", ids.length);
  }
  
  // Also recreate TC001 or just clear its divergence? Let's just delete the order so they can recreate or I can recreate
  const { data: orders } = await admin.from('pedidos_expedicao').select('id').eq('codigo', 'TESTE-CANCEL-001');
  if (orders && orders.length > 0) {
    const orderIds = orders.map(o => o.id);
    await admin.from('pedidos_expedicao_itens').delete().in('pedido_id', orderIds);
    await admin.from('pedidos_expedicao').delete().in('id', orderIds);
    console.log("Deleted TESTE-CANCEL-001");
  }
  console.log("Done");
}
main();
