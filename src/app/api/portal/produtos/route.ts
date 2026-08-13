import { NextResponse } from "next/server";
import {
  ensureUserCanAccessDepositante,
  requireApiRoleAccess,
} from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CreatePortalProductPayload = {
  depositanteId?: unknown;
  nome?: unknown;
  sku?: unknown;
  codigoInterno?: unknown;
  codigoExterno?: unknown;
  metodoRetirada?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireApiRoleAccess(["DEPOSITANTE", "ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => ({}))) as CreatePortalProductPayload;
  const depositanteId = String(payload.depositanteId ?? "").trim() || auth.user?.depositanteId || "";
  const nome = String(payload.nome ?? "").trim();
  const codigoExterno = String(payload.codigoExterno ?? "").trim();
  const codigoInterno = String(payload.codigoInterno ?? "").trim() || codigoExterno;
  const sku = String(payload.sku ?? "").trim() || codigoInterno || codigoExterno;
  const metodoRetirada = normalizeWithdrawalMethod(payload.metodoRetirada);
  const requiresTraceability = metodoRetirada === "FEFO";

  if (!depositanteId) {
    return NextResponse.json({ error: "Depositante nao identificado." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) return scopeError;

  if (!nome) {
    return NextResponse.json({ error: "Informe o nome do produto." }, { status: 400 });
  }

  if (!codigoInterno && !sku && !codigoExterno) {
    return NextResponse.json(
      { error: "Informe ao menos SKU, codigo interno ou EAN/GTIN." },
      { status: 400 },
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const duplicateFilters = [
    codigoExterno ? `codigo_externo.eq.${escapeSupabaseFilterValue(codigoExterno)}` : "",
    codigoInterno ? `codigo_interno.eq.${escapeSupabaseFilterValue(codigoInterno)}` : "",
    sku ? `sku.eq.${escapeSupabaseFilterValue(sku)}` : "",
  ].filter(Boolean);

  if (duplicateFilters.length) {
    const { data: existing, error: existingError } = await adminSupabase
      .from("produtos")
      .select("id, nome, sku, codigo_interno, codigo_externo, unidade_estocagem")
      .eq("depositante_id", depositanteId)
      .or(duplicateFilters.join(","))
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: `Nao foi possivel validar duplicidade do produto: ${existingError.message}` },
        { status: 500 },
      );
    }

    if (existing) {
      return NextResponse.json({
        message: "Produto ja existia e foi vinculado ao XML.",
        product: normalizeProduct(existing),
      });
    }
  }

  const { data: product, error: insertError } = await adminSupabase
    .from("produtos")
    .insert({
      depositante_id: depositanteId,
      codigo_interno: codigoInterno || sku,
      codigo_externo: codigoExterno || null,
      sku: sku || codigoInterno || codigoExterno,
      nome,
      descricao: "Criado automaticamente pela importacao de XML de recebimento.",
      categoria: "Sem categoria",
      metodo_retirada: metodoRetirada,
      unidade_estocagem: "UNIDADE",
      exige_lote: requiresTraceability,
      exige_validade: requiresTraceability,
      ativo: true,
    })
    .select("id, nome, sku, codigo_interno, codigo_externo, unidade_estocagem")
    .single();

  if (insertError || !product) {
    return NextResponse.json(
      { error: `Nao foi possivel criar o produto: ${insertError?.message ?? "erro desconhecido"}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      message: "Produto criado e vinculado ao XML.",
      product: normalizeProduct(product),
    },
    { status: 201 },
  );
}

function normalizeProduct(product: {
  id: string;
  nome: string;
  sku: string;
  codigo_interno: string | null;
  codigo_externo: string | null;
  unidade_estocagem: string | null;
}) {
  return {
    id: product.id,
    nome: product.nome,
    sku: product.sku,
    unidade: product.unidade_estocagem ?? "UNIDADE",
    codigoInterno: product.codigo_interno,
    codigoExterno: product.codigo_externo,
  };
}

function escapeSupabaseFilterValue(value: string) {
  return value.replace(/,/g, "\\,").replace(/\)/g, "\\)");
}

function normalizeWithdrawalMethod(value: unknown): "FEFO" | "FIFO" | "LIFO" {
  const method = String(value ?? "FEFO").trim().toUpperCase();

  if (method === "FIFO" || method === "LIFO") {
    return method;
  }

  return "FEFO";
}
