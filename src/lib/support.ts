import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SupportTicket = {
  id: string;
  databaseId: string;
  title: string;
  category: string;
  meta: string;
  status: string;
  tone: "green" | "blue" | "amber";
  comments: Array<{ id: string; text: string; author?: string; role?: string | null; createdAt?: string }>;
  depositante?: string | null;
};

export async function listSupportTicketsFromDb(depositanteId?: string | null): Promise<SupportTicket[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("suporte_chamados").select("id, numero, assunto, categoria, status, created_at, depositante_id").order("created_at", { ascending: false });
  if (depositanteId) query = query.eq("depositante_id", depositanteId);
  const { data: tickets, error } = await query;
  if (error || !tickets?.length) return [];

  const ticketIds = tickets.map((ticket) => ticket.id);
  const depositanteIds = [...new Set(tickets.map((ticket) => ticket.depositante_id))];
  const [{ data: comments }, { data: depositantes }] = await Promise.all([
    supabase.from("suporte_comentarios").select("id, chamado_id, texto, created_at, autor_id").in("chamado_id", ticketIds).order("created_at", { ascending: true }),
    supabase.from("depositantes").select("id, nome").in("id", depositanteIds),
  ]);
  const authorIds = [...new Set((comments ?? []).map((comment) => comment.autor_id))];
  const { data: authors } = authorIds.length ? await supabase.from("usuarios").select("id, nome, papel").in("id", authorIds) : { data: [] };
  const commentsByTicket = new Map<string, typeof comments>();
  for (const comment of comments ?? []) commentsByTicket.set(comment.chamado_id, [...(commentsByTicket.get(comment.chamado_id) ?? []), comment]);
  const depositanteNames = new Map((depositantes ?? []).map((depositante) => [depositante.id, depositante.nome]));
  const authorMap = new Map((authors ?? []).map((author) => [author.id, author]));

  return tickets.map((ticket) => {
    const ticketComments = commentsByTicket.get(ticket.id) ?? [];
    const tone = ticket.status === "Resolvido" ? "green" : ticket.status === "Em análise" ? "blue" : "amber";
    return {
      id: `#CH-${ticket.numero}`,
      databaseId: ticket.id,
      title: ticket.assunto,
      category: ticket.categoria,
      meta: buildSupportMeta(ticket.created_at, ticketComments.length),
      status: ticket.status,
      tone,
      depositante: depositanteNames.get(ticket.depositante_id) ?? null,
      comments: ticketComments.map((comment) => {
        const author = authorMap.get(comment.autor_id);
        return { id: comment.id, text: comment.texto, author: author?.nome ?? "Usuário", role: author?.papel ?? null, createdAt: comment.created_at };
      }),
    };
  });
}

function buildSupportMeta(createdAt: string, count: number) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000));
  const age = hours < 1 ? "agora" : hours < 24 ? `há ${hours} h` : `há ${Math.floor(hours / 24)} dias`;
  return `${age} · ${count} ${count === 1 ? "comentário" : "comentários"}`;
}
