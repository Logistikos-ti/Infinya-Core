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
  let ticketsQuery = supabase
    .from("suporte_chamados")
    .select(
      "id, numero, assunto, categoria, status, created_at, updated_at, depositante_id",
    )
    .order("created_at", { ascending: false });
  if (auth.user.papel === "DEPOSITANTE" && auth.user.depositanteId)
    ticketsQuery = ticketsQuery.eq("depositante_id", auth.user.depositanteId);
  const { data: tickets, error: ticketError } = await ticketsQuery;
  const ticketIds = (tickets ?? []).map((ticket) => ticket.id);
  let commentsQuery = supabase
    .from("suporte_comentarios")
    .select("id, chamado_id, texto, created_at, autor_id")
    .order("created_at", { ascending: true });
  if (ticketIds.length)
    commentsQuery = commentsQuery.in("chamado_id", ticketIds);
  const [
    { data: comments, error: commentError },
    { data: depositantes, error: depositanteError },
  ] = await Promise.all([
    ticketIds.length
      ? commentsQuery
      : Promise.resolve({ data: [], error: null }),
    supabase.from("depositantes").select("id, nome"),
  ]);

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

  const commentsByTicket = new Map<
    string,
    Array<{
      id: string;
      chamado_id: string;
      texto: string;
      created_at: string;
      autor_id: string;
    }>
  >();
  for (const comment of comments ?? []) {
    const list = commentsByTicket.get(comment.chamado_id) ?? [];
    list.push(comment);
    commentsByTicket.set(comment.chamado_id, list);
  }
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
          depositante: {
            nome: depositanteNames.get(ticket.depositante_id) ?? null,
          },
          comentarios: commentsByTicket.get(ticket.id) ?? [],
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
  } | null;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const category =
    typeof body?.category === "string" && body.category.trim()
      ? body.category.trim()
      : "Outros";

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
  const { data: ticket, error: ticketError } = await supabase
    .from("suporte_chamados")
    .insert({
      depositante_id: auth.user.depositanteId,
      criado_por: auth.user.id,
      assunto: subject,
      categoria: category,
    })
    .select(
      "id, numero, assunto, categoria, status, created_at, updated_at, depositante_id",
    )
    .single();
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
    tone,
    comments: comments.map((comment: any) => ({
      id: comment.id,
      text: comment.texto,
      author: comment.autor?.nome ?? "Usuário",
      role: comment.autor?.papel ?? null,
      createdAt: comment.created_at,
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
