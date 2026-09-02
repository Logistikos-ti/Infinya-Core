import { requireModuleAccess, type AppUserContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listDamageReport } from "@/lib/damage-report";
import { listFiscalSummaryRows } from "@/lib/fiscal-documents";
import {
  listOperationalSlaReport,
  type OperationalSlaBand,
} from "@/lib/operational-sla-report";
import { listReverseLogisticsReport } from "@/lib/reverse-logistics-report";
import { SALES_CHANNEL_OPTIONS } from "@/lib/sales-channels";
import { listSalesReport } from "@/lib/sales-report";
import { listStockBalancesFromDb } from "@/lib/stock";
import { canManageMultipleTenants } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import {
  RelatoriosView,
  type ChartBar2,
  type FilterField,
  type ReportData,
  type TableCell,
  type Tone,
} from "@/components/relatorios/relatorios-view";

type RelatoriosPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const areaOptions = [
  { value: "", label: "Todas" },
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Armazenagem" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "Expedição" },
];

const fiscalFlowOptions = [
  { value: "", label: "Todos" },
  { value: "ENTRADA", label: "Entrada" },
  { value: "SAIDA", label: "Saída" },
];

const slaStatusOptions = [
  { value: "", label: "Todos os status" },
  { value: "NOVO", label: "Novo" },
  { value: "EM_SEPARACAO", label: "Em separação" },
  { value: "SEPARADO", label: "Separado" },
  { value: "EM_CONFERENCIA", label: "Em conferência" },
  { value: "CONFERIDO", label: "Conferido" },
  { value: "PRONTO_ROMANEIO", label: "Pronto para coleta" },
  { value: "EXPEDIDO", label: "Expedido" },
  { value: "EM_DIVERGENCIA", label: "Em divergência" },
  { value: "EM_CANCELAMENTO", label: "Cancelamento em andamento" },
  { value: "CANCELADO", label: "Cancelado" },
];

const slaBandOptions = [
  { value: "", label: "Todas as faixas" },
  { value: "NO_PRAZO", label: "No prazo" },
  { value: "ATENCAO", label: "Atenção" },
  { value: "ATRASADO", label: "Atrasado" },
  { value: "CANCELADO", label: "Cancelado" },
];

const salesChannelOptions = [
  { value: "", label: "Todos os canais" },
  ...SALES_CHANNEL_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
];

const damageStatusOptions = [
  { value: "", label: "Todos os status" },
  { value: "EM_QUARENTENA", label: "Aguardando decisão" },
  { value: "LIBERADO", label: "Doadas / liberadas" },
  { value: "DESCARTADO", label: "Descartadas" },
];

const AREA_LABELS: Record<string, string> = {
  RECEBIMENTO: "Recebimento",
  PULMAO: "Armazenagem",
  PICKING: "Picking",
  BLOQUEADO: "Bloqueado",
  EXPEDICAO: "Expedição",
};

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const user = await requireModuleAccess("relatorios");
  const raw = searchParams ? await searchParams : {};
  const get = (key: string) => {
    const value = raw[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };

  const abrir = get("abrir") || null;
  const productFilter = get("produto");
  const areaFilter = get("area");
  const lotFilter = get("lote");
  const depositanteFilter = get("depositante");
  const nfeDepositanteFilter = get("nfeDepositante");
  const dateFrom = get("dataInicio");
  const dateTo = get("dataFim");
  const fiscalFlow = get("fluxoFiscal");
  const issuerTerm = get("emitente");
  const recipientTerm = get("destinatario");
  const slaDepositanteFilter = get("slaDepositante");
  const slaDateFrom = get("slaDataInicio");
  const slaDateTo = get("slaDataFim");
  const slaStatus = get("slaStatus");
  const slaBand = normalizeSlaBand(get("slaFaixa"));
  const avariaDepositanteFilter = get("avariaDepositante");
  const avariaDateFrom = get("avariaDataInicio");
  const avariaDateTo = get("avariaDataFim");
  const avariaStatus = get("avariaStatus");
  const reversaDepositanteFilter = get("reversaDepositante");
  const reversaDateFrom = get("reversaDataInicio");
  const reversaDateTo = get("reversaDataFim");
  const vendaDepositanteFilter = get("vendaDepositante");
  const vendaDateFrom = get("vendaDataInicio");
  const vendaDateTo = get("vendaDataFim");
  const vendaCanal = get("vendaCanal");

  const isDepositante = user.papel === "DEPOSITANTE";
  const scoped = (value: string) => (isDepositante ? user.depositanteId ?? "" : value);
  const effectiveDepositanteFilter = scoped(depositanteFilter);
  const effectiveNfeDepositanteFilter = scoped(nfeDepositanteFilter);
  const effectiveSlaDepositanteFilter = scoped(slaDepositanteFilter);
  const effectiveAvariaDepositanteFilter = scoped(avariaDepositanteFilter);
  const effectiveReversaDepositanteFilter = scoped(reversaDepositanteFilter);
  const effectiveVendaDepositanteFilter = scoped(vendaDepositanteFilter);

  const fiscalFilters = {
    depositanteId: effectiveNfeDepositanteFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    flow: (fiscalFlow === "ENTRADA" || fiscalFlow === "SAIDA" ? fiscalFlow : undefined) as
      | "ENTRADA"
      | "SAIDA"
      | undefined,
    issuerTerm: issuerTerm || undefined,
    recipientTerm: recipientTerm || undefined,
  };

  const supabase = await createSupabaseServerClient();
  const [
    { data: depositantes },
    slaReport,
    damageReport,
    reverseLogisticsReport,
    salesReport,
    stockBalances,
    fiscalCounts,
    stockMovements14d,
    fiscalDaily14d,
  ] = await Promise.all([
    supabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
    listOperationalSlaReport(user, {
      depositanteId: effectiveSlaDepositanteFilter || undefined,
      dateFrom: slaDateFrom || undefined,
      dateTo: slaDateTo || undefined,
      status: slaStatus || undefined,
      band: slaBand || undefined,
    }),
    listDamageReport(user, {
      depositanteId: effectiveAvariaDepositanteFilter || undefined,
      dateFrom: avariaDateFrom || undefined,
      dateTo: avariaDateTo || undefined,
      status: avariaStatus || undefined,
    }),
    listReverseLogisticsReport(user, {
      depositanteId: effectiveReversaDepositanteFilter || undefined,
      dateFrom: reversaDateFrom || undefined,
      dateTo: reversaDateTo || undefined,
    }),
    listSalesReport(user, {
      depositanteId: effectiveVendaDepositanteFilter || undefined,
      dateFrom: vendaDateFrom || undefined,
      dateTo: vendaDateTo || undefined,
      channel: vendaCanal || undefined,
    }).catch((e): Awaited<ReturnType<typeof listSalesReport>> => {
      console.error("[relatorios] vendas falhou:", e instanceof Error ? e.message : e);
      return {
        rows: [],
        summary: {
          totalOrders: 0,
          totalValue: 0,
          totalUnits: 0,
          averageTicket: 0,
          channelBreakdown: [],
          topProducts: [],
        },
      };
    }),
    listStockBalancesFromDb({
      depositanteId: effectiveDepositanteFilter || undefined,
      productTerm: productFilter || undefined,
      area: areaFilter || undefined,
      lot: lotFilter || undefined,
    }).catch((): Awaited<ReturnType<typeof listStockBalancesFromDb>> => []),
    countFiscalDocuments(effectiveNfeDepositanteFilter),
    fetchStockMovements14d(effectiveDepositanteFilter),
    fetchFiscalDaily14d(effectiveNfeDepositanteFilter),
  ]);

  // O resumo fiscal baixa o XML de cada nota do storage (até 500) — lento e
  // sujeito a falha. Por isso NÃO roda no catálogo: só quando o drawer do
  // fiscal é aberto. O card usa a contagem barata acima (fiscalDocCount).
  const fiscalSummary =
    abrir === "nfe" ? await loadFiscalSummarySafe(user, fiscalFilters) : [];

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const depositanteDisabled = !canManageMultipleTenants(user);
  const depositanteSelect = [
    { value: "", label: "Todos" },
    ...depositanteOptions.map((d) => ({ value: d.id, label: d.nome })),
  ];

  // ── Export query builders ──
  const exportHref = (params: Record<string, string>, format: "csv" | "excel" | "pdf") =>
    `/api/relatorios?${new URLSearchParams({ ...params, format }).toString()}`;

  // Preserva os filtros dos OUTROS relatórios ao limpar/aplicar um específico.
  const currentParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (typeof v === "string" && v.trim()) currentParams[key] = v.trim();
  }
  const clearHref = (id: string, ownedNames: string[]) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(currentParams)) {
      if (k === "abrir") continue;
      if (ownedNames.includes(k)) continue;
      params.set(k, v);
    }
    params.set("abrir", id);
    return `/relatorios?${params.toString()}`;
  };

  const cell = (text: string, opts?: Partial<TableCell>): TableCell => ({ text, ...opts });
  const dep = (value: string): FilterField => ({
    type: "select",
    name: "__dep__",
    label: "Depositante",
    value,
    options: depositanteSelect,
    disabled: depositanteDisabled,
  });

  // ── 1. Saldo de estoque ──
  const skuSet = new Set<string>();
  let saldoTotal = 0;
  let reservadoTotal = 0;
  let disponivelTotal = 0;
  for (const b of stockBalances) {
    saldoTotal += b.rawQuantidade;
    reservadoTotal += b.rawReserved;
    disponivelTotal += b.rawAvailable;
    skuSet.add(b.sku);
  }

  // Saldo total no FIM de cada um dos últimos 14 dias (fuso SP), reconstruído a
  // partir do saldo atual menos a variação líquida das movimentações após cada
  // dia: saldo(fim do dia D) = saldoAtual − Σ(net das movimentações após D).
  const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const stockDailyBars: Array<{ label: string; value: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const shifted = new Date(Date.now() - SP_OFFSET_MS);
    shifted.setUTCHours(0, 0, 0, 0);
    shifted.setUTCDate(shifted.getUTCDate() - i);
    const dayEndUtc = shifted.getTime() + SP_OFFSET_MS + DAY_MS;
    const label = `${String(shifted.getUTCDate()).padStart(2, "0")}/${String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    let netAfter = 0;
    for (const m of stockMovements14d) {
      if (new Date(m.createdAt).getTime() >= dayEndUtc) netAfter += m.net;
    }
    stockDailyBars.push({ label, value: Math.max(0, Math.round(saldoTotal - netAfter)) });
  }
  const saldoExport = {
    report: "saldo-estoque",
    ...(effectiveDepositanteFilter ? { depositante: effectiveDepositanteFilter } : {}),
    ...(productFilter ? { produto: productFilter } : {}),
    ...(areaFilter ? { area: areaFilter } : {}),
    ...(lotFilter ? { lote: lotFilter } : {}),
  };
  const saldo: ReportData = {
    id: "saldo",
    title: "Posição de estoque",
    category: "Estoque",
    color: "#3B82F6",
    iconKey: "stock",
    description: "Saldo atual por SKU, endereço e depositante.",
    details:
      "Visão do saldo atual de todos os SKUs no armazém, com filtros por depositante, produto, área e lote. Exportável em CSV e Excel.",
    previewStats: [
      { label: "SKUs", value: skuSet.size.toLocaleString("pt-BR") },
      { label: "Saldo total", value: saldoTotal.toLocaleString("pt-BR") },
      { label: "Disponível", value: disponivelTotal.toLocaleString("pt-BR") },
    ],
    chartLabel: "Saldo total · últimos 14 dias",
    chartBars: stockDailyBars.slice(-7),
    drawerChartBars: stockDailyBars,
    drawerStats: [
      { label: "SKUs distintos", value: skuSet.size.toLocaleString("pt-BR") },
      { label: "Saldo total", value: saldoTotal.toLocaleString("pt-BR") },
      { label: "Disponível", value: disponivelTotal.toLocaleString("pt-BR"), tone: "green" },
      { label: "Reservado", value: reservadoTotal.toLocaleString("pt-BR"), tone: "amber" },
    ],
    filters: [
      { ...dep(effectiveDepositanteFilter), name: "depositante" },
      { type: "text", name: "produto", label: "Produto", value: productFilter, placeholder: "SKU, nome ou código" },
      { type: "select", name: "area", label: "Área", value: areaFilter, options: areaOptions },
      { type: "text", name: "lote", label: "Lote", value: lotFilter, placeholder: "Ex.: LOT-2026-001" },
    ],
    table: {
      columns: ["Produto", "Depositante", "Endereço", "Lote", "Saldo"],
      rows: stockBalances.slice(0, 200).map((b) => [
        cell(b.productName, { strong: true, sub: b.sku }),
        cell(b.depositante),
        cell(`${b.endereco} · ${AREA_LABELS[b.area] ?? b.area}`),
        cell(b.lote),
        cell(b.saldo, { strong: true }),
      ]),
      note:
        stockBalances.length > 200
          ? "Exibindo os 200 primeiros registros. Use a exportação para o saldo completo."
          : undefined,
      rowDates: stockBalances.slice(0, 200).map((b) => b.createdAt),
      empty: "Nenhum saldo encontrado para os filtros atuais.",
    },
    exportCsvHref: exportHref(saldoExport, "csv"),
    exportPdfHref: exportHref(saldoExport, "pdf"),
    clearHref: clearHref("saldo", ["depositante", "produto", "area", "lote"]),
  };

  // ── 2. SLA operacional ──
  const slaSummary = slaReport.summary;
  // Atrasos (band ATRASADO) por dia nos últimos 14 dias (fuso SP), atribuídos
  // pela data de entrada do pedido (createdAtIso). Card usa 7 dias, drawer 14.
  const slaLateDailyBars: Array<{ label: string; value: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const shifted = new Date(Date.now() - SP_OFFSET_MS);
    shifted.setUTCHours(0, 0, 0, 0);
    shifted.setUTCDate(shifted.getUTCDate() - i);
    const dayStartUtc = shifted.getTime() + SP_OFFSET_MS;
    const dayEndUtc = dayStartUtc + DAY_MS;
    const label = `${String(shifted.getUTCDate()).padStart(2, "0")}/${String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    let late = 0;
    for (const row of slaReport.rows) {
      if (row.band !== "ATRASADO") continue;
      const t = new Date(row.createdAtIso).getTime();
      if (t >= dayStartUtc && t < dayEndUtc) late += 1;
    }
    slaLateDailyBars.push({ label, value: late });
  }
  // KPIs do card escopados ao mês atual (a partir das linhas já carregadas).
  const slaMonthStart = new Date(currentMonthStartIso()).getTime();
  const slaMonthRows = slaReport.rows.filter(
    (r) => new Date(r.createdAtIso).getTime() >= slaMonthStart,
  );
  const slaMonthMonitored = slaMonthRows.filter((r) => r.band !== "CANCELADO");
  const slaMonthWithin = slaMonthMonitored.filter((r) => r.band === "NO_PRAZO").length;
  const slaMonthLate = slaMonthMonitored.filter((r) => r.band === "ATRASADO").length;
  const slaMonthRate = slaMonthMonitored.length
    ? Math.round((slaMonthWithin / slaMonthMonitored.length) * 100)
    : 0;
  const slaExport = {
    report: "sla-operacional",
    ...(effectiveSlaDepositanteFilter ? { depositante: effectiveSlaDepositanteFilter } : {}),
    ...(slaDateFrom ? { dataInicio: slaDateFrom } : {}),
    ...(slaDateTo ? { dataFim: slaDateTo } : {}),
    ...(slaStatus ? { status: slaStatus } : {}),
    ...(slaBand ? { faixa: slaBand } : {}),
  };
  const sla: ReportData = {
    id: "sla",
    title: "SLA operacional",
    category: "Operacional",
    color: "#06B6D4",
    iconKey: "sla",
    description: "Tempo entre a entrada do pedido e a expedição. Meta de 24h.",
    details:
      "Mede o tempo entre a entrada do pedido no WMS e a expedição. Meta de até 24h, atenção entre 24h e 72h e atraso a partir de 72h.",
    previewStats: [
      { label: "Monitorados", value: String(slaMonthMonitored.length) },
      { label: "Dentro do SLA", value: `${slaMonthRate}%` },
      { label: "Atrasados", value: String(slaMonthLate) },
    ],
    chartLabel: "Atrasos por dia · últimos 14 dias",
    chartBars: slaLateDailyBars.slice(-7),
    drawerChartBars: slaLateDailyBars,
    drawerStats: [
      { label: "Pedidos monitorados", value: String(slaSummary.monitored) },
      {
        label: "Dentro do SLA",
        value: `${slaSummary.withinTargetRate}%`,
        hint: `${slaSummary.withinTarget} em até 24h`,
        tone: "green",
      },
      { label: "Em atenção", value: String(slaSummary.warning), hint: "24h a 72h", tone: "amber" },
      { label: "Atrasados", value: String(slaSummary.late), hint: "acima de 72h", tone: "red" },
      { label: "Ciclo médio", value: formatHours(slaSummary.averageCycleHours) },
    ],
    filters: [
      { ...dep(effectiveSlaDepositanteFilter), name: "slaDepositante" },
      {
        type: "daterange",
        name: "slaPeriodo",
        label: "Período",
        fromName: "slaDataInicio",
        fromValue: slaDateFrom,
        toName: "slaDataFim",
        toValue: slaDateTo,
      },
      { type: "select", name: "slaStatus", label: "Status", value: slaStatus, options: slaStatusOptions },
      { type: "select", name: "slaFaixa", label: "Faixa do SLA", value: slaBand, options: slaBandOptions },
    ],
    table: {
      columns: ["Pedido", "Depositante", "Cliente", "Status", "Tempo", "Meta", "SLA"],
      rows: slaReport.rows.slice(0, 200).map((r) => [
        cell(r.orderNumber, { strong: true }),
        cell(r.depositante),
        cell(r.customer),
        cell(r.statusLabel),
        cell(r.elapsedLabel, { strong: true }),
        cell(`Até ${r.targetHours}h`),
        cell(r.bandLabel, { badge: slaBandTone(r.band) }),
      ]),
      note:
        slaReport.rows.length > 200 ? "Exibindo os 200 registros mais recentes." : undefined,
      rowDates: slaReport.rows.slice(0, 200).map((r) => r.createdAtIso),
      empty: "Nenhum pedido encontrado para os filtros de SLA atuais.",
    },
    exportCsvHref: exportHref(slaExport, "csv"),
    exportPdfHref: exportHref(slaExport, "pdf"),
    clearHref: clearHref("sla", [
      "slaDepositante",
      "slaDataInicio",
      "slaDataFim",
      "slaStatus",
      "slaFaixa",
    ]),
  };

  // ── 3. NF-e (resumo fiscal) ──
  const fiscalExport = {
    report: "nfe-resumo",
    ...(effectiveNfeDepositanteFilter ? { depositante: effectiveNfeDepositanteFilter } : {}),
    ...(dateFrom ? { dataInicio: dateFrom } : {}),
    ...(dateTo ? { dataFim: dateTo } : {}),
    ...(fiscalFlow ? { fluxoFiscal: fiscalFlow } : {}),
    ...(issuerTerm ? { emitente: issuerTerm } : {}),
    ...(recipientTerm ? { destinatario: recipientTerm } : {}),
  };
  const fiscal: ReportData = {
    id: "nfe",
    title: "NF-e por depositante",
    category: "Fiscal",
    color: "#F59E0B",
    iconKey: "fiscal",
    description: "Entradas, saídas e valor movimentado por depositante e período.",
    details:
      "Consolida entradas, saídas, valor total movimentado, volumes e itens fiscais por depositante no período selecionado.",
    previewStats: [
      { label: "Documentos NF-e", value: fiscalCounts.total.toLocaleString("pt-BR") },
      { label: "Entradas", value: fiscalCounts.entrada.toLocaleString("pt-BR") },
      { label: "Saídas", value: fiscalCounts.saida.toLocaleString("pt-BR") },
    ],
    chartLabel: "Entradas e saídas por dia · últimos 14 dias",
    chartBars: [],
    chartBars2: fiscalDaily14d.slice(-7),
    drawerChartBars2: fiscalDaily14d,
    chartSeries2: {
      labelA: "Entradas",
      colorA: "#22C55E",
      labelB: "Saídas",
      colorB: "#F59E0B",
    },
    // KPIs do drawer com dados BARATOS (contagens do mês + total do gráfico de
    // 14 dias). Não dependem do resumo fiscal pesado (XML), que só carrega via
    // navegação — como o drawer abre client-side, aquele resumo fica vazio.
    drawerStats: [
      { label: "Documentos NF-e (mês)", value: fiscalCounts.total.toLocaleString("pt-BR") },
      {
        label: "Entradas (mês)",
        value: fiscalCounts.entrada.toLocaleString("pt-BR"),
        tone: "green",
      },
      {
        label: "Saídas (mês)",
        value: fiscalCounts.saida.toLocaleString("pt-BR"),
        tone: "amber",
      },
      {
        label: "NF-e (14 dias)",
        value: fiscalDaily14d.reduce((s, b) => s + b.a + b.b, 0).toLocaleString("pt-BR"),
      },
    ],
    filters: [
      { ...dep(effectiveNfeDepositanteFilter), name: "nfeDepositante" },
      { type: "date", name: "dataInicio", label: "Data inicial", value: dateFrom },
      { type: "date", name: "dataFim", label: "Data final", value: dateTo },
      { type: "select", name: "fluxoFiscal", label: "Fluxo", value: fiscalFlow, options: fiscalFlowOptions },
      { type: "text", name: "emitente", label: "Emitente", value: issuerTerm, placeholder: "Razão social ou documento" },
      { type: "text", name: "destinatario", label: "Destinatário", value: recipientTerm, placeholder: "Razão social ou documento" },
    ],
    table: {
      columns: ["Depositante", "Entrada", "Saída", "Total", "Valor total", "Itens", "Volumes"],
      rows: fiscalSummary.map((row) => [
        cell(row.depositante, { strong: true }),
        cell(String(row.entradaDocuments)),
        cell(String(row.saidaDocuments)),
        cell(String(row.totalDocuments)),
        cell(formatCurrency(row.totalValue)),
        cell(String(row.totalItems)),
        cell(String(row.totalVolumes)),
      ]),
      empty: "Nenhum documento fiscal encontrado para os filtros atuais.",
    },
    exportCsvHref: exportHref(fiscalExport, "csv"),
    exportPdfHref: exportHref(fiscalExport, "pdf"),
    clearHref: clearHref("nfe", [
      "nfeDepositante",
      "dataInicio",
      "dataFim",
      "fluxoFiscal",
      "emitente",
      "destinatario",
    ]),
  };

  // ── 4. Avarias ──
  const damageSummary = damageReport.summary;
  // Avarias por dia nos últimos 14 dias (fuso SP), atribuídas pela data de
  // criação da ocorrência. Card usa 7 dias, drawer 14.
  const damageDailyBars: Array<{ label: string; value: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const shifted = new Date(Date.now() - SP_OFFSET_MS);
    shifted.setUTCHours(0, 0, 0, 0);
    shifted.setUTCDate(shifted.getUTCDate() - i);
    const dayStartUtc = shifted.getTime() + SP_OFFSET_MS;
    const dayEndUtc = dayStartUtc + DAY_MS;
    const label = `${String(shifted.getUTCDate()).padStart(2, "0")}/${String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    let count = 0;
    for (const row of damageReport.rows) {
      const t = new Date(row.createdAt).getTime();
      if (t >= dayStartUtc && t < dayEndUtc) count += 1;
    }
    damageDailyBars.push({ label, value: count });
  }
  const avariaExport = {
    report: "avarias",
    ...(effectiveAvariaDepositanteFilter ? { depositante: effectiveAvariaDepositanteFilter } : {}),
    ...(avariaDateFrom ? { dataInicio: avariaDateFrom } : {}),
    ...(avariaDateTo ? { dataFim: avariaDateTo } : {}),
    ...(avariaStatus ? { status: avariaStatus } : {}),
  };
  const avarias: ReportData = {
    id: "avarias",
    title: "Avarias",
    category: "Qualidade",
    color: "#EF4444",
    iconKey: "avarias",
    description: "Itens em quarentena por avaria, decisão e tempo até a resolução.",
    details:
      "Consolida os itens colocados em quarentena por avaria: quantidade, decisão do depositante e tempo até a resolução (doação ou descarte).",
    previewStats: [
      { label: "Pendentes", value: String(damageSummary.pending) },
      { label: "Doadas", value: String(damageSummary.donated) },
      { label: "Descartadas", value: String(damageSummary.discarded) },
    ],
    chartLabel: "Avarias por dia · últimos 14 dias",
    chartBars: damageDailyBars.slice(-7),
    drawerChartBars: damageDailyBars,
    // Reduzido pra 4 — o desfecho (Pendentes/Doadas/Descartadas) já aparece no
    // card, então o drawer complementa com volume total + eficiência.
    drawerStats: [
      { label: "Ocorrências", value: String(damageSummary.totalOccurrences) },
      { label: "Qtd avariada", value: damageSummary.totalQuantity.toLocaleString("pt-BR") },
      { label: "Aguardando", value: String(damageSummary.pending), tone: "amber" },
      { label: "Tempo médio", value: formatHours(damageSummary.averageResolutionHours) },
    ],
    filters: [
      { ...dep(effectiveAvariaDepositanteFilter), name: "avariaDepositante" },
      { type: "date", name: "avariaDataInicio", label: "Data inicial", value: avariaDateFrom },
      { type: "date", name: "avariaDataFim", label: "Data final", value: avariaDateTo },
      { type: "select", name: "avariaStatus", label: "Status", value: avariaStatus, options: damageStatusOptions },
    ],
    table: {
      columns: ["Produto", "Depositante", "Quantidade", "Status", "Criado em", "Resolvido em"],
      rows: damageReport.rows.slice(0, 200).map((r) => [
        cell(r.productName, { strong: true, sub: r.sku }),
        cell(r.depositante),
        cell(r.quantityLabel, { strong: true }),
        cell(r.statusLabel, { badge: damageTone(r.status) }),
        cell(r.createdAtLabel),
        cell(r.resolvedAtLabel || "-"),
      ]),
      note:
        damageReport.rows.length > 200 ? "Exibindo os 200 registros mais recentes." : undefined,
      rowDates: damageReport.rows.slice(0, 200).map((r) => r.createdAt),
      empty: "Nenhuma avaria encontrada para os filtros atuais.",
    },
    exportCsvHref: exportHref(avariaExport, "csv"),
    exportPdfHref: exportHref(avariaExport, "pdf"),
    clearHref: clearHref("avarias", [
      "avariaDepositante",
      "avariaDataInicio",
      "avariaDataFim",
      "avariaStatus",
    ]),
  };

  // ── 5. Logística reversa ──
  const reversaSummary = reverseLogisticsReport.summary;
  const reversaByMonth = new Map<string, number>();
  for (const r of reverseLogisticsReport.rows) {
    reversaByMonth.set(r.mesAno, (reversaByMonth.get(r.mesAno) ?? 0) + 1);
  }
  const reversaExport = {
    report: "logistica-reversa",
    ...(effectiveReversaDepositanteFilter ? { depositante: effectiveReversaDepositanteFilter } : {}),
    ...(reversaDateFrom ? { dataInicio: reversaDateFrom } : {}),
    ...(reversaDateTo ? { dataFim: reversaDateTo } : {}),
  };
  const reversa: ReportData = {
    id: "reversa",
    title: "Logística reversa",
    category: "Logística reversa",
    color: "#8B5CF6",
    iconKey: "reversa",
    description: "Retiradas com NF-e de devolução aceita e a cobrança gerada.",
    details:
      "Pedidos de retirada com NF-e de devolução aceita e a cobrança de logística reversa gerada para cada um, com valores e período.",
    previewStats: [
      { label: "Ocorrências", value: String(reversaSummary.totalOccurrences) },
      { label: "Unidades", value: reversaSummary.totalUnits.toLocaleString("pt-BR") },
      { label: "Valor total", value: formatCurrency(reversaSummary.totalValue) },
    ],
    chartLabel: "Ocorrências por mês",
    chartBars: Array.from(reversaByMonth.entries())
      .slice(-12)
      .map(([label, value]) => ({ label, value })),
    drawerStats: [
      { label: "Ocorrências", value: String(reversaSummary.totalOccurrences) },
      { label: "Unidades devolvidas", value: reversaSummary.totalUnits.toLocaleString("pt-BR") },
      { label: "Valor total cobrado", value: formatCurrency(reversaSummary.totalValue) },
      { label: "Ticket médio", value: formatCurrency(reversaSummary.averageTicket) },
    ],
    filters: [
      { ...dep(effectiveReversaDepositanteFilter), name: "reversaDepositante" },
      {
        type: "daterange",
        name: "reversaPeriodo",
        label: "Período",
        fromName: "reversaDataInicio",
        fromValue: reversaDateFrom,
        toName: "reversaDataFim",
        toValue: reversaDateTo,
      },
    ],
    table: {
      columns: ["Pedido", "Depositante", "Cliente", "Qtd", "Valor total", "NF-e devolução", "Lançado em"],
      rows: reverseLogisticsReport.rows.slice(0, 200).map((r) => [
        cell(r.orderNumber, { strong: true }),
        cell(r.depositante),
        cell(r.customer),
        cell(r.quantityLabel, { strong: true }),
        cell(formatCurrency(r.totalValue), { strong: true }),
        cell(r.invoiceNumber ? `${r.invoiceNumber} · ${r.invoiceReceivedAtLabel}` : "-"),
        cell(r.createdAtLabel),
      ]),
      note:
        reverseLogisticsReport.rows.length > 200
          ? "Exibindo os 200 registros mais recentes."
          : undefined,
      rowDates: reverseLogisticsReport.rows.slice(0, 200).map((r) => r.createdAtIso),
      empty: "Nenhuma cobrança de logística reversa encontrada para os filtros atuais.",
    },
    exportCsvHref: exportHref(reversaExport, "csv"),
    exportPdfHref: exportHref(reversaExport, "pdf"),
    clearHref: clearHref("reversa", [
      "reversaDepositante",
      "reversaDataInicio",
      "reversaDataFim",
    ]),
  };

  // ── 6. Vendas ──
  // KPIs do card e do drawer escopados ao mês atual (a partir das linhas já carregadas) —
  // mesmo padrão do SLA. O drawer/tabela seguem mostrando o período filtrado.
  const vendaMonthStart = new Date(currentMonthStartIso()).getTime();
  const vendaMonthRows = salesReport.rows.filter(
    (r) => new Date(r.createdAtIso).getTime() >= vendaMonthStart,
  );
  const vendaMonthValue = vendaMonthRows.reduce((s, r) => s + r.totalValue, 0);
  const vendaMonthUnits = vendaMonthRows.reduce((s, r) => s + r.totalUnits, 0);
  const vendaMonthTicket = vendaMonthRows.length
    ? Math.round((vendaMonthValue / vendaMonthRows.length) * 100) / 100
    : 0;
  // Pedidos por dia nos últimos 14 dias (fuso SP), pela data de criação do
  // pedido. Card usa 7 dias, drawer 14.
  const vendaDailyBars: Array<{ label: string; value: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const shifted = new Date(Date.now() - SP_OFFSET_MS);
    shifted.setUTCHours(0, 0, 0, 0);
    shifted.setUTCDate(shifted.getUTCDate() - i);
    const dayStartUtc = shifted.getTime() + SP_OFFSET_MS;
    const dayEndUtc = dayStartUtc + DAY_MS;
    const label = `${String(shifted.getUTCDate()).padStart(2, "0")}/${String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    let count = 0;
    for (const row of salesReport.rows) {
      const t = new Date(row.createdAtIso).getTime();
      if (t >= dayStartUtc && t < dayEndUtc) count += 1;
    }
    vendaDailyBars.push({ label, value: count });
  }
  const vendaExport = {
    report: "vendas",
    ...(effectiveVendaDepositanteFilter ? { depositante: effectiveVendaDepositanteFilter } : {}),
    ...(vendaDateFrom ? { dataInicio: vendaDateFrom } : {}),
    ...(vendaDateTo ? { dataFim: vendaDateTo } : {}),
    ...(vendaCanal ? { canal: vendaCanal } : {}),
  };
  const vendas: ReportData = {
    id: "vendas",
    title: "Vendas",
    category: "Vendas",
    color: "#10B981",
    iconKey: "vendas",
    description: "Pedidos por período, faturamento, unidades e quebra por canal.",
    details:
      "Pedidos de venda por período, com faturamento, unidades, quebra por canal e produtos mais vendidos. Pedidos cancelados não entram no total.",
    previewStats: [
      { label: "Pedidos", value: String(vendaMonthRows.length) },
      { label: "Faturamento", value: formatCurrency(vendaMonthValue) },
      { label: "Ticket médio", value: formatCurrency(vendaMonthTicket) },
    ],
    chartLabel: "Pedidos por dia · últimos 14 dias",
    chartBars: vendaDailyBars.slice(-7),
    drawerChartBars: vendaDailyBars,
    drawerStats: [
      { label: "Pedidos (mês)", value: String(vendaMonthRows.length) },
      { label: "Faturamento (mês)", value: formatCurrency(vendaMonthValue) },
      { label: "Unidades vendidas (mês)", value: vendaMonthUnits.toLocaleString("pt-BR") },
      { label: "Ticket médio (mês)", value: formatCurrency(vendaMonthTicket) },
    ],
    filters: [
      { ...dep(effectiveVendaDepositanteFilter), name: "vendaDepositante" },
      { type: "date", name: "vendaDataInicio", label: "Data inicial", value: vendaDateFrom },
      { type: "date", name: "vendaDataFim", label: "Data final", value: vendaDateTo },
      { type: "select", name: "vendaCanal", label: "Canal", value: vendaCanal, options: salesChannelOptions },
    ],
    table: {
      columns: ["Pedido", "Depositante", "Cliente", "UF", "Canal", "Unidades", "Valor total", "Criado em"],
      rows: salesReport.rows.slice(0, 200).map((r) => [
        cell(r.orderNumber, { strong: true }),
        cell(r.depositante),
        cell(r.customer),
        cell(r.uf),
        cell(r.channelLabel),
        cell(r.totalUnits.toLocaleString("pt-BR")),
        cell(formatCurrency(r.totalValue), { strong: true }),
        cell(r.createdAtLabel),
      ]),
      note:
        salesReport.rows.length > 200 ? "Exibindo os 200 registros mais recentes." : undefined,
      rowDates: salesReport.rows.slice(0, 200).map((r) => r.createdAtIso),
      empty: "Nenhuma venda encontrada para os filtros atuais.",
    },
    exportCsvHref: exportHref(vendaExport, "csv"),
    exportPdfHref: exportHref(vendaExport, "pdf"),
    clearHref: clearHref("vendas", [
      "vendaDepositante",
      "vendaDataInicio",
      "vendaDataFim",
      "vendaCanal",
    ]),
  };

  const reports = [saldo, sla, fiscal, avarias, reversa, vendas];

  return <RelatoriosView reports={reports} openId={abrir} params={currentParams} />;
}

// Variação de saldo de cada movimentação. A quantidade é sempre positiva no
// banco — o sinal vem do tipo: entrada/ajuste+ somam, saída/ajuste− subtraem,
// bloqueio/desbloqueio não alteram o saldo físico total.
function netStockChange(tipo: string, qty: number): number {
  if (tipo === "ENTRADA" || tipo === "AJUSTE_POSITIVO") return qty;
  if (tipo === "SAIDA" || tipo === "AJUSTE_NEGATIVO") return -qty;
  return 0;
}

// Movimentações dos últimos 14 dias (fuso SP), já com o delta de saldo
// pré-calculado — usadas para reconstruir o saldo total dia a dia. Pagina de
// 1000 em 1000 para não esbarrar no limite de linhas do PostgREST.
async function fetchStockMovements14d(
  depositanteId: string,
): Promise<Array<{ createdAt: string; net: number }>> {
  try {
    const admin = createSupabaseAdminClient();
    // America/Sao_Paulo = UTC-3 fixo (o Brasil não usa mais horário de verão).
    const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
    const sinceShifted = new Date(Date.now() - SP_OFFSET_MS);
    sinceShifted.setUTCHours(0, 0, 0, 0);
    sinceShifted.setUTCDate(sinceShifted.getUTCDate() - 13);
    const sinceUtc = new Date(sinceShifted.getTime() + SP_OFFSET_MS).toISOString();

    const out: Array<{ createdAt: string; net: number }> = [];
    for (let from = 0; ; from += 1000) {
      const base = admin
        .from("movimentacoes_estoque")
        .select("created_at, tipo, quantidade")
        .gte("created_at", sinceUtc)
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      const query = depositanteId ? base.eq("depositante_id", depositanteId) : base;
      const { data } = await Promise.resolve(query);
      const page = (data ?? []) as Array<{
        created_at: string;
        tipo: string;
        quantidade: number | string;
      }>;
      for (const r of page) {
        out.push({
          createdAt: r.created_at,
          net: netStockChange(r.tipo, Number(r.quantidade) || 0),
        });
      }
      if (page.length < 1000) break;
    }
    return out;
  } catch {
    return [];
  }
}

// Início do mês atual (fuso SP, UTC-3) em ISO — usado pra escopar os KPIs de
// card ao mês corrente.
function currentMonthStartIso(): string {
  const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
  const now = new Date(Date.now() - SP_OFFSET_MS);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) + SP_OFFSET_MS,
  ).toISOString();
}

// NF-e por dia nos últimos 14 dias (fuso SP), separando entradas (vínculo de
// recebimento) e saídas (vínculo de expedição) — alimenta o gráfico agrupado
// (2 colunas por dia) do card/drawer fiscal. Sem baixar XML.
async function fetchFiscalDaily14d(depositanteId: string): Promise<ChartBar2[]> {
  const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: 14 }, (_, idx) => {
    const shifted = new Date(Date.now() - SP_OFFSET_MS);
    shifted.setUTCHours(0, 0, 0, 0);
    shifted.setUTCDate(shifted.getUTCDate() - (13 - idx));
    const startUtc = shifted.getTime() + SP_OFFSET_MS;
    return {
      label: `${String(shifted.getUTCDate()).padStart(2, "0")}/${String(
        shifted.getUTCMonth() + 1,
      ).padStart(2, "0")}`,
      startUtc,
      endUtc: startUtc + DAY_MS,
      a: 0,
      b: 0,
    };
  });
  try {
    const admin = createSupabaseAdminClient();
    const sinceUtc = new Date(buckets[0].startUtc).toISOString();
    for (let from = 0; ; from += 1000) {
      const base = admin
        .from("documentos_armazenados")
        .select("created_at, pedido_recebimento_id, pedido_expedicao_id")
        .eq("tipo", "NF")
        .gte("created_at", sinceUtc)
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      const query = depositanteId ? base.eq("depositante_id", depositanteId) : base;
      const { data } = await Promise.resolve(query);
      const page = (data ?? []) as Array<{
        created_at: string;
        pedido_recebimento_id: string | null;
        pedido_expedicao_id: string | null;
      }>;
      for (const r of page) {
        const t = new Date(r.created_at).getTime();
        const bucket = buckets.find((bk) => t >= bk.startUtc && t < bk.endUtc);
        if (!bucket) continue;
        if (r.pedido_recebimento_id) bucket.a += 1;
        else if (r.pedido_expedicao_id) bucket.b += 1;
      }
      if (page.length < 1000) break;
    }
  } catch (e) {
    console.error("[relatorios] fiscalDaily14d falhou:", e instanceof Error ? e.message : e);
  }
  return buckets.map((bk) => ({ label: bk.label, a: bk.a, b: bk.b }));
}

// Contagem barata de NF-e (sem baixar XML) para o preview do card fiscal.
// Entrada/saída pela PERSPECTIVA DO ARMAZÉM via vínculo de pedido (igual ao
// resumo do drawer): NF ligada a recebimento = entrada, a expedição = saída.
// Notas sem vínculo entram só no total (a direção delas dependeria do XML).
type FiscalCounts = { total: number; entrada: number; saida: number };
async function countFiscalDocuments(depositanteId: string): Promise<FiscalCounts> {
  try {
    const admin = createSupabaseAdminClient();
    const monthStart = currentMonthStartIso();
    const build = () => {
      const base = admin
        .from("documentos_armazenados")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "NF")
        .gte("created_at", monthStart);
      return depositanteId ? base.eq("depositante_id", depositanteId) : base;
    };
    const [total, entrada, saida] = await Promise.all([
      build(),
      build().not("pedido_recebimento_id", "is", null),
      build().not("pedido_expedicao_id", "is", null),
    ]);
    return {
      total: total.count ?? 0,
      entrada: entrada.count ?? 0,
      saida: saida.count ?? 0,
    };
  } catch {
    return { total: 0, entrada: 0, saida: 0 };
  }
}

// Resumo fiscal (baixa XMLs) só quando o drawer é aberto — blindado para não
// derrubar a página inteira se algum download falhar.
async function loadFiscalSummarySafe(
  user: AppUserContext,
  filters: Parameters<typeof listFiscalSummaryRows>[1],
) {
  try {
    return await listFiscalSummaryRows(user, filters);
  } catch (error) {
    console.error("[relatorios] resumo fiscal falhou:", error);
    return [] as Awaited<ReturnType<typeof listFiscalSummaryRows>>;
  }
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeSlaBand(value?: string): OperationalSlaBand | "" {
  if (value === "NO_PRAZO" || value === "ATENCAO" || value === "ATRASADO" || value === "CANCELADO") {
    return value;
  }
  return "";
}

function formatHours(value: number) {
  if (!value) return "0h";
  if (value < 1) return `${Math.max(1, Math.round(value * 60))} min`;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

function slaBandTone(band: OperationalSlaBand): Tone {
  if (band === "NO_PRAZO") return "green";
  if (band === "ATENCAO") return "amber";
  if (band === "ATRASADO") return "red";
  return "neutral";
}

function damageTone(status: string): Tone {
  if (status === "LIBERADO") return "green";
  if (status === "DESCARTADO") return "red";
  return "amber";
}
