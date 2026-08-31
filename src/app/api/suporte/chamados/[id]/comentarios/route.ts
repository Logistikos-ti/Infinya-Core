import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SUPPORT_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoleAccess(SUPPORT_ROLES);
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { text?: unknown; anexos?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const anexos = Array.isArray(body?.anexos)
    ? (body.anexos as unknown[])
        .filter((a): a is { url: string } => Boolean(a) && typeof (a as { url?: unknown }).url === "string")
        .map((a) => {
          const raw = a as { url: string; nome?: unknown; tipo?: unknown };
          return { url: raw.url, nome: String(raw.nome ?? "arquivo"), tipo: String(raw.tipo ?? "") };
        })
        .slice(0, 10)
    : [];

  if (!text && !anexos.length) {
    return NextResponse.json({ error: "Digite um comentário ou anexe um arquivo." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const insertFull = await supabase
    .from("suporte_comentarios")
    .insert({ chamado_id: id, autor_id: auth.user.id, texto: text, anexos })
    .select("id, texto, created_at, anexos")
    .single();
  // Fallback se a coluna "anexos" ainda não existir (migração não rodada, 42703).
  const insertFallback =
    insertFull.error && (insertFull.error as { code?: string }).code === "42703"
      ? await supabase
          .from("suporte_comentarios")
          .insert({ chamado_id: id, autor_id: auth.user.id, texto: text })
          .select("id, texto, created_at")
          .single()
      : null;
  const data = (insertFallback?.data ?? insertFull.data) as
    | { id: string; texto: string; created_at: string; anexos?: unknown }
    | null;
  const error = insertFallback?.error ?? insertFull.error;
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Não foi possível enviar o comentário." },
      { status: 500 },
    );
  }
  return NextResponse.json(
    {
      comment: {
        id: data.id,
        text: data.texto,
        author: auth.user.nome,
        role: auth.user.papel,
        createdAt: data.created_at,
        anexos: data.anexos ?? anexos,
      },
    },
    { status: 201 },
  );
}
