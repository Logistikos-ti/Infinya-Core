"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decodeXmlBuffer, parseNfeXml } from "@/lib/nfe-import";
import { storeOperationalDocumentFromBuffer } from "@/lib/operational-documents";
import { allowedDocumentMimeTypes, maxDocumentFileSizeBytes } from "@/lib/storage";
import {
  describeReturnInvoiceDivergence,
  validateReturnInvoiceAgainstOrder,
  type ReturnInvoiceDivergence,
} from "@/lib/return-invoice-validation";
import { registrarLancamentoLogisticaReversa } from "@/lib/billing";
import { AWAITING_RETURN_INVOICE_STATUS, normalizeShippingOperationType } from "@/lib/shipping";

export type UploadReturnInvoiceState = {
  status: "idle" | "success" | "error";
  detail?: string;
  divergences?: ReturnInvoiceDivergence[];
};

const idleState: UploadReturnInvoiceState = { status: "idle" };

export async function uploadReturnInvoiceAction(
  _prev: UploadReturnInvoiceState = idleState,
  formData: FormData,
): Promise<UploadReturnInvoiceState> {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const orderId = String(formData.get("orderId") ?? "").trim();

  if (!orderId) {
    return { status: "error", detail: "Pedido não informado." };
  }

  const file = formData.get("returnInvoiceXml");
  if (typeof File === "undefined" || !(file instanceof File) || !file.name || file.size <= 0) {
    return { status: "error", detail: "Anexe o arquivo XML da NF-e de devolução." };
  }

  if (!file.name.toLowerCase().endsWith(".xml")) {
    return { status: "error", detail: "O arquivo precisa ser um XML de NF-e." };
  }

  if (file.size > maxDocumentFileSizeBytes) {
    return { status: "error", detail: "O arquivo excede o limite de 10 MB." };
  }

  if (file.type && !allowedDocumentMimeTypes.includes(file.type as (typeof allowedDocumentMimeTypes)[number])) {
    return { status: "error", detail: "Formato de arquivo não suportado." };
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, depositante_id, status, tipo_operacao, payload_origem")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { status: "error", detail: orderError?.message || "Pedido não encontrado." };
  }

  if (normalizeShippingOperationType(order.tipo_operacao) !== "RETIRADA") {
    return { status: "error", detail: "Este pedido não é uma retirada de mercadoria." };
  }

  if (order.status !== AWAITING_RETURN_INVOICE_STATUS) {
    return { status: "error", detail: "A NF-e de devolução já foi anexada para este pedido." };
  }

  const { data: items, error: itemsError } = await adminSupabase
    .from("pedidos_expedicao_itens")
    .select("produto_id, codigo_produto, sku, nome, quantidade")
    .eq("pedido_expedicao_id", orderId);

  if (itemsError || !items?.length) {
    return { status: "error", detail: itemsError?.message || "O pedido não possui itens para conferir." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let parsedNfe;
  try {
    const xmlText = decodeXmlBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    parsedNfe = parseNfeXml(xmlText);
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "O XML não foi reconhecido como uma NF-e válida.",
    };
  }

  const validation = validateReturnInvoiceAgainstOrder(
    items.map((item) => ({
      produtoId: item.produto_id,
      codigoProduto: item.codigo_produto,
      sku: item.sku,
      nome: item.nome,
      quantidade: Number(item.quantidade ?? 0),
    })),
    parsedNfe,
  );

  // Divergência mantém o pedido bloqueado: o operador precisa subir a NF-e correta.
  if (!validation.ok) {
    return {
      status: "error",
      detail: `A NF-e não confere com o pedido:\n${validation.divergences.map(describeReturnInvoiceDivergence).join("\n")}`,
      divergences: validation.divergences,
    };
  }

  try {
    await storeOperationalDocumentFromBuffer({
      adminSupabase,
      depositanteId: order.depositante_id,
      tipo: "NF",
      fileName: file.name,
      mimeType: file.type || "application/xml",
      bytes,
      pedidoExpedicaoId: orderId,
      enviadoPor: user.id,
    });
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Não foi possível armazenar o XML da NF-e.",
    };
  }

  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const { error: updateError } = await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status: "NOVO",
      payload_origem: {
        ...payload,
        notaFiscal: {
          ...(isRecord(payload.notaFiscal) ? payload.notaFiscal : {}),
          numero: parsedNfe.noteNumber,
          chave: parsedNfe.accessKey,
          devolucao: true,
        },
        notaFiscalDevolucao: {
          numero: parsedNfe.noteNumber,
          chaveAcesso: parsedNfe.accessKey,
          anexadaPorId: user.id,
          anexadaPorNome: user.nome,
          anexadaEm: new Date().toISOString(),
        },
      },
    })
    .eq("id", orderId);

  if (updateError) {
    return { status: "error", detail: updateError.message || "Não foi possível liberar o pedido." };
  }

  registrarLancamentoLogisticaReversa(orderId).catch(() => {});

  revalidatePath("/expedicao");
  revalidatePath(`/expedicao/${orderId}`);
  revalidatePath("/expedicao/separacao");
  revalidatePath("/portal");

  return { status: "success", detail: `NF-e ${parsedNfe.noteNumber} validada. Pedido liberado para separação.` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
