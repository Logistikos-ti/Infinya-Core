import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function run() {
  const { data, error } = await supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, origem, status, numero_pedido, numero_loja, canal, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, sincronizado_em, cliente_nome, cliente_cidade, cliente_uf, observacoes, payload_origem, depositante_id, depositante:depositantes(nome), itens:pedidos_expedicao_itens(id, referencia_externa, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada), documentos:documentos_armazenados(tipo, nome_arquivo, mime_type)"
    )
    .eq('numero_wms', 405);
    
  if (error) console.error(error);
  else {
    const item = data[0];
    const docs = Array.isArray((item as any).documentos) ? (item as any).documentos : [];
    const hasNfe = docs.some((d: any) => d.tipo === "NF" || (d.mime_type && d.mime_type.includes("xml")));
    
    console.log("hasNfe computed:", hasNfe);
    console.log("raw documentos:", item.documentos);
  }
}

run();
