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
  errorCode?: "UNMATCHED_PRODUCTS";
  unmatchedProducts?: Array<{
    key: string;
    name: string;
    code: string | null;
    ean: string | null;
    quantity: number;
  }>;
};

const requiredDocumentFields = ["entryAuthorization", "volumeLabel"] as const;

function getFile(formData: FormData, field: string) {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

function assertDocument(file: File | null, label: string) {
  if (!file) throw new Error(`${label} é obrigatório.`);
  if (file.size > maxDocumentFileSizeBytes) throw new Error(`${label} excede o limite de 10 MB.`);
  if (!allowedDocumentMimeTypes.includes(file.type as (typeof allowedDocumentMimeTypes)[number])) {
    throw new Error(`${label} deve ser PDF, XML, PNG ou JPG.`);
  }
}

function buildCollectionAt(date: string, time: string) {
  const value = new Date(`${date}T${time}:00-03:00`);
  if (!date || !time || Number.isNaN(value.getTime())) throw new Error("Informe data e horário previstos para a coleta.");
  return value.toISOString();
}

function fullSalesChannelCode(value: string) {
  const normalized = value.toLocaleLowerCase("pt-BR");
  if (normalized.includes("mercado livre")) return "MERCADO_LIVRE";
  if (normalized.includes("shopee")) return "SHOPEE";
  if (normalized.includes("amazon")) return "AMAZON";
  if (normalized.includes("magalu") || normalized.includes("magazine")) return "MAGAZINE_LUIZA";
  return "OUTRO";
}

function fullUnmatchedProductKey(item: {
  codigo: string | null;
  ean: string | null;
  descricao: string;
}) {
  return [item.codigo ?? "", item.ean ?? "", item.descricao]
    .map((value) => value.trim().toLocaleLowerCase("pt-BR"))
    .join("|");
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
    const collectionDate = String(formData.get("collectionDate") ?? "").trim();
    const collectionAt = buildCollectionAt(
      collectionDate,
      String(formData.get("collectionTime") ?? ""),
    );
    const invoiceXml = getFile(formData, "invoiceXml");
    assertDocument(invoiceXml, "O XML da NF-e");
    for (const field of requiredDocumentFields) assertDocument(getFile(formData, field), field === "entryAuthorization" ? "A autorização de entrada" : "A etiqueta de volume");
    if (!depositanteId || !marketplace) throw new Error("Selecione o depositante e o marketplace.");
    if (modalidadeEnvio !== "COLETA" && modalidadeEnvio !== "TRANSPORTADORA") {
      throw new Error("Escolha se o pedido Full será por coleta ou transportadora.");
    }
    if (modalidadeEnvio === "TRANSPORTADORA" && !transportadoraNome) {
      throw new Error("Informe o nome da transportadora.");
    }
    const carrierLabel = modalidadeEnvio === "TRANSPORTADORA" ? getFile(formData, "carrierLabel") : null;
    if (modalidadeEnvio === "TRANSPORTADORA") {
      assertDocument(carrierLabel, "A etiqueta da transportadora");
    }
    if (user.papel === "DEPOSITANTE" && user.depositanteId !== depositanteId) throw new Error("Você não pode criar uma remessa para outro depositante.");

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
      return {
        status: "error",
        errorCode: "UNMATCHED_PRODUCTS",
        detail: `${productMatch.unmatched.length} produto(s) da NF-e ainda não possuem vínculo com o catálogo. Cadastre ou vincule os itens abaixo para continuar.`,
        unmatchedProducts: productMatch.unmatched.map((item) => ({
          key: fullUnmatchedProductKey(item),
          name: item.descricao,
          code: item.codigo,
          ean: item.ean,
          quantity: item.quantidade,
        })),
      };
    }

    const requestedByProduct = new Map<string, { name: string; quantity: number }>();
    for (const item of productMatch.matched) {
      const current = requestedByProduct.get(item.productId);
      requestedByProduct.set(item.productId, {
        name: current?.name ?? item.nome,
        quantity: (current?.quantity ?? 0) + Number(item.quantidade ?? 0),
      });
    }
    const productIds = [...requestedByProduct.keys()];
    const { data: stockRows, error: stockError } = await admin
      .from("estoque")
      .select("produto_id, quantidade, quantidade_reservada, bloqueado")
      .eq("depositante_id", depositanteId)
      .in("produto_id", productIds)
      .eq("bloqueado", false);
    if (stockError) throw stockError;

    const availableByProduct = new Map<string, number>();
    for (const row of stockRows ?? []) {
      const available = Math.max(0, Number(row.quantidade ?? 0) - Number(row.quantidade_reservada ?? 0));
      availableByProduct.set(row.produto_id, (availableByProduct.get(row.produto_id) ?? 0) + available);
    }
    const shortages = [...requestedByProduct.entries()]
      .map(([productId, requested]) => ({
        ...requested,
        available: availableByProduct.get(productId) ?? 0,
      }))
      .filter((item) => item.available < item.quantity);
    if (shortages.length) {
      const details = shortages
        .map((item) => `${item.name}: solicitadas ${item.quantity}, disponíveis ${item.available}, faltam ${item.quantity - item.available}`)
        .join("; ");
      throw new Error(`Estoque insuficiente para a remessa Full. ${details}`);
    }

    const itemLabels = formData.getAll("itemLabels").filter((value): value is File => value instanceof File && value.size > 0);
    if (itemLabels.length !== productMatch.matched.length) {
      throw new Error(`Anexe exatamente ${productMatch.matched.length} etiqueta(s) de produto, uma para cada item da NF-e.`);
    }
    itemLabels.forEach((file) => assertDocument(file, "A etiqueta do produto"));
    if (nfe.accessKey) {
      const { data: duplicate } = await admin.from("remessas_full").select("codigo").eq("depositante_id", depositanteId).eq("chave_acesso", nfe.accessKey).maybeSingle();
      if (duplicate) throw new Error(`Esta NF-e já está vinculada à remessa ${duplicate.codigo}.`);
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
    if (shipmentError || !shipment) throw shipmentError ?? new Error("Não foi possível criar a remessa Full.");

    const { data: itemRows, error: itemsError } = await admin.from("remessas_full_itens").insert(productMatch.matched.map((item) => ({
      remessa_full_id: shipment.id, depositante_id: depositanteId, produto_id: item.productId,
      codigo_produto: item.origemCodigo, sku: item.sku, ean: item.origemEan, nome: item.nome, quantidade: item.quantidade,
    }))).select("id");
    if (itemsError || !itemRows) throw itemsError ?? new Error("Não foi possível registrar os itens da remessa.");

    const uploads: Array<{ file: File; type: string; itemId?: string }> = [
      { file: invoiceXml!, type: "XML_NF" },
      { file: getFile(formData, "entryAuthorization")!, type: "AUTORIZACAO_ENTRADA" },
      { file: getFile(formData, "volumeLabel")!, type: "ETIQUETA_VOLUME" },
      ...(carrierLabel ? [{ file: carrierLabel, type: "ETIQUETA_TRANSPORTADORA" }] : []),
      ...itemLabels.map((file, index) => ({ file, type: "ETIQUETA_ITEM", itemId: itemRows[index].id })),
    ];
    const documents = [];
    const uploadedPaths: string[] = [];
    let createdOrderId: string | null = null;

    try {
      for (const upload of uploads) {
        const path = `full/${depositanteId}/${shipment.id}/${randomUUID()}-${sanitizeFileName(upload.file.name)}`;
        const { error: uploadError } = await admin.storage.from(documentsBucketName).upload(path, Buffer.from(await upload.file.arrayBuffer()), { contentType: upload.file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        documents.push({ remessa_full_id: shipment.id, remessa_full_item_id: upload.itemId ?? null, depositante_id: depositanteId, tipo: upload.type, nome_arquivo: upload.file.name, caminho_storage: path, mime_type: upload.file.type, tamanho_bytes: upload.file.size, enviado_por: user.id });
      }

      const { error: documentError } = await admin.from("remessas_full_documentos").insert(documents);
      if (documentError) throw documentError;

      const recipientParts = nfe.recipientAddress?.split(" | ") ?? [];
      const cityUf = recipientParts.find((part) => /\s-\s[A-Z]{2}(?:\s|$)/.test(part)) ?? "";
      const [clienteCidade, clienteUf] = cityUf.split(" - ").map((value) => value.trim());
      const totalUnits = productMatch.matched.reduce((sum, item) => sum + Number(item.quantidade ?? 0), 0);
      const now = new Date().toISOString();
      const channelCode = fullSalesChannelCode(marketplace);
      const fullPayload = {
        tipo: "FULL",
        full: {
          remessaId: shipment.id,
          codigo: code,
          marketplace,
          modalidadeEnvio,
          transportadoraNome: modalidadeEnvio === "TRANSPORTADORA" ? transportadoraNome : null,
          coletaPrevistaEm: collectionAt,
          notaFiscal: nfe.noteNumber,
        },
        comercial: {
          manual: true,
          marketplace: true,
          salesChannelCode: channelCode,
          storeDisplay: marketplace,
        },
        destinatario: {
          documento: nfe.recipientDocument,
          endereco: nfe.recipientAddress,
        },
        notaFiscal: {
          numero: nfe.noteNumber,
          chave: nfe.accessKey,
          protocolo: nfe.protocolNumber,
          status: nfe.protocolStatusLabel,
        },
        transporte: {
          contato: { nome: transportadoraNome || nfe.carrierName || null },
          volumes: [{ quantidade: nfe.volumeCount || 1, servico: transportadoraNome || nfe.carrierName || null }],
        },
        xml: {
          emitente: nfe.supplierName,
          documentoEmitente: nfe.supplierDocument,
          emitidoEm: nfe.issuedAt,
          pesoBruto: nfe.grossWeight,
          informacoesAdicionais: nfe.additionalInfo,
        },
      };

      const { data: createdOrder, error: orderError } = await admin
        .from("pedidos_expedicao")
        .insert({
          depositante_id: depositanteId,
          codigo: `FULL-${randomUUID()}`,
          referencia_externa: `FULL-${shipment.id}`,
          origem: "FULL",
          canal: marketplace,
          status: "NOVO",
          status_origem: "FULL",
          numero_pedido: nfe.noteNumber,
          numero_loja: nfe.accessKey,
          cliente_nome: nfe.recipientName,
          cliente_documento: nfe.recipientDocument,
          cliente_cidade: clienteCidade || null,
          cliente_uf: clienteUf || null,
          valor_total: nfe.totalValue,
          quantidade_itens: productMatch.matched.length,
          quantidade_unidades: totalUnits,
          data_pedido: now,
          previsao_envio_em: collectionDate || null,
          sincronizado_em: now,
          remessa_full_id: shipment.id,
          payload_origem: fullPayload,
          observacoes: `Pedido FULL - coleta prevista para ${collectionDate}.`,
        })
        .select("id")
        .single();
      if (orderError || !createdOrder) throw orderError ?? new Error("Não foi possível criar o pedido operacional da remessa Full.");
      createdOrderId = createdOrder.id;

      const orderItems = productMatch.matched.map((item) => ({
        pedido_expedicao_id: createdOrder.id,
        depositante_id: depositanteId,
        produto_id: item.productId,
        codigo_produto: item.origemCodigo || item.origemEan || item.sku || null,
        sku: item.sku || null,
        nome: item.nome,
        unidade: "UNIDADE",
        quantidade: item.quantidade,
        quantidade_separada: 0,
        payload_origem: { full: true, remessaFullId: shipment.id, origemCodigo: item.origemCodigo, origemEan: item.origemEan },
      }));
      const { error: orderItemsError } = await admin.from("pedidos_expedicao_itens").insert(orderItems);
      if (orderItemsError) throw orderItemsError;

      const operationalDocuments = documents
        .filter((document) => document.tipo === "XML_NF" || document.tipo === "ETIQUETA_TRANSPORTADORA" || (!carrierLabel && document.tipo === "ETIQUETA_VOLUME"))
        .map((document) => ({
          depositante_id: depositanteId,
          pedido_expedicao_id: createdOrder.id,
          tipo: document.tipo === "XML_NF" ? "NF" : "ETIQUETA",
          nome_arquivo: document.nome_arquivo,
          caminho_storage: document.caminho_storage,
          mime_type: document.mime_type,
          tamanho_bytes: document.tamanho_bytes,
          enviado_por: user.id,
        }));
      const { error: operationalDocumentsError } = await admin
        .from("documentos_armazenados")
        .insert(operationalDocuments);
      if (operationalDocumentsError) throw operationalDocumentsError;

      const { error: linkError } = await admin
        .from("remessas_full")
        .update({ pedido_expedicao_id: createdOrder.id, status: "PRONTA_PREPARACAO" })
        .eq("id", shipment.id);
      if (linkError) throw linkError;
    } catch (error) {
      if (uploadedPaths.length) {
        await admin.storage.from(documentsBucketName).remove(uploadedPaths);
      }
      if (createdOrderId) {
        await admin.from("pedidos_expedicao").delete().eq("id", createdOrderId);
      }
      await admin.from("remessas_full").delete().eq("id", shipment.id);
      throw error;
    }

    revalidatePath("/portal");
    revalidatePath("/expedicao");
    return { status: "success", detail: `Remessa ${code} criada e pronta para preparação.` };
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "Não foi possível criar a remessa Full." };
  }
}
