import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import {
  downloadBlingInvoicePdf,
  ensureValidBlingAccessToken,
  fetchBlingInvoice,
} from "@/lib/bling";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  if (order.origem !== "BLING") {
    return NextResponse.json(
      { error: "A pré-visualização em DANFE está disponível apenas para pedidos integrados ao Bling." },
      { status: 409 },
    );
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

    return new NextResponse(pdfDocument.bytes, {
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
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a pré-visualização da nota fiscal.",
      },
      { status: 500 },
    );
  }
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
