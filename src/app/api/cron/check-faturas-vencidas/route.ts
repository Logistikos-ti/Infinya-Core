import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

// Roda diário (ver vercel.json). Mesma regra de vencimento usada em todo o
// resto do sistema (financeiro do backoffice e portal do depositante): dia
// 10 do mês seguinte à competência (mes_ano). Duplicada aqui de propósito,
// seguindo o mesmo padrão já existente nas outras 3 cópias -- nenhuma delas
// exporta a função pra reuso.
function faturaVencimento(mesAno: string): string {
  const [year, month] = mesAno.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 10));
  return next.toISOString().slice(0, 10);
}

// "10/09" a partir de "2026-09-10" -- sem ano, só pra mensagem curta do sino.
function formatDiaMesBr(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // Só ABERTA conta -- uma vez que a fatura sai desse status (FECHADA/
  // ENVIADA/RECEBIDA) ela deixou de ser uma pendência em aberto no mesmo
  // sentido, então não faz mais sentido alertar sobre vencimento.
  const { data: faturas, error: faturasError } = await supabase
    .from("faturas")
    .select("id, depositante_id, mes_ano, codigo")
    .eq("status", "ABERTA");

  if (faturasError) {
    return NextResponse.json({ error: faturasError.message }, { status: 500 });
  }

  if (!faturas?.length) {
    return NextResponse.json({ ok: true, vencidas: 0, notificadas: 0 });
  }

  const hoje = new Date();
  const vencidas = faturas
    .map((fatura) => ({ ...fatura, vencimento: faturaVencimento(fatura.mes_ano) }))
    .filter((fatura) => hoje > new Date(`${fatura.vencimento}T00:00:00Z`));

  if (!vencidas.length) {
    return NextResponse.json({ ok: true, vencidas: 0, notificadas: 0 });
  }

  // notificacoes não tem uma flag "já avisei sobre essa fatura" -- dedupe
  // consultando a própria tabela por um FATURA_VENCIDA já existente pra
  // cada fatura vencida, numa única query batelada em vez de uma por fatura.
  const vencidaIds = vencidas.map((fatura) => fatura.id);
  const { data: existentes, error: notifError } = await supabase
    .from("notificacoes")
    .select("referencia_id")
    .eq("tipo", "FATURA_VENCIDA")
    .eq("referencia_tipo", "fatura")
    .in("referencia_id", vencidaIds);

  if (notifError) {
    return NextResponse.json({ error: notifError.message }, { status: 500 });
  }

  const jaNotificadas = new Set((existentes ?? []).map((row) => row.referencia_id));

  let notificadas = 0;
  for (const fatura of vencidas) {
    if (jaNotificadas.has(fatura.id)) continue;

    const codigo = (fatura.codigo as string | null) ?? fatura.mes_ano;
    await createNotification({
      tipo: "FATURA_VENCIDA",
      titulo: "Fatura vencida",
      mensagem: `Fatura ${codigo} (${fatura.mes_ano}) está vencida desde ${formatDiaMesBr(fatura.vencimento)}.`,
      link: "/financeiro",
      depositanteId: fatura.depositante_id,
      referenciaTipo: "fatura",
      referenciaId: fatura.id,
    });
    notificadas += 1;
  }

  return NextResponse.json({ ok: true, vencidas: vencidas.length, notificadas });
}
