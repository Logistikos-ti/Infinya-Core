import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: depositantes, error: depError } = await supabase
    .from("depositantes")
    .select("id, nome")
    .ilike("nome", "%john skull%");

  if (depError) {
    console.error("Error fetching depositantes:", depError);
    return;
  }

  if (!depositantes || depositantes.length === 0) {
    console.log("No depositante found matching 'john skull'");
    return;
  }

  const depositante = depositantes[0];
  console.log("Found depositante:", depositante.nome, depositante.id);

  const { data: updated, error: updError } = await supabase
    .from("produtos")
    .update({ categoria: "Vestuário" })
    .eq("depositante_id", depositante.id)
    .select("id, nome, categoria");

  if (updError) {
    console.error("Error updating products:", updError);
    return;
  }

  console.log(`Updated ${updated?.length || 0} products to categoria = 'Vestuário'`);
}

main();
