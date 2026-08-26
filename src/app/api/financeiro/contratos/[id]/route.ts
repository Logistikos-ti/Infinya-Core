import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("contratos_cobranca")
    .select("*, depositantes(id, nome, cnpj)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ contrato: data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const allowedFields = [
    "taxa_fulfillment", "minimo_fulfillment", "tarifa_posicao",
    "valor_ponto_coleta", "marketplaces_ponto_coleta", "valor_impressao_nf",
    "taxa_frete_fixa", "taxa_frete_percentual", "tarifa_recebimento",
    "valor_software", "qtd_refrigeradores", "valor_unitario_refrigerador",
    "tipo_contrato", "vigencia_inicio", "vigencia_fim", "observacoes", "ativo",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const { data, error } = await admin
    .from("contratos_cobranca")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contrato: data });
}
