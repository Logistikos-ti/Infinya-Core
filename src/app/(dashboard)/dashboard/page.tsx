import { requireModuleAccess } from "@/lib/auth";
import { buildIntegrationAlerts } from "@/lib/integration-alerts";
import { listAddressOccupancyFromDb } from "@/lib/enderecos";
import { listOperationalSlaReport } from "@/lib/operational-sla-report";
import { listReceivingOrdersFromDb } from "@/lib/receiving";
import { listActivePickingWavesSummary } from "@/lib/shipping";
import { listStockMovementsFromDb, type StockMovement } from "@/lib/stock";
import { listStockQuarantineFromDb } from "@/lib/stock-quarantine";
import { listSupportTicketsFromDb } from "@/lib/support";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTimePtBr } from "@/lib/utils";
import { DashboardView, type DashboardData } from "@/components/dashboard/dashboard-view";

const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// "Hoje" e limites de dia no fuso de SP, mesmo padrão usado em
// recebimento/page.tsx e relatorios/page.tsx.
function spDayBoundsUtc(daysAgo: number) {
  const shifted = new Date(Date.now() - SP_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCDate(shifted.getUTCDate() - daysAgo);
  const startUtc = shifted.getTime() + SP_OFFSET_MS;
  return { startUtc, endUtc: startUtc + DAY_MS, label: shifted };
}

function currentMesAno() {
  const shifted = new Date(Date.now() - SP_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMesAno() {
  const shifted = new Date(Date.now() - SP_OFFSET_MS);
  const prev = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() - 1, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  TRANSFERENCIA: "Transferência",
  AJUSTE_POSITIVO: "Ajuste (+)",
  AJUSTE_NEGATIVO: "Ajuste (-)",
  BLOQUEIO: "Bloqueio",
  DESBLOQUEIO: "Desbloqueio",
};

const PRIORITY_WEIGHT: Record<string, number> = { Crítica: 0, Alta: 1, Normal: 2, Baixa: 3 };

export default async function DashboardPage() {
  const user = await requireModuleAccess("dashboard");
  const depositanteId =
    user.papel === "DEPOSITANTE" ? (user.depositanteId ?? undefined) : undefined;

  const admin = createSupabaseAdminClient();
  const today = spDayBoundsUtc(0);
  const mesAno = currentMesAno();
  const mesAnoAnterior = previousMesAno();

  const [
    receivingOrders,
    quarantineItems,
    ondas,
    movimentacoesRecentes,
    supportTickets,
    slaReport,
    addressOccupancy,
    faturasRes,
    faturasMesAnteriorRes,
    depositantesRes,
    expedicaoHojeRes,
    expedicao14dRes,
    integrationOrdersRes,
    linkedDocumentsRes,
    movimentacoesHojeRes,
  ] = await Promise.all([
    listReceivingOrdersFromDb(depositanteId ? { depositanteId } : undefined),
    listStockQuarantineFromDb({ formalOnly: true, status: "EM_QUARENTENA" }),
    listActivePickingWavesSummary(3),
    listStockMovementsFromDb(depositanteId ? { depositanteId } : undefined, 3),
    listSupportTicketsFromDb(depositanteId ?? null),
    listOperationalSlaReport(user, {
      band: "ATRASADO",
      dateFrom: new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10),
    }),
    listAddressOccupancyFromDb(),
    admin
      .from("faturas")
      .select("total_a_pagar, depositantes(nome)")
      .eq("mes_ano", mesAno),
    admin.from("faturas").select("total_a_pagar").eq("mes_ano", mesAnoAnterior),
    admin
      .from("depositantes")
      .select("id, nome, ativo, configuracoes, observacoes, created_at")
      .eq("ativo", true),
    admin
      .from("pedidos_expedicao")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(today.startUtc).toISOString())
      .lt("created_at", new Date(today.endUtc).toISOString()),
    admin
      .from("pedidos_expedicao")
      .select("created_at")
      .gte("created_at", new Date(spDayBoundsUtc(13).startUtc).toISOString()),
    admin.from("pedidos_expedicao").select("id, depositante_id, origem"),
    admin.from("documentos_armazenados").select("pedido_expedicao_id, tipo"),
    admin
      .from("movimentacoes_estoque")
      .select("tipo, created_at")
      .gte("created_at", new Date(today.startUtc).toISOString())
      .lt("created_at", new Date(today.endUtc).toISOString()),
  ]);

  // KPI: pedidos hoje (recebimento + expedição)
  const receivingHojeCount = receivingOrders.filter(
    (o) => o.createdAtIso.slice(0, 10) === new Date(today.startUtc).toISOString().slice(0, 10),
  ).length;
  const pedidosHoje = receivingHojeCount + (expedicaoHojeRes.count ?? 0);

  // KPI: divergências (recebimento) — "crítica" = em DIVERGENCIA há mais de 48h
  // (sem timestamp próprio de "quando entrou em divergência", usa a criação do
  // pedido como referência).
  const divergentOrders = receivingOrders.filter((o) => o.status === "DIVERGENCIA");
  const divergencias = divergentOrders.length;
  const divergenciasCriticas = divergentOrders.filter(
    (o) => Date.now() - new Date(o.createdAtIso).getTime() > 48 * 60 * 60 * 1000,
  ).length;

  // KPI + ranking: faturamento do mês (soma de todos os status, mesmo critério
  // já usado hoje na visão geral do Financeiro).
  const faturas = faturasRes.data ?? [];
  const faturamentoMes = faturas.reduce((sum, f) => sum + Number(f.total_a_pagar ?? 0), 0);
  const rankingMap = new Map<string, number>();
  for (const f of faturas) {
    const dep = Array.isArray(f.depositantes) ? f.depositantes[0] : f.depositantes;
    const nome = (dep as { nome?: string } | null)?.nome ?? "—";
    rankingMap.set(nome, (rankingMap.get(nome) ?? 0) + Number(f.total_a_pagar ?? 0));
  }
  const ranking = Array.from(rankingMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const faturamentoMesAnterior = (faturasMesAnteriorRes.data ?? []).reduce(
    (sum, f) => sum + Number(f.total_a_pagar ?? 0),
    0,
  );
  const faturamentoDeltaPct =
    faturamentoMesAnterior > 0
      ? Math.round(((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 100)
      : null;

  // Gráfico: pedidos por dia, últimos 14 dias (recebimento + expedição)
  const expedicaoPorDia = new Map<string, number>();
  for (const row of expedicao14dRes.data ?? []) {
    const dia = (row.created_at as string).slice(0, 10);
    expedicaoPorDia.set(dia, (expedicaoPorDia.get(dia) ?? 0) + 1);
  }
  const recebimentoPorDia = new Map<string, number>();
  for (const order of receivingOrders) {
    const dia = order.createdAtIso.slice(0, 10);
    recebimentoPorDia.set(dia, (recebimentoPorDia.get(dia) ?? 0) + 1);
  }
  const dailyOrders: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const { label } = spDayBoundsUtc(i);
    const dia = `${label.getUTCFullYear()}-${String(label.getUTCMonth() + 1).padStart(2, "0")}-${String(label.getUTCDate()).padStart(2, "0")}`;
    const value = (expedicaoPorDia.get(dia) ?? 0) + (recebimentoPorDia.get(dia) ?? 0);
    dailyOrders.push({
      label: `${String(label.getUTCDate()).padStart(2, "0")}/${String(label.getUTCMonth() + 1).padStart(2, "0")}`,
      value,
    });
  }

  // Gráfico: movimentação por hora (hoje), recebimento (ENTRADA) x expedição (SAIDA)
  const hourly: { hour: string; recebimento: number; expedicao: number }[] = Array.from(
    { length: 24 },
    (_, h) => ({ hour: String(h).padStart(2, "0"), recebimento: 0, expedicao: 0 }),
  );
  for (const mov of movimentacoesHojeRes.data ?? []) {
    const spHour = new Date(new Date(mov.created_at as string).getTime() - SP_OFFSET_MS).getUTCHours();
    if (mov.tipo === "ENTRADA") hourly[spHour].recebimento += 1;
    else if (mov.tipo === "SAIDA") hourly[spHour].expedicao += 1;
  }
  // Só as horas com algum movimento no dia (evita 24 barras zeradas na maior
  // parte da madrugada); se nada bipado ainda, mostra a janela comercial padrão.
  const activeHours = hourly.filter((h) => h.recebimento > 0 || h.expedicao > 0);
  const hourlyChart = activeHours.length ? activeHours : hourly.slice(7, 19);

  // Lista: recebimentos hoje
  const recebimentosHoje = receivingOrders
    .filter((o) => (o.etaRaw ?? o.createdAtIso).slice(0, 10) === new Date(today.startUtc).toISOString().slice(0, 10))
    .slice(0, 3)
    .map((o) => ({
      hora: o.etaTime || "—",
      fornecedor: o.supplier,
      depositante: o.depositante,
      doca: o.dock || "—",
    }));

  // Lista: endereços críticos (ocupação > 90%)
  const enderecosCriticos = addressOccupancy.items
    .filter((e) => (e.ocupacao ?? 0) > 90)
    .sort((a, b) => (b.ocupacao ?? 0) - (a.ocupacao ?? 0))
    .slice(0, 3)
    .map((e) => ({ codigo: e.codigo, produto: e.produtoPrincipal ?? "—", pct: e.ocupacao ?? 0 }));

  // Lista: chamados abertos (não resolvidos), por prioridade
  const chamadosAbertos = supportTickets
    .filter((t) => t.status !== "Resolvido")
    .sort((a, b) => (PRIORITY_WEIGHT[a.prioridade] ?? 9) - (PRIORITY_WEIGHT[b.prioridade] ?? 9))
    .slice(0, 3)
    .map((t) => ({ id: t.id, assunto: t.title, prioridade: t.prioridade }));

  // Alertas críticos: endereços críticos + integrações + SLA atrasado
  const integrationAlerts = buildIntegrationAlerts({
    depositantes: (depositantesRes.data ?? []) as Array<{
      id: string;
      nome: string;
      configuracoes: unknown;
      observacoes: string | null;
    }>,
    shippingOrders: (integrationOrdersRes.data ?? []) as Array<{
      id: string;
      depositante_id: string;
      origem: string;
    }>,
    linkedDocuments: (linkedDocumentsRes.data ?? []) as Array<{
      pedido_expedicao_id: string | null;
      tipo: string;
    }>,
  });

  const alertas: DashboardData["alertas"] = [
    ...enderecosCriticos.map((e) => ({
      severidade: (e.pct >= 98 ? "critical" : "warning") as "critical" | "warning",
      mensagem: `Endereço ${e.codigo} com ${e.pct}% de ocupação`,
    })),
    ...slaReport.rows.slice(0, 3).map((r) => ({
      severidade: "warning" as const,
      mensagem: `${r.orderNumber} atrasado (${r.elapsedLabel})`,
    })),
    ...integrationAlerts.slice(0, 3).map((a) => ({
      severidade: a.severity === "info" ? ("warning" as const) : (a.severity as "critical" | "warning"),
      mensagem: `${a.depositante} · ${a.title}`,
    })),
  ].slice(0, 3);

  // KPI: em quarentena — sub conta quantos já têm decisão do depositante
  // (DOAR/DESCARTAR) e só aguardam a equipe confirmar/executar, mesmo
  // critério de statusLabel "Aguardando confirmação" usado em stock-quarantine.ts.
  const quarentenaAguardandoConfirmacao = quarantineItems.filter(
    (q) => q.depositanteDecision === "DOAR" || q.depositanteDecision === "DESCARTAR",
  ).length;

  // KPI: depositantes ativos — sub conta quantos foram criados no mês atual.
  const depositantesAtivos = depositantesRes.data ?? [];
  const depositantesNovosNoMes = depositantesAtivos.filter(
    (d) => (d.created_at as string | null)?.slice(0, 7) === mesAno,
  ).length;

  const ontemCount = dailyOrders[12]?.value ?? 0;
  const pedidosHojeDelta = pedidosHoje - ontemCount;
  const pedidosHojeSub =
    ontemCount > 0 || pedidosHoje > 0
      ? `${pedidosHojeDelta >= 0 ? "▲" : "▼"} ${Math.abs(pedidosHojeDelta)} vs ontem`
      : undefined;

  const kpis: DashboardData["kpis"] = [
    {
      label: "Ocupação",
      value: `${addressOccupancy.ocupacaoMedia}%`,
      bar: addressOccupancy.ocupacaoMedia,
    },
    {
      label: "Pedidos hoje",
      value: String(pedidosHoje),
      sub: pedidosHojeSub,
      subColor: pedidosHojeDelta >= 0 ? "#10B981" : "#EF4444",
    },
    {
      label: "Faturamento (mês)",
      value: faturamentoMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      color: "#10B981",
      sub: faturamentoDeltaPct != null ? `${faturamentoDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(faturamentoDeltaPct)}% vs mês ant.` : undefined,
      subColor: faturamentoDeltaPct != null && faturamentoDeltaPct < 0 ? "#EF4444" : "#10B981",
    },
    {
      label: "Em quarentena",
      value: String(quarantineItems.length),
      color: "#F59E0B",
      sub: quarentenaAguardandoConfirmacao > 0 ? `${quarentenaAguardandoConfirmacao} aguardando confirmação` : undefined,
    },
    {
      label: "Divergências",
      value: String(divergencias),
      color: divergencias > 0 ? "#EF4444" : undefined,
      sub: divergenciasCriticas > 0 ? `${divergenciasCriticas} crítica(s)` : undefined,
    },
    {
      label: "Depositantes ativos",
      value: String(depositantesAtivos.length),
      sub: depositantesNovosNoMes > 0 ? `${depositantesNovosNoMes} novo(s) no mês` : undefined,
    },
  ];

  const data: DashboardData = {
    userName: (user.nome ?? user.email ?? "").split(" ")[0] || "operador(a)",
    kpis,
    dailyOrders,
    ranking,
    hourly: hourlyChart,
    recebimentosHoje,
    ondas: ondas.map((o) => ({
      id: o.code,
      pedidos: o.orderCount,
      pct: o.progressPct,
      operador: o.operatorName ?? "—",
    })),
    enderecosCriticos,
    movimentacoes: movimentacoesRecentes.map((m: StockMovement) => ({
      tipo: MOVEMENT_TYPE_LABEL[m.type] ?? m.type,
      detalhe: m.reference !== "-" ? m.reference : m.sku,
      operador: m.operatorName,
      quando: formatDateTimePtBr(m.createdAt),
    })),
    chamados: chamadosAbertos,
    alertas,
  };

  return <DashboardView data={data} />;
}
