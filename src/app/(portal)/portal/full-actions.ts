"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { decodeXmlBuffer, matchNfeProductsToCatalog, parseNfeXml } from "@/lib/nfe-import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowedDocumentMimeTypes, documentsBucketName, maxDocumentFileSizeBytes, sanitizeFileName } from "@/lib/storage";

export type FullShipmentSubmissionState = {
  status: "idle" | "success" | "error";
  detail?: string;
};

const requiredDocumentFields = ["entryAuthorization", "volumeLabel"] as const;

function getFile(formData: FormData, field: string) {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

function assertDocument(file: File | null, label: string) {
  if (!file) throw new Error(`${label} e obrigatorio.`);
  if (file.size > maxDocumentFileSizeBytes) throw new Error(`${label} excede o limite de 10 MB.`);
  if (!allowedDocumentMimeTypes.includes(file.type as (typeof allowedDocumentMimeTypes)[number])) {
    throw new Error(`${label} deve ser PDF, XML, PNG ou JPG.`);
  }
}

function buildCollectionAt(date: string, time: string) {
  const value = new Date(`${date}T${time}:00-03:00`);
  if (!date || !time || Number.isNaN(value.getTime())) throw new Error("Informe data e horario previstos para a coleta.");
  return value.toISOString();
}

export async function createFullShipmentAction(
  _previous: FullShipmentSubmissionState,
  formData: FormData,
): Promise<FullShipmentSubmissionState> {
  try {
    const user = await requireRoleAccess(["DEPOSITANTE", "ADMIN", "TI"]);
    const depositanteId = String(formData.get("depositanteId") ?? "").trim();
    const marketplace = String(formData.get("marketplace") ?? "").trim();
    const modalidadeEnvio = String(formData.get("modalidadeEnvio") ?? "").trim().toUpperCase();
    const transportadoraNome = String(formData.get("transportadoraNome") ?? "").trim();
    const collectionAt = buildCollectionAt(
      String(formData.get("collectionDate") ?? ""),
      String(formData.get("collectionTime") ?? ""),
    );
    const invoiceXml = getFile(formData, "invoiceXml");
    assertDocument(invoiceXml, "O XML da NF-e");
    for (const field of requiredDocumentFields) assertDocument(getFile(formData, field), field === "entryAuthorization" ? "A autorizacao de entrada" : "A etiqueta de volume");
    if (!depositanteId || !marketplace) throw new Error("Selecione o depositante e o marketplace.");
    if (modalidadeEnvio !== "COLETA" && modalidadeEnvio !== "TRANSPORTADORA") {
      throw new Error("Escolha se o pedido Full será por coleta ou transportadora.");
    }
    if (modalidadeEnvio === "TRANSPORTADORA" && !transportadoraNome) {
      throw new Error("Informe o nome da transportadora.");
    }
    if (user.papel === "DEPOSITANTE" && user.depositanteId !== depositanteId) throw new Error("Voce nao pode criar uma remessa para outro depositante.");

    const xmlBuffer = await invoiceXml!.arrayBuffer();
    const nfe = parseNfeXml(decodeXmlBuffer(xmlBuffer));
    if (nfe.direction !== "SAIDA") throw new Error("A NF-e Full deve ser de saida.");
    const admin = createSupabaseAdminClient();
    const { data: products, error: productsError } = await admin
      .from("produtos")
      .select("id, nome, sku, codigo_interno, codigo_externo")
      .eq("depositante_id", depositanteId)
      .eq("ativo", true);
    if (productsError) throw productsError;
    const productMatch = matchNfeProductsToCatalog(nfe.items, products ?? []);
    if (productMatch.unmatched.length) {
      throw new Error(`Nao encontramos no catalogo: ${productMatch.unmatched.slice(0, 3).map((item) => item.descricao).join(", ")}. Cadastre ou corrija os SKUs antes de enviar.`);
    }
    const itemLabels = formData.getAll("itemLabel").filter((value): value is File => value instanceof File && value.size > 0);
    if (itemLabels.length < productMatch.matched.length) throw new Error("Anexe uma etiqueta de produto para cada item da NF-e.");
    itemLabels.forEach((file) => assertDocument(file, "A etiqueta do produto"));
    if (nfe.accessKey) {
      const { data: duplicate } = await admin.from("remessas_full").select("codigo").eq("depositante_id", depositanteId).eq("chave_acesso", nfe.accessKey).maybeSingle();
      if (duplicate) throw new Error(`Esta NF-e ja esta vinculada a remessa ${duplicate.codigo}.`);
    }

    const code = `FULL-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;
    const { data: shipment, error: shipmentError } = await admin.from("remessas_full").insert({
      depositante_id: depositanteId, codigo: code, marketplace, status: "DOCUMENTACAO_PENDENTE",
      nota_fiscal_numero: nfe.noteNumber, chave_acesso: nfe.accessKey, emitente_nome: nfe.supplierName,
      emitente_documento: nfe.supplierDocument, destinatario_nome: nfe.recipientName,
      destinatario_documento: nfe.recipientDocument, destinatario_endereco: nfe.recipientAddress,
      modalidade_envio: modalidadeEnvio,
      transportadora_nome: modalidadeEnvio === "TRANSPORTADORA" ? transportadoraNome : null,
      quantidade_volumes: nfe.volumeCount || 1,
      valor_total: nfe.totalValue, coleta_prevista_em: collectionAt,
      observacoes: String(formData.get("observacoes") ?? "").trim() || null,
      criado_por: user.id, payload_origem: { nfe, tipo: "FULL" },
    }).select("id").single();
    if (shipmentError || !shipment) throw shipmentError ?? new Error("Nao foi possivel criar a remessa Full.");

    const { data: itemRows, error: itemsError } = await admin.from("remessas_full_itens").insert(productMatch.matched.map((item) => ({
      remessa_full_id: shipment.id, depositante_id: depositanteId, produto_id: item.productId,
      codigo_produto: item.origemCodigo, sku: item.sku, ean: item.origemEan, nome: item.nome, quantidade: item.quantidade,
    }))).select("id");
    if (itemsError || !itemRows) throw itemsError ?? new Error("Nao foi possivel registrar os itens da remessa.");

    const uploads: Array<{ file: File; type: string; itemId?: string }> = [
      { file: invoiceXml!, type: "XML_NF" },
      { file: getFile(formData, "entryAuthorization")!, type: "AUTORIZACAO_ENTRADA" },
      { file: getFile(formData, "volumeLabel")!, type: "ETIQUETA_VOLUME" },
      ...itemLabels.slice(0, itemRows.length).map((file, index) => ({ file, type: "ETIQUETA_ITEM", itemId: itemRows[index].id })),
    ];
    const documents = [];
    for (const upload of uploads) {
      const path = `full/${depositanteId}/${shipment.id}/${randomUUID()}-${sanitizeFileName(upload.file.name)}`;
      const { error: uploadError } = await admin.storage.from(documentsBucketName).upload(path, Buffer.from(await upload.file.arrayBuffer()), { contentType: upload.file.type, upsert: false });
      if (uploadError) throw uploadError;
      documents.push({ remessa_full_id: shipment.id, remessa_full_item_id: upload.itemId ?? null, depositante_id: depositanteId, tipo: upload.type, nome_arquivo: upload.file.name, caminho_storage: path, mime_type: upload.file.type, tamanho_bytes: upload.file.size, enviado_por: user.id });
    }
    const { error: documentError } = await admin.from("remessas_full_documentos").insert(documents);
    if (documentError) throw documentError;
    await admin.from("remessas_full").update({ status: "PRONTA_PREPARACAO" }).eq("id", shipment.id);
    revalidatePath("/portal");
    return { status: "success", detail: `Remessa ${code} criada e pronta para preparacao.` };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "Nao foi possivel criar a remessa Full." };
  }
}
