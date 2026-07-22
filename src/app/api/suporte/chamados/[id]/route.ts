import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = body?.status;
  if (status !== "Aberto" && status !== "Em análise" && status !== "Resolvido") {
    return NextResponse.json({ error: "Status de chamado inválido." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("suporte_chamados").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
