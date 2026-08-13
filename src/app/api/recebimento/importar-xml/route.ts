import { NextResponse } from "next/server";
import {
  ensureUserCanAccessDepositante,
  requireApiUser,
} from "@/lib/api-auth";
import { getAccessDeniedErrorMessage } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import {
  decodeXmlBuffer,
  matchNfeProductsToCatalog,
  parseNfeXml,
} from "@/lib/nfe-import";
import { generateReceivingCode } from "@/lib/receiving";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  allowedDocumentMimeTypes,
  documentsBucketName,
  maxDocumentFileSizeBytes,
  sanitizeFileName,
} from "@/lib/storage";

const allowedXmlMimeTypes = new Set(["application/xml", "text/xml"]);

export async function POST(request: Request) {
  const auth = await requireApiUser();

  if (auth.response) {
    return auth.response;
  }

  // "recebimento" is an internal CD module that depositantes don't carry, but
  // the portal lets them import their own NF-e XML. The depositante scope
  // check further down keeps that confined to their own records.
  if (!canAccessModule(auth.user, "recebimento") && auth.user.papel !== "DEPOSITANTE") {
    return NextResponse.json(
      { error: getAccessDeniedErrorMessage("recebimento") },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const previstoPara = String(formData.get("previstoPara") ?? "").trim();
  const horarioPrevisto = String(formData.get("horarioPrevisto") ?? "").trim();
  const transportadora = String(formData.get("transportadora") ?? "").trim();
  const observacoesPortal = String(formData.get("observacoes") ?? "").trim();
  const xmlResolutions = parseXmlResolutions(String(formData.get("resolucoesXml") ?? "[]"));
  const xmlItemOverrides = parseXmlItemOverrides(String(formData.get("itensXml") ?? "[]"));
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

  if (previstoPara && !/^\d{4}-\d{2}-\d{2}$/.test(previstoPara)) {
    return NextResponse.json(
      { error: "Informe uma data prevista válida." },
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

  const fileBuffer = await file.arrayBuffer();
  const xmlText = decodeXmlBuffer(fileBuffer);
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
  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const resolvedMatched = [...matching.matched];
  const unresolvedItems: (typeof matching.unmatched)[number][] = [];

  for (const item of matching.unmatched) {
    const productId = xmlResolutions.get(createXmlItemKey(item));
    const product = productId ? productMap.get(productId) : null;

    if (!product) {
      unresolvedItems.push(item);
      continue;
    }

    resolvedMatched.push({
      productId: product.id,
      sku: product.sku,
      nome: product.nome,
      quantidade: item.quantidade,
      origemCodigo: item.codigo,
      origemEan: item.ean,
      lote: item.lote,
      validadeEm: item.validadeEm,
      lotes: item.lotes,
    });
  }

  if (unresolvedItems.length) {
    return NextResponse.json(
      {
        error:
          "Não foi possível vincular todos os itens do XML aos produtos cadastrados deste depositante.",
        unmatchedItems: unresolvedItems.map((item) => ({
          descricao: item.descricao,
          codigo: item.codigo,
          ean: item.ean,
          quantidade: item.quantidade,
        })),
      },
      { status: 400 },
    );
  }
  const finalMatchedItems = applyReceivingItemOverrides(resolvedMatched, xmlItemOverrides);
  const groupedItems = new Map<
    string,
    {
      productId: string;
      quantidade: number;
      sku: string;
      nome: string;
      lote: string | null;
      validadeEm: string | null;
    }
  >();

  for (const item of finalMatchedItems) {
    for (const line of expandMatchedReceivingItem(item)) {
      const key = [line.productId, line.lote ?? "", line.validadeEm ?? ""].join("|");
      const existing = groupedItems.get(key);

      if (existing) {
        existing.quantidade += line.quantidade;
        continue;
      }

      groupedItems.set(key, line);
    }
  }

  const code = await generateReceivingCode(adminSupabase, depositante.nome);
  const previsao = previstoPara || extractForecastDate(parsedXml.issuedAt);
  const observacoes = [
    `Pedido criado por importação de XML da NF-e ${parsedXml.noteNumber}.`,
    transportadora ? `Transportadora: ${transportadora}` : "",
    horarioPrevisto ? `Horário previsto: ${horarioPrevisto}` : "",
    observacoesPortal ? `Observações: ${observacoesPortal}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
      observacoes,
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
      lote: item.lote,
      validade_em: item.validadeEm,
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
  const bytes = Buffer.from(fileBuffer);

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

function expandMatchedReceivingItem(item: {
  productId: string;
  quantidade: number;
  sku: string;
  nome: string;
  lote?: string | null;
  validadeEm?: string | null;
  lotes?: Array<{ lote: string | null; validadeEm: string | null; quantidade: number | null }>;
}) {
  const lotes = item.lotes?.filter((lot) => lot.lote || lot.validadeEm) ?? [];

  if (!lotes.length) {
    return [
      {
        productId: item.productId,
        quantidade: item.quantidade,
        sku: item.sku,
        nome: item.nome,
        lote: item.lote ?? null,
        validadeEm: item.validadeEm ?? null,
      },
    ];
  }

  if (lotes.length === 1) {
    return [
      {
        productId: item.productId,
        quantidade: lotes[0].quantidade && lotes[0].quantidade > 0 ? lotes[0].quantidade : item.quantidade,
        sku: item.sku,
        nome: item.nome,
        lote: lotes[0].lote,
        validadeEm: lotes[0].validadeEm,
      },
    ];
  }

  const totalLotsQuantity = lotes.reduce((sum, lot) => sum + (lot.quantidade ?? 0), 0);
  const lotsWithoutQuantity = lotes.filter((lot) => !lot.quantidade || lot.quantidade <= 0).length;
  const remainingQuantity = Math.max(item.quantidade - totalLotsQuantity, 0);
  const fallbackQuantity = lotsWithoutQuantity > 0 ? remainingQuantity / lotsWithoutQuantity : item.quantidade / lotes.length;

  return lotes.map((lot) => ({
    productId: item.productId,
    quantidade: lot.quantidade && lot.quantidade > 0 ? lot.quantidade : fallbackQuantity,
    sku: item.sku,
    nome: item.nome,
    lote: lot.lote,
    validadeEm: lot.validadeEm,
  }));
}

type XmlItemOverride = {
  produtoId: string;
  quantidade: number | null;
  lote: string | null;
  validadeEm: string | null;
};

function applyReceivingItemOverrides<
  T extends {
    productId: string;
    quantidade: number;
    lote?: string | null;
    validadeEm?: string | null;
    lotes?: Array<{ lote: string | null; validadeEm: string | null; quantidade: number | null }>;
  },
>(items: T[], overrides: XmlItemOverride[]) {
  const pendingOverrides = [...overrides];

  return items.map((item) => {
    const overrideIndex = pendingOverrides.findIndex(
      (override) => override.produtoId === item.productId,
    );

    if (overrideIndex < 0) {
      return item;
    }

    const [override] = pendingOverrides.splice(overrideIndex, 1);
    const hasManualTraceability = Boolean(override.lote || override.validadeEm);

    return {
      ...item,
      quantidade: override.quantidade && override.quantidade > 0 ? override.quantidade : item.quantidade,
      lote: override.lote ?? item.lote ?? null,
      validadeEm: override.validadeEm ?? item.validadeEm ?? null,
      lotes: hasManualTraceability ? [] : item.lotes,
    };
  });
}

function extractForecastDate(issuedAt: string | null) {
  if (issuedAt && /^\d{4}-\d{2}-\d{2}/.test(issuedAt)) {
    return issuedAt.slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function createXmlItemKey(item: {
  codigo: string | null;
  ean: string | null;
  descricao: string;
  lote?: string | null;
  validadeEm?: string | null;
}) {
  return [item.codigo ?? "", item.ean ?? "", item.descricao, item.lote ?? "", item.validadeEm ?? ""]
    .map((value) => value.trim().toLocaleLowerCase("pt-BR"))
    .join("|");
}

function parseXmlResolutions(rawValue: string) {
  const resolutions = new Map<string, string>();

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return resolutions;
    }

    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;

      const key = "key" in item ? String(item.key ?? "").trim() : "";
      const produtoId = "produtoId" in item ? String(item.produtoId ?? "").trim() : "";

      if (key && produtoId) {
        resolutions.set(key, produtoId);
      }
    }
  } catch {
    return resolutions;
  }

  return resolutions;
}

function parseXmlItemOverrides(rawValue: string): XmlItemOverride[] {
  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        const produtoId = "produtoId" in item ? String(item.produtoId ?? "").trim() : "";
        const quantidadeRaw = "quantidade" in item ? Number(item.quantidade) : Number.NaN;
        const lote = "lote" in item ? String(item.lote ?? "").trim() : "";
        const validadeEm = "validadeEm" in item ? String(item.validadeEm ?? "").trim() : "";

        if (!produtoId) {
          return null;
        }

        return {
          produtoId,
          quantidade: Number.isFinite(quantidadeRaw) && quantidadeRaw > 0 ? quantidadeRaw : null,
          lote: lote || null,
          validadeEm: /^\d{4}-\d{2}-\d{2}$/.test(validadeEm) ? validadeEm : null,
        };
      })
      .filter((item): item is XmlItemOverride => Boolean(item));
  } catch {
    return [];
  }
}
