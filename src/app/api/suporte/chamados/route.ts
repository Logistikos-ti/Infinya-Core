import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPPORT_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

export async function GET() {
  const auth = await requireApiRoleAccess(SUPPORT_ROLES);
  if (auth.response) return auth.response;

  const supabase = createSupabaseAdminClient();
  const buildTicketsQuery = (cols: string) => {
    let q = supabase.from("suporte_chamados").select(cols).order("created_at", { ascending: false });
    if (auth.user.papel === "DEPOSITANTE" && auth.user.depositanteId)
      q = q.eq("depositante_id", auth.user.depositanteId);
    return q;
  };
  const FULL_COLS =
    "id, numero, assunto, categoria, status, prioridade, created_at, updated_at, depositante_id, criado_por";
  const BASE_COLS =
    "id, numero, assunto, categoria, status, created_at, updated_at, depositante_id, criado_por";
  // Se a coluna "prioridade" ainda não existe no banco (migração não rodada),
  // o erro é de coluna ausente (42703) — refaz sem ela para não sumir com os
  // chamados; o serialize assume "Normal" nesse caso.
  const primary = await buildTicketsQuery(FULL_COLS);
  const fallback = primary.error && (primary.error as { code?: string }).code === "42703"
    ? await buildTicketsQuery(BASE_COLS)
    : null;
  const tickets = (fallback?.data ?? primary.data) as any[] | null;
  const ticketError = fallback?.error ?? primary.error;
  const ticketIds = (tickets ?? []).map((ticket) => ticket.id);
  const commentSelect = (cols: string) => {
    let q = supabase.from("suporte_comentarios").select(cols).order("created_at", { ascending: true });
    if (ticketIds.length) q = q.in("chamado_id", ticketIds);
    return q;
  };
  const [commentPrimary, { data: depositantes, error: depositanteError }] = await Promise.all([
    ticketIds.length
      ? commentSelect("id, chamado_id, texto, created_at, autor_id, anexos")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("depositantes").select("id, nome"),
  ]);
  // Fallback se a coluna "anexos" ainda não existir (42703).
  const commentFallback =
    commentPrimary.error && (commentPrimary.error as { code?: string }).code === "42703"
      ? await commentSelect("id, chamado_id, texto, created_at, autor_id")
      : null;
  const comments = (commentFallback?.data ?? commentPrimary.data) as any[] | null;
  const commentError = commentFallback?.error ?? commentPrimary.error;

  if (ticketError || commentError || depositanteError) {
    return NextResponse.json(
      {
        error:
          ticketError?.message ??
          commentError?.message ??
          depositanteError?.message ??
          "Não foi possível carregar os chamados.",
      },
      { status: 500 },
    );
  }

  const commentsByTicket = new Map<string, any[]>();
  for (const comment of comments ?? []) {
    const list = commentsByTicket.get(comment.chamado_id) ?? [];
    list.push(comment);
    commentsByTicket.set(comment.chamado_id, list);
  }
  // Autores (nome + papel) tanto de quem abriu o chamado quanto de cada
  // comentário — o papel define de que lado a mensagem aparece no drawer.
  const authorIds = [
    ...new Set([
      ...(tickets ?? []).map((ticket) => ticket.criado_por),
      ...(comments ?? []).map((comment) => comment.autor_id),
    ]),
  ].filter(Boolean);
  const { data: authors } = authorIds.length
    ? await supabase.from("usuarios").select("id, nome, papel").in("id", authorIds)
    : { data: [] as Array<{ id: string; nome: string; papel: string }> };
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));
  const depositanteNames = new Map(
    (depositantes ?? []).map((depositante) => [
      depositante.id,
      depositante.nome,
    ]),
  );
  return NextResponse.json(
    {
      tickets: (tickets ?? []).map((ticket) =>
        serializeTicket({
          ...ticket,
          autor: authorMap.get(ticket.criado_por)?.nome ?? null,
          depositante: {
            nome: depositanteNames.get(ticket.depositante_id) ?? null,
          },
          comentarios: (commentsByTicket.get(ticket.id) ?? []).map((comment) => {
            const a = authorMap.get(comment.autor_id);
            return { ...comment, autor: a ? { nome: a.nome, papel: a.papel } : null };
          }),
        }),
      ),
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRoleAccess(SUPPORT_ROLES);
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as {
    subject?: unknown;
    message?: unknown;
    category?: unknown;
    prioridade?: unknown;
  } | null;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const category =
    typeof body?.category === "string" && body.category.trim()
      ? body.category.trim()
      : "Outros";
  const PRIORIDADES = ["Baixa", "Normal", "Alta", "Crítica"];
  const prioridade =
    typeof body?.prioridade === "string" && PRIORIDADES.includes(body.prioridade)
      ? body.prioridade
      : "Normal";

  if (!subject || !message)
    return NextResponse.json(
      { error: "Informe o assunto e a mensagem do chamado." },
      { status: 400 },
    );
  if (!auth.user.depositanteId)
    return NextResponse.json(
      { error: "O chamado precisa estar vinculado a um depositante." },
      { status: 400 },
    );

  const supabase = createSupabaseAdminClient();
  const basePayload = {
    depositante_id: auth.user.depositanteId,
    criado_por: auth.user.id,
    assunto: subject,
    categoria: category,
  };
  const insertFull = await supabase
    .from("suporte_chamados")
    .insert({ ...basePayload, prioridade })
    .select(
      "id, numero, assunto, categoria, status, prioridade, created_at, updated_at, depositante_id, criado_por",
    )
    .single();
  const insertFallback =
    insertFull.error && (insertFull.error as { code?: string }).code === "42703"
      ? await supabase
          .from("suporte_chamados")
          .insert(basePayload)
          .select(
            "id, numero, assunto, categoria, status, created_at, updated_at, depositante_id, criado_por",
          )
          .single()
      : null;
  const ticket = (insertFallback?.data ?? insertFull.data) as any;
  const ticketError = insertFallback?.error ?? insertFull.error;
  if (ticketError || !ticket)
    return NextResponse.json(
      { error: ticketError?.message ?? "Não foi possível abrir o chamado." },
      { status: 500 },
    );

  const { error: commentError } = await supabase
    .from("suporte_comentarios")
    .insert({ chamado_id: ticket.id, autor_id: auth.user.id, texto: message });
  if (commentError)
    return NextResponse.json({ error: commentError.message }, { status: 500 });

  return NextResponse.json(
    {
      ticket: serializeTicket({
        ...ticket,
        autor: auth.user.nome,
        depositante: { nome: auth.user.depositanteNome },
        comentarios: [
          {
            id: crypto.randomUUID(),
            texto: message,
            created_at: new Date().toISOString(),
            autor: { nome: auth.user.nome, papel: auth.user.papel },
          },
        ],
      }),
    },
    { status: 201 },
  );
}

function serializeTicket(ticket: any) {
  const comments = Array.isArray(ticket.comentarios) ? ticket.comentarios : [];
  const tone =
    ticket.status === "Resolvido"
      ? "green"
      : ticket.status === "Em análise"
        ? "blue"
        : "amber";
  return {
    id: `#CH-${ticket.numero}`,
    databaseId: ticket.id,
    title: ticket.assunto,
    category: ticket.categoria,
    meta: buildMeta(ticket.created_at, comments.length),
    status: ticket.status,
    prioridade: ticket.prioridade ?? "Normal",
    createdAt: ticket.created_at,
    autor: ticket.autor ?? null,
    tone,
    comments: comments.map((comment: any) => ({
      id: comment.id,
      text: comment.texto,
      author: comment.autor?.nome ?? "Usuário",
      role: comment.autor?.papel ?? null,
      createdAt: comment.created_at,
      anexos: Array.isArray(comment.anexos) ? comment.anexos : [],
    })),
    depositante: ticket.depositante?.nome ?? null,
  };
}

function buildMeta(createdAt: string, count: number) {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000),
  );
  const age =
    hours < 1
      ? "agora"
      : hours < 24
        ? `há ${hours} h`
        : `há ${Math.floor(hours / 24)} dias`;
  return `${age} · ${count} ${count === 1 ? "comentário" : "comentários"}`;
}
