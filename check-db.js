require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from("movimentacoes_estoque").select("*").limit(1);
  if (error) console.error("Error from movimentacoes_estoque:", error.message);
  else console.log("movimentacoes_estoque columns:", Object.keys(data[0] || {}));
  
  const { data: d2, error: e2 } = await supabase.from("estoque").select("*, enderecos(codigo)").limit(1);
  if (e2) console.error("Error from estoque:", e2.message);
  else console.log("estoque columns:", Object.keys(d2[0] || {}));
}
check();
