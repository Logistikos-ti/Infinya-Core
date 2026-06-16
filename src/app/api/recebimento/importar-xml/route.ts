import { NextResponse } from "next/server";
import {
  ensureUserCanAccessDepositante,
  requireApiModuleAccess,
} from "@/lib/api-auth";
import {
  matchNfeProductsToCatalog,
  parseNfeXml,
} from "@/lib/nfe-import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  allowedDocumentMimeTypes,
  documentsBucketName,
  maxDocumentFileSizeBytes,
  sanitizeFileName,
} from "@/lib/storage";

const allowedXmlMimeTypes = new Set(["application/xml", "text/xml"]);

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("recebimento");

  if (auth.response) {
    return auth.response;
  }

  const formData = await request.formData();
  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const file = formData.get("arquivo");

  if (!depositanteId) {
    return NextResponse.json(
      { error: "Selecione o depositante para importar a NF-e." },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Selecione um arquivo XML de NF-e." },
      { status: 400 },
    );
  }

  if (!file.name || !file.name.toLowerCase().endsWith(".xml")) {
    return NextResponse.json(
      { error: "Envie um arquivo .xml válido da NF-e." },
      { status: 400 },
    );
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "O XML enviado está vazio." }, { status: 400 });
  }

  if (file.size > maxDocumentFileSizeBytes) {
    return NextResponse.json({ error: "O arquivo excede o limite de 10 MB." }, { status: 400 });
  }

  if (
    file.type &&
    !allowedXmlMimeTypes.has(file.type) &&
    !allowedDocumentMimeTypes.includes(file.type as (typeof allowedDocumentMimeTypes)[number])
  ) {
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
  let parsedXml;

  try {
    parsedXml = parseNfeXml(xmlText);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível interpretar o XML da NF-e.",
      },
      { status: 400 },
    );
  }

  const adminSupabase = createSupabaseAdminClient();

  const [{ data: depositante }, { data: products }] = await Promise.all([
    adminSupabase.from("depositantes").select("id, codigo, nome").eq("id", depositanteId).maybeSingle(),
    adminSupabase
      .from("produtos")
      .select("id, nome, sku, codigo_interno, codigo_externo")
      .eq("depositante_id", depositanteId)
      .eq("ativo", true),
  ]);

  if (!depositante) {
    return NextResponse.json({ error: "Depositante não encontrado." }, { status: 404 });
  }

  const matching = matchNfeProductsToCatalog(parsedXml.items, products ?? []);

  if (matching.unmatched.length) {
    return NextResponse.json(
      {
        error:
          "Não foi possível vincular todos os itens do XML aos produtos cadastrados deste depositante.",
        unmatchedItems: matching.unmatched.map((item) => ({
          descricao: item.descricao,
          codigo: item.codigo,
          ean: item.ean,
          quantidade: item.quantidade,
        })),
      },
      { status: 400 },
    );
  }

  const groupedItems = new Map<
    string,
    { productId: string; quantidade: number; sku: string; nome: string }
  >();

  for (const item of matching.matched) {
    const existing = groupedItems.get(item.productId);

    if (existing) {
      existing.quantidade += item.quantidade;
      continue;
    }

    groupedItems.set(item.productId, {
      productId: item.productId,
      quantidade: item.quantidade,
      sku: item.sku,
      nome: item.nome,
    });
  }

  const code = buildReceivingCode(depositante.codigo);
  const previsao = extractForecastDate(parsedXml.issuedAt);
  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_recebimento")
    .insert({
      depositante_id: depositante.id,
      codigo: code,
      referencia_externa: parsedXml.accessKey,
      status: "AGUARDANDO",
      previsto_para: previsao,
      nota_fiscal_numero: parsedXml.noteNumber,
      fornecedor_nome: parsedXml.supplierName,
      fornecedor_documento: parsedXml.supplierDocument,
      observacoes: `Pedido criado por importação de XML da NF-e ${parsedXml.noteNumber}.`,
      criado_por: auth.user.id,
    })
    .select("id, codigo")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      {
        error: `Não foi possível criar o recebimento a partir do XML: ${orderError?.message ?? "erro desconhecido"}`,
      },
      { status: 500 },
    );
  }

  const itemRows = [...groupedItems.values()];
  const { error: itemsError } = await adminSupabase.from("pedidos_recebimento_itens").insert(
    itemRows.map((item) => ({
      pedido_recebimento_id: order.id,
      depositante_id: depositante.id,
      produto_id: item.productId,
      status: "PENDENTE",
      quantidade_prevista: item.quantidade,
      quantidade_recebida: 0,
    })),
  );

  if (itemsError) {
    await adminSupabase.from("pedidos_recebimento").delete().eq("id", order.id);

    return NextResponse.json(
      { error: `Falha ao gravar os itens importados: ${itemsError.message}` },
      { status: 500 },
    );
  }

  await adminSupabase.from("recebimento_tarefas").insert({
    pedido_recebimento_id: order.id,
    depositante_id: depositante.id,
    tipo: "DOCA",
    status: "PENDENTE",
    titulo: `Preparar doca para ${order.codigo}`,
    descricao: `Recebimento importado por XML da NF-e ${parsedXml.noteNumber}.`,
    prioridade: 1,
  });

  const safeName = sanitizeFileName(file.name);
  const storagePath = `${depositanteId}/${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploadResult = await adminSupabase.storage.from(documentsBucketName).upload(storagePath, bytes, {
    contentType: file.type || "application/xml",
    upsert: false,
  });

  if (!uploadResult.error) {
    await adminSupabase.from("documentos_armazenados").insert({
      depositante_id: depositanteId,
      pedido_recebimento_id: order.id,
      tipo: "NF",
      nome_arquivo: file.name,
      caminho_storage: storagePath,
      mime_type: file.type || "application/xml",
      tamanho_bytes: file.size,
      enviado_por: auth.user.id,
    });
  }

  return NextResponse.json(
    {
      message: `Recebimento criado a partir da NF-e ${parsedXml.noteNumber}.`,
      order: {
        id: order.id,
        code: order.codigo,
      },
      summary: {
        fornecedor: parsedXml.supplierName,
        itensImportados: itemRows.length,
        volumes: parsedXml.volumeCount,
        chave: parsedXml.accessKey,
      },
    },
    { status: 201 },
  );
}

function buildReceivingCode(depositanteCodigo: string) {
  const now = new Date();
  const datePart = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = Math.floor(Math.random() * 900 + 100);

  return `REC-${datePart}-${depositanteCodigo.slice(0, 3).toUpperCase()}-${suffix}`;
}

function extractForecastDate(issuedAt: string | null) {
  if (issuedAt && /^\d{4}-\d{2}-\d{2}/.test(issuedAt)) {
    return issuedAt.slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}
