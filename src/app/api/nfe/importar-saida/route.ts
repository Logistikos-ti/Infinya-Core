import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { parseNfeXml } from "@/lib/nfe-import";
import { storeOperationalDocumentFromBuffer } from "@/lib/operational-documents";
import { canUploadOperationalDocuments } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  allowedDocumentMimeTypes,
  maxDocumentFileSizeBytes,
  sanitizeFileName,
} from "@/lib/storage";

type ShippingOrderCandidate = {
  id: string;
  codigo: string;
  numero_pedido: string | null;
  numero_loja: string | null;
  cliente_nome: string | null;
  cliente_documento: string | null;
  payload_origem: Record<string, unknown> | null;
};

const allowedXmlMimeTypes = new Set(["application/xml", "text/xml"]);
const authorizedSefazStatuses = new Set(["100", "150"]);

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("nfe");

  if (auth.response) {
    return auth.response;
  }

  if (!canUploadOperationalDocuments(auth.user)) {
    return NextResponse.json(
      {
        error: "Seu perfil pode consultar documentos, mas não pode importar NF-e de saída.",
      },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const pedidoBusca = String(formData.get("pedidoBusca") ?? "").trim();
  const file = formData.get("arquivo");

  if (!depositanteId) {
    return NextResponse.json({ error: "Selecione o depositante da NF-e." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo XML para importar." }, { status: 400 });
  }

  if (!file.name || !file.name.toLowerCase().endsWith(".xml")) {
    return NextResponse.json({ error: "Envie um arquivo .xml válido da NF-e." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "O arquivo enviado está vazio." }, { status: 400 });
  }

  if (file.size > maxDocumentFileSizeBytes) {
    return NextResponse.json({ error: "O arquivo excede o limite de 10 MB." }, { status: 400 });
  }

  if (!allowedXmlMimeTypes.has(file.type) && !allowedDocumentMimeTypes.includes(file.type as never)) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie um XML válido de NF-e." },
      { status: 400 },
    );
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);

  if (scopeError) {
    return scopeError;
  }

  const xmlText = await file.text();
  const parsedXml = parseNfeXml(xmlText);

  if (parsedXml.direction !== "SAIDA") {
    return NextResponse.json(
      { error: "Este XML é de entrada. Para saída via SEFAZ, envie uma NF-e com tipo de operação de saída." },
      { status: 400 },
    );
  }

  if (
    parsedXml.protocolStatusCode &&
    !authorizedSefazStatuses.has(parsedXml.protocolStatusCode)
  ) {
    return NextResponse.json(
      {
        error: `A NF-e não está autorizada para importação operacional. Retorno SEFAZ: ${parsedXml.protocolStatusCode} - ${
          parsedXml.protocolStatusLabel ?? "sem descrição"
        }.`,
      },
      { status: 400 },
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositante } = await adminSupabase
    .from("depositantes")
    .select("id, nome")
    .eq("id", depositanteId)
    .maybeSingle();

  if (!depositante) {
    return NextResponse.json({ error: "Depositante não encontrado." }, { status: 404 });
  }

  const shippingOrder = await findShippingOrderForOutgoingNfe(adminSupabase, {
    depositanteId,
    pedidoBusca,
    fileName: sanitizeFileName(file.name),
    parsedXml,
  });

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const insertedDocument = await storeOperationalDocumentFromBuffer({
      adminSupabase,
      depositanteId,
      tipo: "NF",
      fileName: file.name,
      mimeType: file.type || "application/xml",
      bytes,
      pedidoExpedicaoId: shippingOrder?.id ?? null,
      enviadoPor: auth.user.id,
    });

    if (shippingOrder) {
      await updateShippingOrderWithOutgoingNfe(adminSupabase, shippingOrder, parsedXml);
    }

    revalidatePath("/nfe");
    revalidatePath("/expedicao");

    if (shippingOrder?.id) {
      revalidatePath(`/expedicao/${shippingOrder.id}`);
      revalidatePath(`/expedicao/${shippingOrder.id}/editar`);
    }

    const linkedMessage = shippingOrder
      ? `XML da NF-e ${parsedXml.noteNumber} importado e vinculado ao pedido ${shippingOrder.numero_pedido ?? shippingOrder.codigo}.`
      : `XML da NF-e ${parsedXml.noteNumber} importado no storage fiscal. Nenhum pedido foi vinculado automaticamente.`;

    return NextResponse.json({
      message: linkedMessage,
      document: insertedDocument,
      summary: {
        noteNumber: parsedXml.noteNumber,
        accessKey: parsedXml.accessKey,
        recipientName: parsedXml.recipientName,
        totalValue: parsedXml.totalValue.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
        linkedOrderCode: shippingOrder?.codigo ?? null,
      },
      order: shippingOrder ? { id: shippingOrder.id } : null,
    });
  } catch (error) {
    const typedError =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string; message?: string })
        : null;

    return NextResponse.json(
      {
        error: `Falha ao registrar a NF-e de saída: ${typedError?.message ?? "erro desconhecido"}.`,
      },
      { status: 500 },
    );
  }
}

async function findShippingOrderForOutgoingNfe(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  {
    depositanteId,
    pedidoBusca,
    fileName,
    parsedXml,
  }: {
    depositanteId: string;
    pedidoBusca: string;
    fileName: string;
    parsedXml: ReturnType<typeof parseNfeXml>;
  },
) {
  const { data, error } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_pedido, numero_loja, cliente_nome, cliente_documento, payload_origem")
    .eq("depositante_id", depositanteId)
    .order("data_pedido", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(150);

  if (error || !data?.length) {
    return null;
  }

  const orders = data as ShippingOrderCandidate[];
  const normalizedPedidoBusca = normalizeForMatch(pedidoBusca);
  const normalizedRecipientDocument = normalizeForMatch(parsedXml.recipientDocument);
  const normalizedRecipientName = normalizeForMatch(parsedXml.recipientName);
  const normalizedFileName = normalizeForMatch(fileName);

  if (normalizedPedidoBusca) {
    const exactOrder = orders.find((order) =>
      [order.codigo, order.numero_pedido, order.numero_loja]
        .map(normalizeForMatch)
        .filter(Boolean)
        .includes(normalizedPedidoBusca),
    );

    if (exactOrder) {
      return exactOrder;
    }
  }

  const byInvoiceNumber = orders.find((order) => {
    const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
    const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : null;
    const invoiceNumber = normalizeForMatch(readString(notaFiscal?.numero) ?? readString(notaFiscal?.id));
    return invoiceNumber && invoiceNumber === normalizeForMatch(parsedXml.noteNumber);
  });

  if (byInvoiceNumber) {
    return byInvoiceNumber;
  }

  const byRecipient = orders.find((order) => {
    const orderDocument = normalizeForMatch(order.cliente_documento);
    const orderName = normalizeForMatch(order.cliente_nome);

    if (normalizedRecipientDocument && orderDocument && normalizedRecipientDocument === orderDocument) {
      return true;
    }

    return (
      normalizedRecipientName &&
      orderName &&
      (orderName.includes(normalizedRecipientName) || normalizedRecipientName.includes(orderName))
    );
  });

  if (byRecipient) {
    return byRecipient;
  }

  return (
    orders.find((order) =>
      buildMatchTokens(order).some((token) => normalizedFileName.includes(token)),
    ) ?? null
  );
}

async function updateShippingOrderWithOutgoingNfe(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  order: ShippingOrderCandidate,
  parsedXml: ReturnType<typeof parseNfeXml>,
) {
  const currentPayload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const currentInvoice = isRecord(currentPayload.notaFiscal) ? currentPayload.notaFiscal : {};

  const nextPayload = {
    ...currentPayload,
    notaFiscal: {
      ...currentInvoice,
      numero: parsedXml.noteNumber,
      chaveAcesso: parsedXml.accessKey,
      protocolo: parsedXml.protocolNumber,
      statusSefaz: parsedXml.protocolStatusCode,
      mensagemSefaz: parsedXml.protocolStatusLabel,
      origemDocumento: "SEFAZ_XML",
      importadaPorXmlEm: new Date().toISOString(),
    },
  };

  await adminSupabase
    .from("pedidos_expedicao")
    .update({
      cliente_nome: order.cliente_nome?.trim() || parsedXml.recipientName,
      cliente_documento: order.cliente_documento?.trim() || parsedXml.recipientDocument,
      payload_origem: nextPayload,
    })
    .eq("id", order.id);
}

function buildMatchTokens(order: ShippingOrderCandidate) {
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : null;

  return [
    order.codigo,
    order.numero_pedido,
    order.numero_loja,
    readString(notaFiscal?.id),
    readString(notaFiscal?.numero),
  ]
    .map(normalizeForMatch)
    .filter((value) => value.length >= 6);
}

function normalizeForMatch(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
