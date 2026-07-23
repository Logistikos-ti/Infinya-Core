import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SUPPORT_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRoleAccess(SUPPORT_ROLES);
  if (auth.response) return auth.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("suporte_chamados")
    .select("id, depositante_id")
    .eq("id", id)
    .maybeSingle();
  if (ticketError)
    return NextResponse.json({ error: ticketError.message }, { status: 500 });
  if (!ticket)
    return NextResponse.json(
      { error: "Chamado não encontrado." },
      { status: 404 },
    );
  if (
    auth.user.papel === "DEPOSITANTE" &&
    ticket.depositante_id !== auth.user.depositanteId
  ) {
    return NextResponse.json(
      { error: "Acesso não autorizado." },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("suporte_leituras")
    .upsert(
      {
        usuario_id: auth.user.id,
        chamado_id: id,
        lido_ate: new Date().toISOString(),
      },
      { onConflict: "usuario_id,chamado_id" },
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
