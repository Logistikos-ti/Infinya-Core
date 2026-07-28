import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { buildSimplifiedDanfePdfFromXml } from "@/lib/shipping-danfe";
import { extractCarrierName } from "@/lib/shipping";
import { documentsBucketName } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiModuleAccess("expedicao");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const adminSupabase = createSupabaseAdminClient();
  const disposition = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";

  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_pedido, depositante_id, origem, cliente_nome, cliente_documento, cliente_cidade, cliente_uf, valor_total, payload_origem")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      { error: `Não foi possível carregar o pedido de expedição: ${orderError.message}` },
      { status: 500 },
    );
  }

  if (!order) {
    return NextResponse.json({ error: "Pedido de expedição não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, order.depositante_id);
  if (scopeError) {
    return scopeError;
  }

  const { data: xmlDocument, error: documentError } = await adminSupabase
    .from("documentos_armazenados")
    .select("id, nome_arquivo, caminho_storage, mime_type")
    .eq("pedido_expedicao_id", id)
    .or("tipo.eq.NF,mime_type.ilike.%xml%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json(
      { error: `Não foi possível localizar o XML da nota fiscal: ${documentError.message}` },
      { status: 500 },
    );
  }

  if (!xmlDocument) {
    return NextResponse.json(
      { error: "Este pedido ainda não possui XML da nota fiscal anexado para gerar a DANFE simplificada." },
      { status: 409 },
    );
  }

  const downloadResult = await adminSupabase.storage
    .from(documentsBucketName)
    .download(xmlDocument.caminho_storage);

  if (downloadResult.error || !downloadResult.data) {
    return NextResponse.json(
      { error: "Não foi possível carregar o XML armazenado da nota fiscal." },
      { status: 500 },
    );
  }

  let xmlBytes = Buffer.from(await downloadResult.data.arrayBuffer());
  if ((xmlDocument.mime_type || "").includes("xml") && isGzipBuffer(xmlBytes)) {
    xmlBytes = gunzipSync(xmlBytes);
  }

  try {
    const carrierName = order.payload_origem && typeof order.payload_origem === "object"
      ? extractCarrierName(order.payload_origem as Record<string, unknown>)
      : null;
    const source = xmlBytes.toString("utf-8");
    let pdfBytes: Buffer;

    try {
      pdfBytes = buildSimplifiedDanfePdfFromXml(source, { carrierName });
    } catch (error) {
      if (order.origem !== "BLING") {
        const { data: items } = await adminSupabase
          .from("pedidos_expedicao_itens")
          .select("codigo_produto, sku, nome, quantidade")
          .eq("pedido_expedicao_id", id)
          .order("created_at", { ascending: true });

        const fallbackXml = buildManualDanfeXml(order, items ?? []);
        pdfBytes = buildSimplifiedDanfePdfFromXml(fallbackXml, { carrierName });
      } else {
        throw error;
      }
    }

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${order.codigo.toLowerCase()}-danfe-simplificada.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar a DANFE simplificada a partir do XML da NF-e.",
      },
      { status: 500 },
    );
  }
}

function buildManualDanfeXml(
  order: {
    numero_pedido: string | null;
    cliente_nome: string | null;
    cliente_documento: string | null;
    cliente_cidade: string | null;
    cliente_uf: string | null;
    valor_total: number | null;
    payload_origem: unknown;
  },
  items: Array<{
    codigo_produto: string | null;
    sku: string | null;
    nome: string;
    quantidade: number;
  }>,
) {
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : {};
  const destinatario = isRecord(payload.destinatario) ? payload.destinatario : {};
  const emitente = isRecord(payload.emitente) ? payload.emitente : {};
  const numero = readPayloadString(notaFiscal.numero) || order.numero_pedido || "SEM NUMERO";
  const nomeDestinatario = order.cliente_nome || "Destinatario nao informado";
  const documentoDestinatario = order.cliente_documento || "";
  const cidade = order.cliente_cidade || "";
  const uf = order.cliente_uf || "";
  const endereco = readPayloadString(destinatario.endereco) || "";
  const numeroEndereco = readPayloadString(destinatario.numero) || "";
  const nomeEmitente = readPayloadString(emitente.nome) || "Pedido manual";
  const documentoEmitente = readPayloadString(emitente.documento) || "";
  const total = Number(order.valor_total ?? 0) || 0;
  const det = items.length
    ? items
        .map(
          (item) => `<prod><cProd>${escapeXml(item.codigo_produto || item.sku || "-")}</cProd><xProd>${escapeXml(item.nome)}</xProd><qCom>${Math.max(1, Number(item.quantidade) || 1)}</qCom><vProd>0</vProd></prod>`,
        )
        .join("")
    : `<det><prod><cProd>-</cProd><xProd>Item manual nao informado</xProd><qCom>1</qCom><vProd>0</vProd></prod></det>`;

  return `<nfeProc><NFe><infNFe><ide><nNF>${escapeXml(numero)}</nNF><tpNF>1</tpNF></ide><emit><xNome>${escapeXml(nomeEmitente)}</xNome><CNPJ>${escapeXml(documentoEmitente)}</CNPJ></emit><dest><xNome>${escapeXml(nomeDestinatario)}</xNome><CPF>${escapeXml(documentoDestinatario)}</CPF><enderDest><xLgr>${escapeXml(endereco)}</xLgr><nro>${escapeXml(numeroEndereco)}</nro><xMun>${escapeXml(cidade)}</xMun><UF>${escapeXml(uf)}</UF></enderDest></dest><det>${det}</det><total><ICMSTot><vNF>${total}</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
}

function readPayloadString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isGzipBuffer(value: Buffer) {
  return value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;
}
