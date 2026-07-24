import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createSupabaseAdminClient } from '../src/lib/supabase-admin';
import { loadPickingStockRows } from '../src/lib/shipping-picking'; // THIS EXPORT DOESN'T EXIST (it's not exported)!

// Let's just query directly!
async function main() {
  const supabase = createSupabaseAdminClient();
  const { data: order } = await supabase.from('pedidos_expedicao').select('id, numero_wms, depositante_id').eq('numero_wms', 399).single();
  const { data: stock } = await supabase.from('estoque').select('id, depositante_id, produto_id').eq('produto_id', '1391f062-3e9b-4f9d-a364-d480b7499eaf').limit(1);

  console.log('Order depositante_id:', order?.depositante_id);
  console.log('Stock depositante_id:', stock?.[0]?.depositante_id);
}

main().catch(console.error);
