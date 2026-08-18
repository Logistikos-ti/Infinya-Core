import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: q } = await admin.from('pedidos_expedicao').select('status').limit(100);
  const statuses = new Set(q?.map(x => x.status));
  console.log("Found statuses:", Array.from(statuses));
}
main();
