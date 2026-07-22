import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SUPPORT_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

export async function GET() {
  const auth = await requireApiRoleAccess(SUPPORT_ROLES);
  if (auth.response) return auth.response;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("suporte_chamados")
    .select("id, numero, assunto, categoria, status, created_at, updated_at, depositante:depositantes(nome), comentarios:suporte_comentarios(id, texto, created_at, autor:usuarios(nome, papel))")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tickets: (data ?? []).map(serializeTicket) });
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
  const category = typeof body?.category === "string" && body.category.trim() ? body.category.trim() : "Outros";

  if (!subject || !message) {
    return NextResponse.json({ error: "Informe o assunto e a mensagem do chamado." }, { status: 400 });
  }
  if (!auth.user.depositanteId) {
    return NextResponse.json({ error: "O chamado precisa estar vinculado a um depositante." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("suporte_chamados")
    .insert({
      depositante_id: auth.user.depositanteId,
      criado_por: auth.user.id,
      assunto: subject,
      categoria: category,
    })
    .select("id, numero, assunto, categoria, status, created_at, updated_at, depositante:depositantes(nome)")
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: ticketError?.message ?? "Não foi possível abrir o chamado." }, { status: 500 });
  }

  const { error: commentError } = await supabase.from("suporte_comentarios").insert({
    chamado_id: ticket.id,
    autor_id: auth.user.id,
    texto: message,
  });

  if (commentError) {
    return NextResponse.json({ error: commentError.message }, { status: 500 });
  }

  return NextResponse.json({ ticket: serializeTicket({ ...ticket, comentarios: [{ id: crypto.randomUUID(), texto: message, created_at: new Date().toISOString(), autor: { nome: auth.user.nome, papel: auth.user.papel } }] }) }, { status: 201 });
}

function serializeTicket(ticket: any) {
  const comments = Array.isArray(ticket.comentarios) ? ticket.comentarios : [];
  const tone = ticket.status === "Resolvido" ? "green" : ticket.status === "Em análise" ? "blue" : "amber";
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
  const created = new Date(createdAt).getTime();
  const hours = Math.max(0, Math.floor((Date.now() - created) / 3_600_000));
  const age = hours < 1 ? "agora" : hours < 24 ? `há ${hours} h` : `há ${Math.floor(hours / 24)} dias`;
  return `${age} · ${count} ${count === 1 ? "comentário" : "comentários"}`;
}
