import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const admin = createSupabaseAdminClient();

  const { data: fatura, error } = await admin
    .from("faturas")
    .select("*, depositantes(id, nome, cnpj)")
    .eq("id", id)
    .single();

  if (error || !fatura) {
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }

  const { data: lancamentos } = await admin
    .from("lancamentos")
    .select("*")
    .eq("fatura_id", id)
    .eq("estornado", false)
    .order("tipo_servico")
    .order("created_at", { ascending: true });

  return NextResponse.json({ fatura, lancamentos: lancamentos ?? [] });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body?.status) {
    return NextResponse.json({ error: "Status obrigatório." }, { status: 400 });
  }

  const validStatuses = ["ABERTA", "FECHADA", "ENVIADA", "PAGO"];
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const updates: Record<string, unknown> = { status: body.status };
  if (body.status === "FECHADA") updates.fechado_em = new Date().toISOString();
  if (body.status === "ENVIADA") updates.enviado_em = new Date().toISOString();
  if (body.status === "PAGO") updates.pago_em = new Date().toISOString();
  if (body.observacoes !== undefined) updates.observacoes = body.observacoes;

  const { data, error } = await admin
    .from("faturas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ fatura: data });
}
