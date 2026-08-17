import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data } = await supabase.from('pedidos_expedicao').select('codigo, payload_origem').in('status', ['CONFERIDO', 'EXPEDIDO', 'ENTREGUE', 'PRONTO_ROMANEIO']).limit(10).order('updated_at', { ascending: false });
  console.log(JSON.stringify(data.map(d => ({ code: d.codigo, picking: d.payload_origem?.separacao, conf: d.payload_origem?.conferencia })), null, 2));
}
main();
