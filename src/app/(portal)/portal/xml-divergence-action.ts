"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseNfeXml, matchNfeProductsToCatalog, decodeXmlBuffer } from "@/lib/nfe-import";

export async function submitDivergenceXmlCorrection(orderId: string, formData: FormData) {
  const supabase = createSupabaseServerClient();
  const auth = await supabase.auth.getUser();

  if (!auth.data.user) {
    return { error: "Não autenticado." };
  }

  const file = formData.get("xml") as File;
  if (!file) {
    return { error: "Nenhum arquivo XML enviado." };
  }

  const adminSupabase = createSupabaseAdminClient();

  // Load the order and check if it really is in divergence
  const { data: order } = await adminSupabase
    .from("pedidos_recebimento")
    .select("id, status, depositante_id")
    .eq("id", orderId)
    .single();

  if (!order) {
    return { error: "Pedido não encontrado." };
  }
  if (order.status !== "DIVERGENCIA") {
    return { error: "Este pedido não está em status de divergência." };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  let xmlString = "";
  try {
    xmlString = decodeXmlBuffer(buffer);
  } catch {
    return { error: "Não foi possível ler o arquivo XML. Formato inválido." };
  }

  let parsedNfe;
  try {
    parsedNfe = parseNfeXml(xmlString);
  } catch (err: any) {
    return { error: err.message ?? "Erro ao processar o XML." };
  }

  if (parsedNfe.direction !== "ENTRADA" && parsedNfe.direction !== "SAIDA") {
     // Some NFe are entry, some are exit for the client. We'll accept if it has items.
  }

  // Load products to match
  const { data: products } = await adminSupabase
    .from("produtos")
    .select("id, nome, sku, codigo_interno, codigo_externo")
    .eq("depositante_id", order.depositante_id);

  const matched = matchNfeProductsToCatalog(parsedNfe.items, products || []);
  
  if (matched.unmatched.length > 0) {
    return { error: `O XML possui produtos que não estão cadastrados (ex: ${matched.unmatched[0].descricao}). Não é possível prosseguir.` };
  }

  // Load current received quantities
  const { data: receivingItems } = await adminSupabase
    .from("pedidos_recebimento_itens")
    .select("id, produto_id, quantidade_recebida")
    .eq("pedido_recebimento_id", order.id);

  if (!receivingItems || receivingItems.length === 0) {
    return { error: "Nenhum item encontrado neste recebimento." };
  }

  // Compare quantities
  // The XML items specify what SHOULD HAVE been received.
  // The DB items specify what WAS ACTUALLY physically scanned.
  // The logic is: The new XML must exactly match what was physically scanned.

  const xmlQtyByProduct = new Map<string, number>();
  for (const m of matched.matched) {
    const current = xmlQtyByProduct.get(m.produto.id) || 0;
    xmlQtyByProduct.set(m.produto.id, current + m.xmlItem.quantidade);
  }

  const dbQtyByProduct = new Map<string, number>();
  for (const item of receivingItems) {
    const current = dbQtyByProduct.get(item.produto_id) || 0;
    dbQtyByProduct.set(item.produto_id, current + Number(item.quantidade_recebida));
  }

  const productIds = new Set([...xmlQtyByProduct.keys(), ...dbQtyByProduct.keys()]);

  for (const pid of productIds) {
    const xmlQty = xmlQtyByProduct.get(pid) || 0;
    const dbQty = dbQtyByProduct.get(pid) || 0;

    if (xmlQty !== dbQty) {
      const prodInfo = products?.find(p => p.id === pid);
      return { 
        error: `A quantidade do produto ${prodInfo?.sku ?? pid} não bate! O XML informa ${xmlQty}, mas a conferência física contou ${dbQty}.` 
      };
    }
  }

  // All matched! Update status to QUARENTENA_CORRIGIDA
  const { error: updateError } = await adminSupabase
    .from("pedidos_recebimento")
    .update({ 
      status: "QUARENTENA_CORRIGIDA",
      payload_origem: { xml_corrigido: true, fileName: file.name, accessKey: parsedNfe.accessKey }
    })
    .eq("id", order.id);

  if (updateError) {
    return { error: "Erro ao atualizar status do pedido." };
  }

  revalidatePath("/portal");
  return { success: true };
}
