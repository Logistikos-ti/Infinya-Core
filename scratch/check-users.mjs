import { createClient } from '@supabase/supabase-js';

const prodDb = {
  url: "https://brevhcwdhqyjqseduwpb.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyZXZoY3dkaHF5anFzZWR1d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTAxMSwiZXhwIjoyMDk2ODk1MDExfQ.3v3-tjAa334DOeqIZs84DZdxkvqJWCMPm5XUc1e2fqk"
};

const supabase = createClient(prodDb.url, prodDb.key, { auth: { persistSession: false } });

async function run() {
  const { data: users } = await supabase.from('usuarios').select('id, email, papel, depositante_id');
  console.log("Users:", users);
}

run();
