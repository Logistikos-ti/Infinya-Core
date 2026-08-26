import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const depositanteId = searchParams.get("depositante_id") ?? auth.user.depositanteId;

  if (!depositanteId) {
    return NextResponse.json({ error: "Depositante não identificado." }, { status: 400 });
  }

  const isAdmin = auth.user.papel === "ADMIN" || auth.user.papel === "TI";
  if (!isAdmin && auth.user.depositanteId !== depositanteId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  const { data: faturas } = await admin
    .from("faturas")
    .select("*")
    .eq("depositante_id", depositanteId)
    .order("mes_ano", { ascending: false })
    .limit(24);

  const mesAtual = new Date().toISOString().slice(0, 7);

  const { data: lancamentosMesAtual } = await admin
    .from("lancamentos")
    .select("*")
    .eq("depositante_id", depositanteId)
    .eq("mes_ano", mesAtual)
    .eq("estornado", false)
    .order("created_at", { ascending: false });

  const { data: resumoMesAtual } = await admin
    .from("lancamentos")
    .select("tipo_servico, valor_total")
    .eq("depositante_id", depositanteId)
    .eq("mes_ano", mesAtual)
    .eq("estornado", false);

  const totaisPorServico: Record<string, { qtd: number; total: number }> = {};
  let totalMesAtual = 0;

  for (const l of resumoMesAtual ?? []) {
    const tipo = l.tipo_servico as string;
    if (!totaisPorServico[tipo]) totaisPorServico[tipo] = { qtd: 0, total: 0 };
    totaisPorServico[tipo].qtd++;
    totaisPorServico[tipo].total += Number(l.valor_total);
    totalMesAtual += Number(l.valor_total);
  }

  return NextResponse.json({
    faturas: faturas ?? [],
    lancamentosMesAtual: lancamentosMesAtual ?? [],
    resumoMesAtual: totaisPorServico,
    totalMesAtual,
  });
}
