import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { storeOperationalDocumentFromBuffer } from "@/lib/operational-documents";
import { canUploadOperationalDocuments } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowedDocumentMimeTypes, maxDocumentFileSizeBytes, sanitizeFileName } from "@/lib/storage";

const tiposDocumentoPermitidos = new Set([
  "NF",
  "CTE",
  "ROMANEIO",
  "CHECKLIST",
  "FOTO",
  "COMPROVANTE",
  "ETIQUETA",
  "OUTRO",
]);

type ShippingOrderCandidate = {
  id: string;
  codigo: string;
  numero_pedido: string | null;
  numero_loja: string | null;
  payload_origem: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("nfe");

  if (auth.response) {
    return auth.response;
  }

  if (!canUploadOperationalDocuments(auth.user)) {
    return NextResponse.json(
      {
        error: "Seu perfil pode consultar documentos, mas não pode enviar novos arquivos.",
      },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const explicitPedidoExpedicaoId = String(formData.get("pedidoExpedicaoId") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "").trim().toUpperCase();
  const file = formData.get("arquivo");

  if (!depositanteId) {
    return NextResponse.json({ error: "Selecione o depositante do documento." }, { status: 400 });
  }

  if (!tiposDocumentoPermitidos.has(tipo)) {
    return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo para upload." }, { status: 400 });
  }

  if (!file.name) {
    return NextResponse.json({ error: "O arquivo precisa ter um nome válido." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "O arquivo enviado está vazio." }, { status: 400 });
  }

  if (file.size > maxDocumentFileSizeBytes) {
    return NextResponse.json({ error: "O arquivo excede o limite de 10 MB." }, { status: 400 });
  }

  if (!allowedDocumentMimeTypes.includes(file.type as (typeof allowedDocumentMimeTypes)[number])) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie PDF, XML, PNG ou JPG." },
      { status: 400 },
    );
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);

  if (scopeError) {
    return scopeError;
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

  const safeName = sanitizeFileName(file.name);
  const linkedPedidoExpedicaoId =
    explicitPedidoExpedicaoId ??
    (await detectShippingOrderFromFileName(adminSupabase, {
      depositanteId,
      tipo,
      fileName: safeName,
    }));

  if (explicitPedidoExpedicaoId) {
    const validationError = await validateExplicitShippingOrder(
      adminSupabase,
      explicitPedidoExpedicaoId,
      depositanteId,
    );

    if (validationError) {
      return validationError;
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const insertedDocument = await storeOperationalDocumentFromBuffer({
      adminSupabase,
      depositanteId,
      tipo,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      pedidoExpedicaoId: linkedPedidoExpedicaoId,
      enviadoPor: auth.user.id,
    });

    const wasAutoLinked = Boolean(!explicitPedidoExpedicaoId && insertedDocument.pedido_expedicao_id);
    const message = wasAutoLinked
      ? `Upload concluído para ${depositante.nome} e vinculado automaticamente a um pedido de expedição.`
      : `Upload concluído para ${depositante.nome}.`;

    return NextResponse.json({
      message,
      document: insertedDocument,
    });
  } catch (error) {
    const typedError =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string; message?: string })
        : null;

    if (typedError?.code === "42703") {
      return NextResponse.json(
        {
          error:
            "O banco ainda não recebeu a atualização de anexos da expedição. Rode a migration pendente antes de anexar arquivos ao pedido.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: `Falha ao registrar documento no banco: ${
          typedError?.message ?? "erro desconhecido"
        }`,
      },
      { status: 500 },
    );
  }
}

async function validateExplicitShippingOrder(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  pedidoExpedicaoId: string,
  depositanteId: string,
) {
  const { data: pedidoExpedicao, error: pedidoExpedicaoError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, depositante_id")
    .eq("id", pedidoExpedicaoId)
    .maybeSingle();

  if (pedidoExpedicaoError) {
    return NextResponse.json(
      {
        error:
          pedidoExpedicaoError.code === "42703"
            ? "O banco ainda não recebeu a atualização de anexos da expedição. Rode a migration pendente antes de anexar arquivos ao pedido."
            : `Não foi possível validar o pedido de expedição: ${pedidoExpedicaoError.message}`,
      },
      { status: pedidoExpedicaoError.code === "42703" ? 409 : 500 },
    );
  }

  if (!pedidoExpedicao || pedidoExpedicao.depositante_id !== depositanteId) {
    return NextResponse.json(
      { error: "O pedido de expedição informado não pertence a este depositante." },
      { status: 400 },
    );
  }

  return null;
}

async function detectShippingOrderFromFileName(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  {
    depositanteId,
    tipo,
    fileName,
  }: {
    depositanteId: string;
    tipo: string;
    fileName: string;
  },
) {
  if (tipo !== "NF" && tipo !== "ETIQUETA") {
    return null;
  }

  const { data, error } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_pedido, numero_loja, payload_origem")
    .eq("depositante_id", depositanteId)
    .order("data_pedido", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !data?.length) {
    return null;
  }

  const normalizedFileName = normalizeForMatch(fileName);

  for (const order of data as ShippingOrderCandidate[]) {
    const matchTokens = tipo === "NF" ? buildInvoiceMatchTokens(order) : buildLabelMatchTokens(order);

    if (matchTokens.some((token) => normalizedFileName.includes(token))) {
      return order.id;
    }
  }

  return null;
}

function buildInvoiceMatchTokens(order: ShippingOrderCandidate) {
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : null;

  return uniqueMatchTokens([
    order.codigo,
    order.numero_pedido,
    order.numero_loja,
    readString(notaFiscal?.id),
    readString(notaFiscal?.numero),
  ]);
}

function buildLabelMatchTokens(order: ShippingOrderCandidate) {
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const transporte = isRecord(payload.transporte) ? payload.transporte : null;
  const volumes = Array.isArray(transporte?.volumes) ? transporte.volumes : [];

  const trackingCodes = volumes
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => readString(item.codigoRastreamento))
    .filter(Boolean);

  return uniqueMatchTokens([
    order.codigo,
    order.numero_pedido,
    order.numero_loja,
    ...trackingCodes,
  ]);
}

function uniqueMatchTokens(values: Array<string | null | undefined>) {
  return [...new Set(values.map(normalizeForMatch).filter((value) => value.length >= 6))];
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
