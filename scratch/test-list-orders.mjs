import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Testing query 1: with documentos and itens...");
  const res1 = await supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, origem, status, numero_pedido, numero_loja, canal, valor_total, quantidade_itens, quantidade_unidades, created_at, updated_at, data_pedido, previsao_envio_em, sincronizado_em, cliente_nome, cliente_cidade, cliente_uf, observacoes, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada), documentos:documentos_armazenados(tipo, nome_arquivo, mime_type, caminho_storage)"
    )
    .limit(5);

  console.log("Res 1 error:", res1.error);
  console.log("Res 1 data count:", res1.data?.length);

  console.log("Testing query 2: without documentos...");
  const res2 = await supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, origem, status, numero_pedido, numero_loja, canal, valor_total, quantidade_itens, quantidade_unidades, created_at, updated_at, data_pedido, previsao_envio_em, sincronizado_em, cliente_nome, cliente_cidade, cliente_uf, observacoes, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada)"
    )
    .limit(5);

  console.log("Res 2 error:", res2.error);
  console.log("Res 2 data count:", res2.data?.length);
}

run();
