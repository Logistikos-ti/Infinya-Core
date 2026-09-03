import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TIPO_SERVICO_LABEL } from "@/lib/tipo-servico-label";

// Mesma regra de vencimento usada no financeiro do backoffice: dia 10 do mês
// seguinte à competência.
function faturaVencimento(mesAno: string): string {
  const [year, month] = mesAno.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 10));
  return next.toISOString().slice(0, 10);
}

// Código curto pro portal (sem o sufixo do depositante) — mesmo padrão usado
// na listagem de faturas do portal.
function faturaCodigoCurto(mesAno: string): string {
  return `FAT-${mesAno.replace("-", "").slice(2)}`;
}

type RouteContext = { params: Promise<{ id: string }> };

// Alimenta o mesmo <FaturaDrawer> usado na aba Financeiro do backoffice, só
// que com dados restritos à fatura + depositante do usuário do portal — as
// mesmas informações, nunca uma reimplementação separada.
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const admin = createSupabaseAdminClient();

  const { data: fatura } = await admin
    .from("faturas")
    .select("id, mes_ano, status, total_a_pagar, boleto_url, boleto_nome, depositante_id, depositantes(nome)")
    .eq("id", id)
    .maybeSingle();

  if (!fatura) {
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }

  const isAdmin = auth.user.papel === "ADMIN" || auth.user.papel === "TI";
  if (!isAdmin && auth.user.depositanteId !== fatura.depositante_id) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { data: lancamentos } = await admin
    .from("lancamentos")
    .select("tipo_servico, valor_total, descricao")
    .eq("fatura_id", id)
    .eq("estornado", false);

  const extrato = (lancamentos ?? []).map((l) => ({
    tipo: TIPO_SERVICO_LABEL[l.tipo_servico as string] ?? "Outros",
    descricao: (l.descricao as string | null) ?? "",
    valor: Number(l.valor_total),
    faturaId: id,
  }));

  return NextResponse.json({
    fatura: {
      id: fatura.id as string,
      codigo: faturaCodigoCurto(fatura.mes_ano as string),
      depNome: (fatura.depositantes as { nome?: string } | null)?.nome ?? "—",
      mesAno: fatura.mes_ano as string,
      status: fatura.status as string,
      valor: Number(fatura.total_a_pagar),
      vencimento: faturaVencimento(fatura.mes_ano as string),
      boletoUrl: (fatura.boleto_url as string | null) ?? null,
      boletoNome: (fatura.boleto_nome as string | null) ?? null,
    },
    extrato,
  });
}
