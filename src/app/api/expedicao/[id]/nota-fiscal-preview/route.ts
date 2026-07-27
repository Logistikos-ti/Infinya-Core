import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import {
  downloadBlingInvoicePdf,
  ensureValidBlingAccessToken,
  fetchBlingInvoice,
} from "@/lib/bling";
import {
  parseDepositanteConfiguracoes,
  type DepositanteBlingConfig,
  updateDepositanteBlingConfig,
} from "@/lib/depositantes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildSimplifiedDanfePdfFromXml } from "@/lib/shipping-danfe";
import { extractCarrierName } from "@/lib/shipping";
import { documentsBucketName } from "@/lib/storage";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const auth = await requireApiModuleAccess("expedicao");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const adminSupabase = createSupabaseAdminClient();

  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_pedido, numero_loja, origem, depositante_id, payload_origem")
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

  const disposition =
    new URL(_request.url).searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

  // Pedidos manuais usam o XML armazenado no próprio pedido, sem depender do Bling.
  if (order.origem !== "BLING") {
    const { data: xmlDocument, error: xmlError } = await adminSupabase
      .from("documentos_armazenados")
      .select("nome_arquivo, caminho_storage, mime_type")
      .eq("pedido_expedicao_id", id)
      .eq("tipo", "NF")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (xmlError) {
      return NextResponse.json({ error: `Não foi possível localizar o XML anexado: ${xmlError.message}` }, { status: 500 });
    }
    if (!xmlDocument) {
      return NextResponse.json({ error: "Este pedido manual ainda não possui XML da nota fiscal anexado." }, { status: 409 });
    }

    const downloadResult = await adminSupabase.storage
      .from(documentsBucketName)
      .download(xmlDocument.caminho_storage);

    if (downloadResult.error || !downloadResult.data) {
      return NextResponse.json({ error: "Não foi possível carregar o XML anexado da nota fiscal." }, { status: 500 });
    }

    let xmlBytes = Buffer.from(await downloadResult.data.arrayBuffer());
    if ((xmlDocument.mime_type || "").includes("xml") && isGzipBuffer(xmlBytes)) {
      xmlBytes = gunzipSync(xmlBytes);
    }

    try {
      const source = xmlBytes.toString("utf-8");

      // Alguns clientes exportam a DANFE do SmartGo como HTML salvo com
      // extensÃ£o .xml. Nesse caso, o navegador deve renderizar o documento
      // original, em vez de tentar interpretÃ¡-lo como NF-e fiscal padrÃ£o.
      if (isHtmlDocument(source)) {
        const html = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
        return new NextResponse(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `${disposition}; filename="nota-fiscal-${order.numero_pedido ?? order.codigo}.html"`,
            "Cache-Control": "no-store",
          },
        });
      }

      const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
      const pdfBytes = buildSimplifiedDanfePdfFromXml(source, {
        carrierName: extractCarrierName(payload),
      });

      return new NextResponse(new Uint8Array(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(pdfBytes.byteLength),
          "Content-Disposition": `${disposition}; filename="nota-fiscal-${order.numero_pedido ?? order.codigo}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Não foi possível converter o XML anexado em PDF." },
        { status: 422 },
      );
    }
  }

  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const notaFiscal = isRecord(payload.notaFiscal) ? payload.notaFiscal : null;
  const invoiceId = readString(notaFiscal?.id);

  if (!invoiceId || invoiceId === "0") {
    return NextResponse.json(
      { error: "O pedido ainda não possui nota fiscal emitida no Bling." },
      { status: 409 },
    );
  }

  const { data: depositante, error: depositanteError } = await adminSupabase
    .from("depositantes")
    .select("nome, configuracoes, observacoes")
    .eq("id", order.depositante_id)
    .maybeSingle();

  if (depositanteError || !depositante) {
    return NextResponse.json(
      {
        error: `Não foi possível carregar a configuração do depositante: ${
          depositanteError?.message ?? "não encontrado"
        }`,
      },
      { status: 500 },
    );
  }

  const rawConfig = depositante.configuracoes
    ? JSON.stringify(depositante.configuracoes)
    : depositante.observacoes;
  const config = parseDepositanteConfiguracoes(rawConfig);

  if (!config.bling?.connected) {
    return NextResponse.json(
      { error: "O depositante não possui integração Bling ativa." },
      { status: 409 },
    );
  }

  try {
    const tokenResult = await ensureValidBlingAccessToken(config.bling);

    if (tokenResult.tokens) {
      const nextBlingConfig = mergeBlingTokensIntoConfig(config.bling, tokenResult.tokens);

      await adminSupabase
        .from("depositantes")
        .update({
          configuracoes: updateDepositanteBlingConfig(rawConfig, nextBlingConfig),
        })
        .eq("id", order.depositante_id);
    }

    const invoice = await fetchBlingInvoice(tokenResult.accessToken, invoiceId);

    if (!invoice.chaveAcesso) {
      return NextResponse.json(
        { error: "A nota fiscal ainda está sem chave de acesso liberada no Bling." },
        { status: 409 },
      );
    }

    const orderRef = order.numero_loja ?? order.numero_pedido ?? order.codigo;
    const pdfDocument = await downloadBlingInvoicePdf(tokenResult.accessToken, {
      accessKey: invoice.chaveAcesso,
      fileName: `danfe-${orderRef}-${invoice.numero ?? invoice.id}.pdf`,
    });

    return new NextResponse(new Uint8Array(pdfDocument.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfDocument.bytes.byteLength),
        "Content-Disposition": `inline; filename="${encodeURIComponent(pdfDocument.fileName)}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar a pré-visualização da nota fiscal.";

    if (message.includes("invalid_grant")) {
      return NextResponse.json(
        {
          error:
            "A conexão do Bling expirou ou foi revogada. Reconecte a integração do depositante para voltar a visualizar a NF.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mergeBlingTokensIntoConfig(
  config: DepositanteBlingConfig,
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  },
): DepositanteBlingConfig {
  return {
    ...config,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type || config.tokenType,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scopes: tokens.scope
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
    lastSyncAt: new Date().toISOString(),
  };
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

function isGzipBuffer(value: Buffer) {
  return value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;
}

function isHtmlDocument(value: string) {
  return /<!doctype\s+html|<html[\s>]/i.test(value);
}
