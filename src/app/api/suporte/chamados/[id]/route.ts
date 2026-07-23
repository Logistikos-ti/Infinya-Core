import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedStatuses = ["Aberto", "Em análise", "Resolvido"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = body?.status;
  if (typeof status !== "string" || !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
    return NextResponse.json({ error: "Status de chamado inválido." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("suporte_chamados").update({ status }).eq("id", id).select("id, status, updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, ticket: data });
}
