import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SUPPORT_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireApiRoleAccess(SUPPORT_ROLES);
  if (auth.response) return auth.response;

  const supabase = createSupabaseAdminClient();
  let ticketsQuery = supabase
    .from("suporte_chamados")
    .select("id, depositante_id, created_at");
  if (auth.user.papel === "DEPOSITANTE" && auth.user.depositanteId) {
    ticketsQuery = ticketsQuery.eq("depositante_id", auth.user.depositanteId);
  }

  const { data: tickets, error: ticketsError } = await ticketsQuery;
  if (ticketsError)
    return NextResponse.json({ error: ticketsError.message }, { status: 500 });

  const ticketIds = (tickets ?? []).map((ticket) => ticket.id);
  if (!ticketIds.length)
    return NextResponse.json(
      { unreadCount: 0, unreadByTicket: {} },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );

  const [
    { data: comments, error: commentsError },
    { data: reads, error: readsError },
  ] = await Promise.all([
    supabase
      .from("suporte_comentarios")
      .select("chamado_id, autor_id, created_at")
      .in("chamado_id", ticketIds),
    supabase
      .from("suporte_leituras")
      .select("chamado_id, lido_ate")
      .eq("usuario_id", auth.user.id)
      .in("chamado_id", ticketIds),
  ]);

  if (commentsError) {
    return NextResponse.json(
      {
        error:
          commentsError?.message ??
          readsError?.message ??
          "Não foi possível carregar as notificações.",
      },
      { status: 500 },
    );
  }

  const readAtByTicket = new Map(
    (readsError ? [] : (reads ?? [])).map((read) => [
      read.chamado_id,
      new Date(read.lido_ate).getTime(),
    ]),
  );
  const unreadByTicket: Record<string, number> = {};
  for (const ticketId of ticketIds) unreadByTicket[ticketId] = 0;

  (comments ?? [])
    .filter((comment) => {
      if (comment.autor_id === auth.user.id) return false;
      const readAt = readAtByTicket.get(comment.chamado_id);
      return (
        readAt === undefined || new Date(comment.created_at).getTime() > readAt
      );
    })
    .forEach((comment) => {
      unreadByTicket[comment.chamado_id] = 1;
    });

  return NextResponse.json(
    {
      unreadCount: Object.values(unreadByTicket).reduce(
        (sum, count) => sum + count,
        0,
      ),
      unreadByTicket,
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
