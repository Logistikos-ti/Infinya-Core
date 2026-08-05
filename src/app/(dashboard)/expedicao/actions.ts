"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireRoleAccess } from "@/lib/auth";
import { storeOperationalDocumentFromBuffer } from "@/lib/operational-documents";
import {
  buildManualCommercialPayload,
  getSalesChannelLabel,
  type SalesChannelCode,
} from "@/lib/sales-channels";
import { decodeXmlBuffer, matchNfeProductsToCatalog, parseNfeXml } from "@/lib/nfe-import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowedDocumentMimeTypes, documentsBucketName, maxDocumentFileSizeBytes } from "@/lib/storage";

type ShippingSupplyPayloadItem = {
  id: string;
  kind: string;
  label: string;
  description: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
};

export type ManualShippingOrderSubmissionState = {
  status: "idle" | "success" | "error";
  feedback?: string;
  detail?: string;
};

class ManualShippingOrderSubmissionError extends Error {
  constructor(
    readonly feedback: string,
    message: string,
  ) {
    super(message);
  }
}

export async function updateShippingOrderAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/expedicao?feedback=erro");
  }

  const status = String(formData.get("status") ?? "").trim().toUpperCase();
  const numeroPedido = String(formData.get("numeroPedido") ?? "").trim();
  const numeroLoja = String(formData.get("numeroLoja") ?? "").trim();
  const clienteNome = String(formData.get("clienteNome") ?? "").trim();
  const clienteDocumento = String(formData.get("clienteDocumento") ?? "").trim();
  const clienteCep = String(formData.get("clienteCep") ?? "").trim();
  const clienteEndereco = String(formData.get("clienteEndereco") ?? "").trim();
  const clienteNumero = String(formData.get("clienteNumero") ?? "").trim();
  const clienteTelefone = String(formData.get("clienteTelefone") ?? "").trim();
  const clienteCidade = String(formData.get("clienteCidade") ?? "").trim();
  const clienteUf = String(formData.get("clienteUf") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const previsaoEnvioEm = String(formData.get("previsaoEnvioEm") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();
  const salesChannelCode = String(formData.get("salesChannelCode") ?? "").trim() as SalesChannelCode;
  const customStoreName = String(formData.get("customStoreName") ?? "").trim();
  const mercadoLivreOrderId = String(formData.get("mercadoLivreOrderId") ?? "").trim();
  const mercadoLivreShipmentId = String(formData.get("mercadoLivreShipmentId") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const carrierName = String(formData.get("carrierName") ?? "").trim();
  const shippingService = String(formData.get("shippingService") ?? "").trim();
  const trackingCode = String(formData.get("trackingCode") ?? "").trim();

  const allowedStatuses = new Set([
    "NOVO",
    "EM_SEPARACAO",
    "SEPARADO",
    "EM_CONFERENCIA",
    "CONFERIDO",
    "PRONTO_ROMANEIO",
    "EXPEDIDO",
    "CANCELADO",
  ]);

  if (!allowedStatuses.has(status)) {
    redirect(`/expedicao/${id}/editar?feedback=status-invalido`);
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: currentOrder } = await adminSupabase
    .from("pedidos_expedicao")
    .select("origem, payload_origem")
    .eq("id", id)
    .maybeSingle();

  const currentPayload =
    currentOrder?.payload_origem && typeof currentOrder.payload_origem === "object" && !Array.isArray(currentOrder.payload_origem)
      ? (currentOrder.payload_origem as Record<string, unknown>)
      : {};
  const isManualOrder = currentOrder?.origem === "MANUAL";
  const currentComercial = isRecord(currentPayload.comercial) ? currentPayload.comercial : {};
  const currentTransporte = isRecord(currentPayload.transporte) ? currentPayload.transporte : {};
  const currentContato = isRecord(currentTransporte.contato) ? currentTransporte.contato : {};
  const supplies = extractShippingSupplies(formData);
  const nextPayload = {
    ...currentPayload,
    comercial:
      isManualOrder || salesChannelCode
        ? buildManualCommercialPayload({
            salesChannelCode: salesChannelCode || "VENDA_DIRETA",
            customStoreName,
          })
        : currentComercial,
    mercadoLivre: {
      ...(isRecord(currentPayload.mercadoLivre) ? currentPayload.mercadoLivre : {}),
      orderId: mercadoLivreOrderId || null,
      shipmentId: mercadoLivreShipmentId || null,
    },
    notaFiscal: {
      ...(isRecord(currentPayload.notaFiscal) ? currentPayload.notaFiscal : {}),
      numero: invoiceNumber || null,
    },
    transporte: {
      ...currentTransporte,
      contato: {
        ...currentContato,
        nome: carrierName || null,
      },
      volumes: [
        {
          servico: shippingService || null,
          codigoRastreamento: trackingCode || null,
        },
      ],
    },
    destinatario: {
      cep: clienteCep || null,
      endereco: clienteEndereco || null,
      numero: clienteNumero || null,
      telefone: clienteTelefone || null,
    },
    insumos: {
      itens: supplies,
      custoTotal: supplies.reduce((accumulator, item) => accumulator + item.totalCost, 0),
    },
  };

  const { error } = await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status,
      numero_pedido: numeroPedido || null,
      numero_loja:
        isManualOrder && salesChannelCode === "OUTRO" && customStoreName
          ? customStoreName
          : numeroLoja || null,
      canal:
        isManualOrder || salesChannelCode
          ? getSalesChannelLabel(salesChannelCode || "VENDA_DIRETA") ?? "Venda direta"
          : undefined,
      cliente_nome: clienteNome || null,
      cliente_documento: clienteDocumento || null,
      cliente_cidade: clienteCidade || null,
      cliente_uf: clienteUf || null,
      previsao_envio_em: previsaoEnvioEm || null,
      observacoes: observacoes || null,
      payload_origem: nextPayload,
    })
    .eq("id", id);

  if (error) {
    redirect(`/expedicao/${id}/editar?feedback=erro`);
  }

  revalidatePath("/expedicao");
  revalidatePath(`/expedicao/${id}`);
  revalidatePath(`/expedicao/${id}/editar`);
  redirect(`/expedicao/${id}?feedback=salvo`);
}

export async function createManualShippingOrderAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"]);
  const inlineResponse = String(formData.get("inlineResponse") ?? "") === "1";

  const requestedReturnPath = String(formData.get("returnPath") ?? "/expedicao").trim();
  const returnPath = requestedReturnPath.startsWith("/expedicao") || requestedReturnPath.startsWith("/portal")
    ? requestedReturnPath
    : "/expedicao";
  const fail = (feedback: string, detail: string): never => {
    if (inlineResponse) {
      throw new ManualShippingOrderSubmissionError(feedback, detail);
    }
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}feedback=${feedback}`);
  };
  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const numeroPedido = String(formData.get("numeroPedido") ?? "").trim();
  const numeroLoja = String(formData.get("numeroLoja") ?? "").trim();
  const clienteNome = String(formData.get("clienteNome") ?? "").trim();
  const clienteDocumento = String(formData.get("clienteDocumento") ?? "").trim();
  const clienteCep = String(formData.get("clienteCep") ?? "").trim();
  const clienteEndereco = String(formData.get("clienteEndereco") ?? "").trim();
  const clienteNumero = String(formData.get("clienteNumero") ?? "").trim();
  const clienteTelefone = String(formData.get("clienteTelefone") ?? "").trim();
  const clienteCidade = String(formData.get("clienteCidade") ?? "").trim();
  const clienteUf = String(formData.get("clienteUf") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const previsaoEnvioEm = String(formData.get("previsaoEnvioEm") ?? "").trim();
  const dataPedido = String(formData.get("dataPedido") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();
  const salesChannelCode = String(formData.get("salesChannelCode") ?? "").trim() as SalesChannelCode;
  const customStoreName = String(formData.get("customStoreName") ?? "").trim();
  const mercadoLivreOrderId = String(formData.get("mercadoLivreOrderId") ?? "").trim();
  const mercadoLivreShipmentId = String(formData.get("mercadoLivreShipmentId") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const carrierName = String(formData.get("carrierName") ?? "").trim();
  const shippingService = String(formData.get("shippingService") ?? "").trim();
  const trackingCode = String(formData.get("trackingCode") ?? "").trim();
  const total = Number(String(formData.get("valorTotal") ?? "0").replace(",", "."));
  const itemCount = Number(String(formData.get("quantidadeItens") ?? "0").replace(",", "."));
  const unitCount = Number(String(formData.get("quantidadeUnidades") ?? "0").replace(",", "."));
  const selectedProductIds = formData.getAll("productId[]").map((item) => String(item ?? "").trim()).filter(Boolean);
  const selectedProductQuantities = formData.getAll("itemQuantity[]").map((item) => Number(String(item ?? "0").replace(",", ".")));
  const supplies = extractShippingSupplies(formData);
  const xmlFile = formData.get("invoiceXml");
  const labelFile = formData.get("shippingLabel");

  if (!depositanteId || !numeroPedido || !clienteNome || !salesChannelCode) {
    fail("erro", "Preencha depositante, n\u00famero do pedido, destinat\u00e1rio e canal de venda antes de enviar.");
  }

  if (user.papel === "DEPOSITANTE" && user.depositanteId !== depositanteId) {
    fail("erro", "O depositante selecionado n\u00e3o corresponde ao perfil autenticado.");
  }

  let parsedXmlFile: File | undefined;
  try {
    parsedXmlFile = readRequiredInvoiceUpload(xmlFile);
  } catch {
    fail("nf-obrigatoria", "Anexe o arquivo XML da NF-e antes de enviar o pedido ao CD.");
  }
  const xmlBytes = Buffer.from(await parsedXmlFile.arrayBuffer());
  const xmlText = decodeXmlBuffer(xmlBytes.buffer.slice(xmlBytes.byteOffset, xmlBytes.byteOffset + xmlBytes.byteLength));
  let invoiceMetadata: { noteNumber: string; accessKey: string | null };

  try {
    invoiceMetadata = parseManualInvoiceMetadata(xmlText);
  } catch (error) {
    fail("nf-invalida", error instanceof Error ? error.message : "O XML n\u00e3o foi reconhecido como uma NF-e v\u00e1lida.");
  }

  const invoiceNumberFromXml = invoiceMetadata.noteNumber.trim();
  if (!invoiceNumberFromXml || invoiceNumberFromXml === "Sem numero") {
    fail("nf-invalida", "O XML enviado n\u00e3o possui n\u00famero de NF-e identific\u00e1vel.");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: existingOrders, error: existingOrdersError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, codigo, payload_origem")
    .eq("depositante_id", depositanteId)
    .limit(5000);

  if (existingOrdersError) {
    fail("erro", existingOrdersError.message || "N\u00e3o foi poss\u00edvel consultar pedidos existentes para validar duplicidade.");
  }

  const normalizedInvoiceNumber = normalizeInvoiceNumber(invoiceNumberFromXml);
  const duplicateOrder = (existingOrders ?? []).find((order) => {
    const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
    const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : {};
    return normalizeInvoiceNumber(notaFiscal.numero) === normalizedInvoiceNumber;
  });

  if (duplicateOrder) {
    fail("nf-duplicada", "J\u00e1 existe um pedido deste depositante com o mesmo n\u00famero de NF-e.");
  }

  const channelLabel = getSalesChannelLabel(salesChannelCode) ?? "Venda direta";
  const comercial = buildManualCommercialPayload({
    salesChannelCode,
    customStoreName,
  });

  const payloadOrigem = {
    manual: true,
    criadoPor: {
      userId: user.id,
      nome: user.nome,
      papel: user.papel,
      em: new Date().toISOString(),
    },
    comercial,
    destinatario: {
      cep: clienteCep || null,
      endereco: clienteEndereco || null,
      numero: clienteNumero || null,
      telefone: clienteTelefone || null,
    },
    mercadoLivre: {
      orderId: mercadoLivreOrderId || null,
      shipmentId: mercadoLivreShipmentId || null,
    },
    notaFiscal: {
      numero: invoiceNumberFromXml,
      chave: invoiceMetadata.accessKey,
    },
    transporte: {
      contato: {
        nome: carrierName || null,
      },
      volumes: [
        {
          servico: shippingService || null,
          codigoRastreamento: trackingCode || null,
        },
      ],
    },
    insumos: {
      itens: supplies,
      custoTotal: supplies.reduce((accumulator, item) => accumulator + item.totalCost, 0),
    },
  };

  const headerPayload = {
    depositante_id: depositanteId,
    codigo: buildManualShippingOrderCode(),
    referencia_externa: `MANUAL-${randomUUID()}`,
    origem: "MANUAL",
    canal: channelLabel,
    status: "NOVO",
    status_origem: "MANUAL",
    numero_pedido: numeroPedido,
    numero_loja:
      salesChannelCode === "OUTRO" && customStoreName ? customStoreName : numeroLoja || null,
    cliente_nome: clienteNome,
    cliente_documento: clienteDocumento || null,
    cliente_cidade: clienteCidade || null,
    cliente_uf: clienteUf || null,
    valor_total: Number.isFinite(total) ? total : 0,
    quantidade_itens: Number.isFinite(itemCount) ? itemCount : 0,
    quantidade_unidades: Number.isFinite(unitCount) ? unitCount : 0,
    data_pedido: dataPedido ? `${dataPedido}T00:00:00` : new Date().toISOString(),
    previsao_envio_em: previsaoEnvioEm || null,
    sincronizado_em: new Date().toISOString(),
    payload_origem: payloadOrigem,
    observacoes: observacoes || null,
  };

  try {
    const { data: createdOrder, error } = await adminSupabase
      .from("pedidos_expedicao")
      .insert(headerPayload)
      .select("id")
      .single();

    if (error || !createdOrder) {
      fail("erro", error?.message || "O pedido n\u00e3o p\u00f4de ser criado.");
    }

    if (selectedProductIds.length > 0) {
      const { data: selectedProducts } = await adminSupabase
        .from("produtos")
        .select("id, nome, sku, codigo_interno, codigo_externo, unidade_estocagem")
        .in("id", selectedProductIds);

      const productById = new Map((selectedProducts ?? []).map((produto) => [produto.id, produto]));
      const itemRows = selectedProductIds.flatMap((productId, index) => {
        const produto = productById.get(productId);
        const quantidade = Number.isFinite(selectedProductQuantities[index]) && selectedProductQuantities[index] > 0
          ? selectedProductQuantities[index]
          : 1;

        return produto
          ? [{
              pedido_expedicao_id: createdOrder.id,
              depositante_id: depositanteId,
              produto_id: produto.id,
              codigo_produto: produto.codigo_externo || produto.codigo_interno || null,
              sku: produto.sku || null,
              nome: produto.nome,
              unidade: produto.unidade_estocagem || "UNIDADE",
              quantidade,
              payload_origem: { manual: true },
            }]
          : [];
      });

      if (itemRows.length > 0) {
        const { error: itemError } = await adminSupabase.from("pedidos_expedicao_itens").insert(itemRows);
        if (itemError) {
          await adminSupabase.from("pedidos_expedicao").delete().eq("id", createdOrder.id);
          fail("erro", itemError.message || "O pedido foi criado, mas n\u00e3o foi poss\u00edvel gravar os itens.");
        }
      }
    }

    const parsedLabelFile = readOptionalUpload(labelFile);

    await storeOperationalDocumentFromBuffer({
      adminSupabase,
      depositanteId,
      tipo: "NF",
      fileName: parsedXmlFile.name,
      mimeType: parsedXmlFile.type || "application/xml",
      bytes: xmlBytes,
      pedidoExpedicaoId: createdOrder.id,
      enviadoPor: user.id,
    });

    if (parsedLabelFile) {
      await storeOperationalDocumentFromBuffer({
        adminSupabase,
        depositanteId,
        tipo: "ETIQUETA",
        fileName: parsedLabelFile.name,
        mimeType: parsedLabelFile.type,
        bytes: Buffer.from(await parsedLabelFile.arrayBuffer()),
        pedidoExpedicaoId: createdOrder.id,
        enviadoPor: user.id,
      });
    }

    revalidatePath("/expedicao");
    revalidatePath("/portal");
    revalidatePath(`/expedicao/${createdOrder.id}`);
    if (inlineResponse) {
      return { status: "success" } satisfies ManualShippingOrderSubmissionState;
    }
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}feedback=salvo`);
  } catch (error) {
    // O Next.js implementa redirect() lançando um sinal interno; ele não pode
    // ser convertido no feedback de erro do formulário.
    if (isRedirectError(error)) {
      throw error;
    }
    if (error instanceof ManualShippingOrderSubmissionError) {
      return { status: "error", feedback: error.feedback, detail: error.message } satisfies ManualShippingOrderSubmissionState;
    }
    if (inlineResponse) {
      return {
        status: "error",
        feedback: "erro",
        detail: error instanceof Error ? error.message : "N\u00e3o foi poss\u00edvel concluir o envio do pedido.",
      } satisfies ManualShippingOrderSubmissionState;
    }
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}feedback=erro`);
  }
}

export async function createOperationalManualShippingOrderAction(
  _previousState: ManualShippingOrderSubmissionState,
  formData: FormData,
): Promise<ManualShippingOrderSubmissionState> {
  formData.set("inlineResponse", "1");
  const result = await createManualShippingOrderAction(formData);

  return result ?? {
    status: "error",
    feedback: "erro",
    detail: "N\u00e3o foi poss\u00edvel concluir o envio do pedido.",
  };
}

function parseManualInvoiceMetadata(xml: string) {
  try {
    const parsed = parseNfeXml(xml);
    return {
      noteNumber: parsed.noteNumber,
      accessKey: parsed.accessKey,
    };
  } catch (canonicalXmlError) {
    // Alguns clientes exportam o DANFE como XML/HTML de impress\u00e3o. Esse
    // documento n\u00e3o possui `infNFe`, mas ainda traz a NF e pode ser usado
    // no cadastro manual, que j\u00e1 recebe os itens pelo formul\u00e1rio.
    const documentText = xml
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
    const invoiceMatch = documentText.match(/(?:\bNF-?e\b|\bN[º°o]\s*|N[ÚU]MERO\s+(?:DA\s+)?NF-?e?)\s*[:#]?\s*(\d{3,})/i);
    const accessKeyMatch = documentText.match(/CHAVE\s+DE\s+ACESSO\s*:?\s*([0-9\s.-]{40,70})/i);
    const noteNumber = invoiceMatch?.[1]?.trim() ?? "";
    const accessKey = accessKeyMatch?.[1]?.replace(/\D/g, "") || null;
    const looksLikeInvoice = /DANFE|NOTA\s+FISCAL|NF-?e/i.test(documentText);

    if (looksLikeInvoice && noteNumber) {
      return { noteNumber, accessKey };
    }

    throw canonicalXmlError;
  }
}

class XmlShippingOrderSubmissionError extends Error {
  constructor(
    public readonly feedback: string,
    detail?: string,
  ) {
    super(detail ?? feedback);
  }
}

function getXmlImportFeedbackDetail(feedback: string) {
  const details: Record<string, string> = {
    "nf-obrigatoria": "Anexe o XML da NF-e para criar o pedido.",
    "nf-invalida": "O arquivo selecionado não contém uma NF-e válida.",
    "xml-entrada": "Envie uma NF-e de saída para criar um pedido de expedição.",
    "nf-duplicada": "Já existe um pedido com este número de nota fiscal para este depositante.",
    "xml-produtos-nao-mapeados": "Há item(ns) da NF-e sem produto correspondente no catálogo do depositante.",
    erro: "Não foi possível importar o pedido. Revise os dados e tente novamente.",
  };

  return details[feedback] ?? details.erro;
}

export async function createXmlShippingOrderAction(
  _previousState: ManualShippingOrderSubmissionState,
  formData: FormData,
): Promise<ManualShippingOrderSubmissionState> {
  try {
    return await createXmlShippingOrderSubmission(formData);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof XmlShippingOrderSubmissionError) {
      return { status: "error", feedback: error.feedback, detail: error.message };
    }

    return {
      status: "error",
      feedback: "erro",
      detail: error instanceof Error && error.message ? error.message : getXmlImportFeedbackDetail("erro"),
    };
  }
}

async function createXmlShippingOrderSubmission(formData: FormData): Promise<ManualShippingOrderSubmissionState> {
  const user = await requireRoleAccess(["DEPOSITANTE"]);
  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const salesChannelCode = String(formData.get("salesChannelCode") ?? "VENDA_DIRETA").trim() as SalesChannelCode;
  const customStoreName = String(formData.get("customStoreName") ?? "").trim();
  const carrierName = String(formData.get("carrierName") ?? "").trim();
  const shippingService = String(formData.get("shippingService") ?? "").trim();
  const labelFile = formData.get("shippingLabel");
  const xmlFile = formData.get("invoiceXml");

  const fail = (feedback: string, detail = getXmlImportFeedbackDetail(feedback)): never => {
    throw new XmlShippingOrderSubmissionError(feedback, detail);
  };

  if (!depositanteId || !salesChannelCode) fail("erro");
  if (user.papel === "DEPOSITANTE" && user.depositanteId !== depositanteId) fail("erro");

  const parsedXmlFile = (() => {
    try {
      return readRequiredInvoiceUpload(xmlFile);
    } catch {
      fail("nf-obrigatoria");
      throw new Error("nf-obrigatoria");
    }
  })();

  const xmlBytes = Buffer.from(await parsedXmlFile.arrayBuffer());
  const xmlText = decodeXmlBuffer(xmlBytes.buffer.slice(xmlBytes.byteOffset, xmlBytes.byteOffset + xmlBytes.byteLength));
  const parsedNfe = (() => {
    try {
      return parseNfeXml(xmlText);
    } catch {
      fail("nf-invalida");
      throw new Error("nf-invalida");
    }
  })();

  if (parsedNfe.direction !== "SAIDA") fail("xml-entrada");
  const invoiceNumber = parsedNfe.noteNumber.trim();
  if (!invoiceNumber || invoiceNumber === "Sem numero") fail("nf-invalida");

  const adminSupabase = createSupabaseAdminClient();
  const { data: existingOrders, error: existingOrdersError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, payload_origem")
    .eq("depositante_id", depositanteId)
    .limit(5000);

  if (existingOrdersError) fail("erro");
  const duplicateOrder = (existingOrders ?? []).find((order) => {
    const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
    const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : {};
    return normalizeInvoiceNumber(notaFiscal.numero) === normalizeInvoiceNumber(invoiceNumber);
  });
  if (duplicateOrder) fail("nf-duplicada");

  const { data: catalog, error: catalogError } = await adminSupabase
    .from("produtos")
    .select("id, nome, sku, codigo_interno, codigo_externo, unidade_estocagem")
    .eq("depositante_id", depositanteId)
    .eq("ativo", true);

  if (catalogError) fail("erro");
  const matchedProducts = matchNfeProductsToCatalog(
    parsedNfe.items,
    (catalog ?? []).map((product) => ({
      id: product.id,
      nome: product.nome,
      sku: product.sku || "",
      codigo_interno: product.codigo_interno || "",
      codigo_externo: product.codigo_externo,
    })),
  );

  if (matchedProducts.unmatched.length > 0 || matchedProducts.matched.length !== parsedNfe.items.length) {
    fail("xml-produtos-nao-mapeados");
  }

  const channelLabel = getSalesChannelLabel(salesChannelCode) ?? "Venda direta";
  const totalUnits = matchedProducts.matched.reduce((sum, item) => sum + item.quantidade, 0);
  const cityUf = parsedNfe.recipientAddress?.split(" | ")[2] ?? null;
  const [clienteCidade, clienteUf] = cityUf?.split(" - ").map((value) => value.trim()) ?? [null, null];
  const payloadOrigem = {
    manual: true,
    importadoPorXml: true,
    criadoPor: { userId: user.id, nome: user.nome, papel: user.papel, em: new Date().toISOString() },
    comercial: buildManualCommercialPayload({ salesChannelCode, customStoreName }),
    destinatario: {
      documento: parsedNfe.recipientDocument,
      endereco: parsedNfe.recipientAddress,
      numero: null,
      telefone: null,
    },
    notaFiscal: {
      numero: invoiceNumber,
      chave: parsedNfe.accessKey,
      protocolo: parsedNfe.protocolNumber,
      status: parsedNfe.protocolStatusLabel,
    },
    transporte: {
      contato: { nome: carrierName || parsedNfe.carrierName || null },
      volumes: [{ quantidade: parsedNfe.volumeCount || 1, servico: shippingService || carrierName || parsedNfe.carrierName || null }],
    },
    xml: {
      emitente: parsedNfe.supplierName,
      documentoEmitente: parsedNfe.supplierDocument,
      emitidoEm: parsedNfe.issuedAt,
      pesoBruto: parsedNfe.grossWeight,
      informacoesAdicionais: parsedNfe.additionalInfo,
    },
  };

  const headerPayload = {
    depositante_id: depositanteId,
    codigo: buildManualShippingOrderCode(),
    referencia_externa: `XML-${parsedNfe.accessKey || randomUUID()}`,
    origem: "MANUAL",
    canal: channelLabel,
    status: "NOVO",
    status_origem: "MANUAL",
    numero_pedido: invoiceNumber,
    numero_loja: parsedNfe.accessKey,
    cliente_nome: parsedNfe.recipientName,
    cliente_documento: parsedNfe.recipientDocument,
    cliente_cidade: clienteCidade,
    cliente_uf: clienteUf,
    valor_total: parsedNfe.totalValue,
    quantidade_itens: parsedNfe.items.length,
    quantidade_unidades: totalUnits,
    data_pedido: parsedNfe.issuedAt || new Date().toISOString(),
    sincronizado_em: new Date().toISOString(),
    payload_origem: payloadOrigem,
    observacoes: parsedNfe.additionalInfo,
  };

  const { data: createdOrder, error } = await adminSupabase
    .from("pedidos_expedicao")
    .insert(headerPayload)
    .select("id, numero_wms")
    .single();
  const createdOrderId = createdOrder?.id;
  if (error || !createdOrderId) fail("erro", error?.message || getXmlImportFeedbackDetail("erro"));

  const catalogById = new Map((catalog ?? []).map((product) => [product.id, product]));
  const itemRows = matchedProducts.matched.map((item) => {
    const product = catalogById.get(item.productId);
    return {
      pedido_expedicao_id: createdOrderId,
      depositante_id: depositanteId,
      produto_id: item.productId,
      codigo_produto: product?.codigo_externo || product?.codigo_interno || item.origemCodigo || item.origemEan,
      sku: product?.sku || item.sku || null,
      nome: product?.nome || item.nome,
      unidade: product?.unidade_estocagem || "UNIDADE",
      quantidade: item.quantidade,
      payload_origem: { manual: true, importadoPorXml: true, origemCodigo: item.origemCodigo, origemEan: item.origemEan },
    };
  });
  const { error: itemError } = await adminSupabase.from("pedidos_expedicao_itens").insert(itemRows);
  if (itemError) {
    await adminSupabase.from("pedidos_expedicao").delete().eq("id", createdOrderId);
    fail("erro", itemError.message || getXmlImportFeedbackDetail("erro"));
  }

  await storeOperationalDocumentFromBuffer({
    adminSupabase,
    depositanteId,
    tipo: "NF",
    fileName: parsedXmlFile.name,
    mimeType: parsedXmlFile.type || "application/xml",
    bytes: xmlBytes,
    pedidoExpedicaoId: createdOrderId,
    enviadoPor: user.id,
  });

  const parsedLabelFile = readOptionalUpload(labelFile);
  if (parsedLabelFile) {
    await storeOperationalDocumentFromBuffer({
      adminSupabase,
      depositanteId,
      tipo: "ETIQUETA",
      fileName: parsedLabelFile.name,
      mimeType: parsedLabelFile.type,
      bytes: Buffer.from(await parsedLabelFile.arrayBuffer()),
      pedidoExpedicaoId: createdOrderId,
      enviadoPor: user.id,
    });
  }

  revalidatePath("/expedicao");
  revalidatePath("/portal");
  return {
    status: "success",
    feedback: "salvo",
    detail: `Pedido ${createdOrder?.numero_wms ? `WMS-${String(createdOrder.numero_wms).padStart(6, "0")}` : ""} criado com sucesso.`.trim(),
  };
}

export async function deleteShippingOrderAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/expedicao?feedback=erro");

  const adminSupabase = createSupabaseAdminClient();
  const { data: documents, error: documentsReadError } = await adminSupabase
    .from("documentos_armazenados")
    .select("caminho_storage")
    .eq("pedido_expedicao_id", id);

  if (documentsReadError) redirect("/expedicao?feedback=erro");

  const storagePaths = (documents ?? [])
    .map((document) => document.caminho_storage)
    .filter((path): path is string => Boolean(path));
  if (storagePaths.length > 0) {
    await adminSupabase.storage.from(documentsBucketName).remove(storagePaths);
  }

  const cleanupSteps = [
    adminSupabase.from("romaneios_carga_pedidos").delete().eq("pedido_expedicao_id", id),
    adminSupabase.from("ondas_separacao_pedidos").delete().eq("pedido_expedicao_id", id),
    adminSupabase.from("documentos_armazenados").delete().eq("pedido_expedicao_id", id),
    adminSupabase.from("pedidos_expedicao_itens").delete().eq("pedido_expedicao_id", id),
  ];

  for (const cleanup of cleanupSteps) {
    const { error } = await cleanup;
    if (error) redirect("/expedicao?feedback=erro");
  }

  const { error } = await adminSupabase.from("pedidos_expedicao").delete().eq("id", id);
  if (error) redirect("/expedicao?feedback=erro");

  revalidatePath("/expedicao");
  revalidatePath("/expedicao/conferidos");
  revalidatePath("/romaneio");
  redirect("/expedicao?feedback=excluido");
}

export async function bulkDeleteShippingOrdersAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const rawIds = String(formData.get("ids") ?? "");
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(rawIds);
    ids = Array.isArray(parsed)
      ? [...new Set(parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0))]
      : [];
  } catch {
    ids = [];
  }

  if (!ids.length) redirect("/expedicao?feedback=erro");

  const adminSupabase = createSupabaseAdminClient();
  const { data: documents, error: documentsReadError } = await adminSupabase
    .from("documentos_armazenados")
    .select("caminho_storage")
    .in("pedido_expedicao_id", ids);
  if (documentsReadError) redirect("/expedicao?feedback=erro");

  const storagePaths = (documents ?? [])
    .map((document) => document.caminho_storage)
    .filter((path): path is string => Boolean(path));
  if (storagePaths.length > 0) {
    const { error: storageError } = await adminSupabase.storage.from(documentsBucketName).remove(storagePaths);
    if (storageError) redirect("/expedicao?feedback=erro");
  }

  const cleanupSteps = [
    adminSupabase.from("romaneios_carga_pedidos").delete().in("pedido_expedicao_id", ids),
    adminSupabase.from("ondas_separacao_pedidos").delete().in("pedido_expedicao_id", ids),
    adminSupabase.from("documentos_armazenados").delete().in("pedido_expedicao_id", ids),
    adminSupabase.from("pedidos_expedicao_itens").delete().in("pedido_expedicao_id", ids),
  ];
  for (const cleanup of cleanupSteps) {
    const { error } = await cleanup;
    if (error) redirect("/expedicao?feedback=erro");
  }

  const { error } = await adminSupabase.from("pedidos_expedicao").delete().in("id", ids);
  if (error) redirect("/expedicao?feedback=erro");

  revalidatePath("/expedicao");
  revalidatePath("/expedicao/conferidos");
  revalidatePath("/romaneio");
  redirect("/expedicao?feedback=excluidos");
}

function buildManualShippingOrderCode() {
  return `MAN-${new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14)}`;
}

function readOptionalUpload(value: FormDataEntryValue | null) {
  if (typeof File === "undefined" || !(value instanceof File) || !value.name || value.size <= 0) {
    return null;
  }

  if (value.size > maxDocumentFileSizeBytes) {
    throw new Error("O arquivo excede o limite de 10 MB.");
  }

  if (!allowedDocumentMimeTypes.includes(value.type as (typeof allowedDocumentMimeTypes)[number])) {
    throw new Error("Formato de arquivo não suportado.");
  }

  return value;
}

function readRequiredInvoiceUpload(value: FormDataEntryValue | null) {
  const file = readOptionalUpload(value);
  if (!file || !file.name.toLowerCase().endsWith(".xml")) {
    throw new Error("O XML da NF-e é obrigatório para criar o pedido manual.");
  }
  return file;
}

function normalizeInvoiceNumber(value: unknown) {
  const normalized = String(value ?? "").trim().replace(/\D/g, "").replace(/^0+/, "");
  return normalized || String(value ?? "").trim().toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractShippingSupplies(formData: FormData): ShippingSupplyPayloadItem[] {
  const kinds = formData.getAll("supplyKind[]").map((item) => String(item ?? "").trim().toUpperCase());
  const descriptions = formData.getAll("supplyDescription[]").map((item) => String(item ?? "").trim());
  const quantities = formData.getAll("supplyQuantity[]").map((item) => normalizeDecimalInput(String(item ?? "")));
  const unitCosts = formData.getAll("supplyUnitCost[]").map((item) => normalizeDecimalInput(String(item ?? "")));
  const parsedItems: Array<ShippingSupplyPayloadItem | null> = [];

  for (const [index, kind] of kinds.entries()) {
    const quantity = quantities[index] ?? 0;
    const unitCost = unitCosts[index] ?? 0;
    const description = descriptions[index] ?? "";
    const totalCost = quantity * unitCost;

    if (!kind || quantity <= 0 || unitCost < 0) {
      parsedItems.push(null);
      continue;
    }

    if (!description && unitCost === 0) {
      parsedItems.push(null);
      continue;
    }

    parsedItems.push({
      id: randomUUID(),
      kind,
      label: mapSupplyKindLabel(kind),
      description: description || null,
      quantity,
      unitCost,
      totalCost,
    });
  }

  return parsedItems.filter((item): item is ShippingSupplyPayloadItem => item !== null);
}

function normalizeDecimalInput(value: string) {
  const normalized = Number(value.replace(",", "."));
  return Number.isFinite(normalized) ? normalized : 0;
}

function mapSupplyKindLabel(kind: string) {
  switch (kind) {
    case "CAIXA":
      return "Caixa";
    case "ENVELOPE":
      return "Envelope";
    case "SACO":
      return "Saco";
    case "PLASTICO_BOLHA":
      return "Plástico bolha";
    case "FITA":
      return "Fita";
    default:
      return "Outro";
  }
}

export async function resolveShippingOrderDivergenceAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const adminSupabase = createSupabaseAdminClient();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const resolutionType = String(formData.get("resolutionType") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!orderId) {
    redirect("/expedicao?feedback=erro");
  }

  const { data: order, error } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, status, payload_origem, itens:pedidos_expedicao_itens(id, quantidade, quantidade_separada, payload_origem)")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    redirect(`/expedicao/${orderId}?feedback=erro`);
  }

  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const currentHistory = Array.isArray(payload.historicoDivergencias) ? payload.historicoDivergencias : [];
  const now = new Date().toISOString();

  const treatmentRecord = {
    tratadoEm: now,
    tratadoPorNome: user.nome || "Operador",
    tratadoPorId: user.id,
    acao: resolutionType,
    observacao: notes || null,
    divergenciaAnterior: payload.divergencia || payload.conferencia || null,
    statusAnterior: order.status,
  };

  const updatedHistory = [...currentHistory, treatmentRecord];

  if (resolutionType === "PROSSEGUIR_COM_DIVERGENCIA") {
    const existingConferencia = isRecord(payload.conferencia) ? payload.conferencia : {};
    const updatedPayload = {
      ...payload,
      conferencia: {
        ...existingConferencia,
        conferidoEm: existingConferencia.conferidoEm || now,
        liberadoParaRomaneioEm: now,
        divergenciaAutorizada: true,
        autorizadaPorNome: user.nome || "Operador",
        autorizadaEm: now,
      },
      divergencia: null,
      divergenciaTratada: true,
      divergenciaAutorizada: true,
      tratamentoDivergencia: treatmentRecord,
      historicoDivergencias: updatedHistory,
    };

    await adminSupabase
      .from("pedidos_expedicao")
      .update({
        status: "PRONTO_ROMANEIO",
        payload_origem: updatedPayload,
      })
      .eq("id", orderId);

    revalidatePath("/expedicao");
    revalidatePath("/expedicao/conferidos");
    revalidatePath("/romaneio");
    revalidatePath("/m/romaneio");
    revalidatePath(`/expedicao/${orderId}`);

    redirect("/expedicao?feedback=divergencia-prosseguida");
  }

  if (resolutionType === "CANCELAR_DEFINITIVO") {
    const updatedPayload = {
      ...payload,
      divergenciaTratada: true,
      canceladoDefinitivo: true,
      tratamentoDivergencia: treatmentRecord,
      historicoDivergencias: updatedHistory,
    };

    await adminSupabase
      .from("pedidos_expedicao")
      .update({
        status: "CANCELADO",
        payload_origem: updatedPayload,
      })
      .eq("id", orderId);

    revalidatePath("/expedicao");
    revalidatePath(`/expedicao/${orderId}`);

    redirect("/expedicao?feedback=divergencia-cancelada");
  }

  redirect(`/expedicao/${orderId}?feedback=opcao-invalida`);
}

