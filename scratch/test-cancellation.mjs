import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase env vars");
  process.exit(1);
}
const admin = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: users } = await admin.from('usuarios').select('id').limit(1);
  const userId = users[0].id;

  const orderId = '3c800d8d-ab66-4e07-861b-9d3b0d64e0ab';
  
  const { data: order, error: readError } = await admin
    .from("pedidos_expedicao")
    .select("id, status, depositante_id, payload_origem, codigo, numero_wms, numero_pedido")
    .eq("id", orderId)
    .single();
    
  if (readError) {
    console.error("readError:", readError);
    return;
  }
  
  const payload = order.payload_origem || {};
  
  // Try to update order
  const { error: updateError } = await admin
    .from("pedidos_expedicao")
    .update({
        payload_origem: {
          ...payload,
          divergenciaTratada: false,
          divergencia: {
            motivo: "Solicitação de cancelamento pelo depositante via chamado.",
            tipo: "Cancelamento",
            chamado_id: 'fake-ticket-id',
            registradoPorNome: 'User Test',
          },
          cancellationReporter: userId,
          cancellationReason: 'test msg',
        }
    })
    .eq("id", orderId);
    
  if (updateError) {
    console.error("updateError:", updateError);
    return;
  }
  
  console.log("All OK");
}

main();
