import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Mesma regra de vencimento usada no financeiro do backoffice: dia 10 do mês
// seguinte à competência.
function faturaVencimento(mesAno: string): string {
  const [year, month] = mesAno.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 10));
  return next.toISOString().slice(0, 10);
}

// Código curto pro portal (sem o sufixo do depositante, que só faz sentido
// quando várias empresas aparecem juntas, como no financeiro do backoffice).
function faturaCodigoCurto(mesAno: string): string {
  return `FAT-${mesAno.replace("-", "").slice(2)}`;
}

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

  const { data: faturasRaw } = await admin
    .from("faturas")
    .select("id, mes_ano, status, total_a_pagar")
    .eq("depositante_id", depositanteId)
    .order("mes_ano", { ascending: false })
    .limit(24);

  const faturas = (faturasRaw ?? []).map((f) => ({
    id: f.id as string,
    codigo: faturaCodigoCurto(f.mes_ano as string),
    mesAno: f.mes_ano as string,
    status: f.status as string,
    totalAPagar: Number(f.total_a_pagar),
    vencimento: faturaVencimento(f.mes_ano as string),
  }));

  return NextResponse.json({ faturas });
}
