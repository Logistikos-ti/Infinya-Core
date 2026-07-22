import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SUPPORT_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoleAccess(SUPPORT_ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Digite um comentário." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("suporte_comentarios").insert({ chamado_id: id, autor_id: auth.user.id, texto: text }).select("id, texto, created_at").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Não foi possível enviar o comentário." }, { status: 500 });
  return NextResponse.json({ comment: { id: data.id, text: data.texto, author: auth.user.nome, role: auth.user.papel, createdAt: data.created_at } }, { status: 201 });
}
