import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SupportTicket = {
  id: string;
  databaseId: string;
  title: string;
  category: string;
  meta: string;
  status: string;
  prioridade: string;
  createdAt: string;
  autor?: string | null;
  tone: "green" | "blue" | "amber";
  comments: Array<{
    id: string;
    text: string;
    author?: string;
    role?: string | null;
    createdAt?: string;
    anexos?: Array<{ url: string; nome: string; tipo: string }>;
  }>;
  depositante?: string | null;
};

export async function listSupportTicketsFromDb(depositanteId?: string | null): Promise<SupportTicket[]> {
  const supabase = createSupabaseAdminClient();
  const build = (cols: string) => {
    let q = supabase.from("suporte_chamados").select(cols).order("created_at", { ascending: false });
    if (depositanteId) q = q.eq("depositante_id", depositanteId);
    return q;
  };
  // Fallback se "prioridade" ainda não existir (migração não rodada, erro 42703).
  const primary = await build("id, numero, assunto, categoria, status, prioridade, created_at, depositante_id, criado_por");
  const fallback = primary.error && (primary.error as { code?: string }).code === "42703"
    ? await build("id, numero, assunto, categoria, status, created_at, depositante_id, criado_por")
    : null;
  const tickets = (fallback?.data ?? primary.data) as any[] | null;
  const error = fallback?.error ?? primary.error;
  if (error || !tickets?.length) return [];

  const ticketIds = tickets.map((ticket) => ticket.id);
  const depositanteIds = [...new Set(tickets.map((ticket) => ticket.depositante_id))];
  const commentSelect = (cols: string) =>
    supabase.from("suporte_comentarios").select(cols).in("chamado_id", ticketIds).order("created_at", { ascending: true });
  const [commentPrimary, { data: depositantes }] = await Promise.all([
    commentSelect("id, chamado_id, texto, created_at, autor_id, anexos"),
    supabase.from("depositantes").select("id, nome").in("id", depositanteIds),
  ]);
  const commentFallback = commentPrimary.error && (commentPrimary.error as { code?: string }).code === "42703"
    ? await commentSelect("id, chamado_id, texto, created_at, autor_id")
    : null;
  const comments = (commentFallback?.data ?? commentPrimary.data) as any[] | null;
  const authorIds = [
    ...new Set([
      ...(comments ?? []).map((comment) => comment.autor_id),
      ...tickets.map((ticket) => ticket.criado_por),
    ]),
  ];
  const { data: authors } = authorIds.length ? await supabase.from("usuarios").select("id, nome, papel").in("id", authorIds) : { data: [] };
  const commentsByTicket = new Map<string, any[]>();
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
      prioridade: ticket.prioridade ?? "Normal",
      createdAt: ticket.created_at,
      autor: authorMap.get(ticket.criado_por)?.nome ?? null,
      tone,
      depositante: depositanteNames.get(ticket.depositante_id) ?? null,
      comments: ticketComments.map((comment) => {
        const author = authorMap.get(comment.autor_id);
        return {
          id: comment.id,
          text: comment.texto,
          author: author?.nome ?? "Usuário",
          role: author?.papel ?? null,
          createdAt: comment.created_at,
          anexos: Array.isArray(comment.anexos) ? comment.anexos : [],
        };
      }),
    };
  });
}

function buildSupportMeta(createdAt: string, count: number) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000));
  const age = hours < 1 ? "agora" : hours < 24 ? `há ${hours} h` : `há ${Math.floor(hours / 24)} dias`;
  return `${age} · ${count} ${count === 1 ? "comentário" : "comentários"}`;
}
