import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedStatuses = ["Aberto", "Em análise", "Resolvido"] as const;
const allowedPrioridades = ["Baixa", "Normal", "Alta", "Crítica"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { status?: unknown; prioridade?: unknown }
    | null;

  const update: { status?: string; prioridade?: string } = {};

  if (body?.status !== undefined) {
    if (typeof body.status !== "string" || !allowedStatuses.includes(body.status as (typeof allowedStatuses)[number])) {
      return NextResponse.json({ error: "Status de chamado inválido." }, { status: 400 });
    }
    update.status = body.status;
  }

  if (body?.prioridade !== undefined) {
    if (typeof body.prioridade !== "string" || !allowedPrioridades.includes(body.prioridade as (typeof allowedPrioridades)[number])) {
      return NextResponse.json({ error: "Prioridade inválida." }, { status: 400 });
    }
    update.prioridade = body.prioridade;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("suporte_chamados")
    .update(update)
    .eq("id", id)
    .select("id, status, prioridade, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, ticket: data });
}
