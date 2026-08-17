import { createSupabaseAdminClient } from './src/lib/supabase/admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const adminSupabase = createSupabaseAdminClient();
  const res = await adminSupabase
    .from("pedidos_expedicao")
    .select("codigo, status, payload_origem")
    .in("status", ["CONFERIDO", "EXPEDIDO", "PRONTO_ROMANEIO"])
    .order('updated_at', { ascending: false })
    .limit(10);
    
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
