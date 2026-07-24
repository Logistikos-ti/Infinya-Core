import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data: order } = await supabase.from('pedidos_expedicao').select('id, numero_wms, depositante_id').eq('numero_wms', 399).single();
  console.log('Order depositante_id:', order?.depositante_id);
}
run();
