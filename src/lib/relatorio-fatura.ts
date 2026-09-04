import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { formatCnpj } from "@/lib/transportadoras";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type RelatorioServico = {
  id: string;
  nome: string;
  detalhe: string;
  unitario: string;
  valor: number;
};

export type RelatorioNf = {
  nf: string;
  transp: string;
  tipo: "Expedição" | "Ponto de Coleta";
  valor: number;
};

export type RelatorioCarrier = {
  transp: string;
  count: number;
  total: number;
  tipoLabel: string;
  tipoKey: "exp" | "col" | "mixed";
  rank: number;
};

export type RelatorioInsumo = {
  nome: string;
  qtd: number;
  unidade: string;
  preco: number;
  total: number;
};

export type RelatorioRecebimentoItem = {
  produto: string;
  quantidade: number;
  data: string;
};

export type RelatorioFaturaData = {
  faturaId: string;
  depositanteId: string;
  codigo: string;
  cliente: string;
  razaoSocial: string;
  cnpj: string;
  periodo: string;
  periodoRef: string;
  periodoMesAno: string;
  emitido: string;
  status: string;
  kpis: {
    nfsExpedidas: number;
    pontoColeta: number;
    palletsArmazenados: number;
    nfsImpressas: number;
  };
  servicos: RelatorioServico[];
  totalLogistica: number;
  totalDescontos: number;
  totalAPagar: number;
  valorExpedicao: number;
  nfsExpedicaoCount: number;
  valorPontoColeta: number;
  nfsPontoColetaCount: number;
  nfs: RelatorioNf[];
  carriers: RelatorioCarrier[];
  insumos: RelatorioInsumo[];
  recebimentos: RelatorioRecebimentoItem[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MESES_LONGO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatMesAnoLongo(mesAno: string) {
  const [year, month] = mesAno.split("-");
  return `${MESES_LONGO[Number(month) - 1]} de ${year}`;
}

function formatMesAnoCurto(mesAno: string) {
  const [year, month] = mesAno.split("-");
  return `${MESES_LONGO[Number(month) - 1].toUpperCase()}/${year}`;
}

function insumoNomeFromDescricao(descricao: string): string {
  return descricao.replace(/\s*\([^)]*\)\s*$/, "").trim() || descricao;
}

function insumoQtdFromDescricao(descricao: string): { qtd: number; unidade: string } | null {
  const m = descricao.match(/\(([\d.,]+)\s*([^)]*)\)\s*$/);
  if (!m) return null;
  const qtd = Number(m[1].replace(",", "."));
  if (Number.isNaN(qtd)) return null;
  return { qtd, unidade: m[2].trim() };
}

const SERVICO_LABEL: Record<string, string> = {
  FULFILLMENT: "Fulfillment",
  PONTO_COLETA: "Ponto de Coleta",
  IMPRESSAO_NF: "Impressão de NFs",
  CARTA_CORRECAO: "Carta de Correção",
  OUTRO_DOCUMENTO: "Outro Documento",
  GESTAO_FRETE: "Gestão de Frete",
  ITEM_ADICIONAL: "Item Adicional",
  CONFERENCIA: "Conferência Unitária",
  URGENCIA: "Urgência",
  LOGISTICA_REVERSA: "Logística Reversa",
  CANCELAMENTO: "Cancelamento",
  RETIRADA: "Retirada",
  DESCARTE: "Descarte",
  RECEBIMENTO: "Recebimentos",
  ARMAZENAMENTO: "Armazenamento",
  SOFTWARE: "Software",
  INTEGRACAO: "Integração",
  AD_VALOREM: "Ad Valorem",
  REFRIGERADOR: "Refrigerador",
  INSUMO: "Insumos",
  DESCONTO: "Desconto",
  COBRANCA_EXTRA: "Cobrança Extra",
};

const SERVICO_CODIGO: Record<string, string> = {
  FULFILLMENT: "FUL",
  PONTO_COLETA: "PDC",
  IMPRESSAO_NF: "IMP",
  CARTA_CORRECAO: "CCE",
  OUTRO_DOCUMENTO: "DOC",
  GESTAO_FRETE: "FRT",
  ITEM_ADICIONAL: "ITA",
  CONFERENCIA: "CNF",
  URGENCIA: "URG",
  LOGISTICA_REVERSA: "LGR",
  CANCELAMENTO: "CAN",
  RETIRADA: "RET",
  DESCARTE: "DSC",
  RECEBIMENTO: "REC",
  ARMAZENAMENTO: "ARM",
  SOFTWARE: "SFT",
  INTEGRACAO: "INT",
  AD_VALOREM: "ADV",
  REFRIGERADOR: "REF",
  INSUMO: "INS",
  DESCONTO: "DES",
  COBRANCA_EXTRA: "EXT",
};

const SERVICO_UNIDADE: Record<string, string> = {
  FULFILLMENT: "pedido",
  PONTO_COLETA: "pedido",
  IMPRESSAO_NF: "NF",
  CARTA_CORRECAO: "pedido",
  OUTRO_DOCUMENTO: "documento",
  GESTAO_FRETE: "pedido",
  ITEM_ADICIONAL: "item",
  CONFERENCIA: "pedido",
  URGENCIA: "pedido",
  LOGISTICA_REVERSA: "item",
  CANCELAMENTO: "pedido",
  RETIRADA: "item",
  DESCARTE: "item",
  RECEBIMENTO: "recebimento",
  ARMAZENAMENTO: "pallet / mês",
  SOFTWARE: "mês",
  INTEGRACAO: "integração / mês",
  REFRIGERADOR: "refrigerador / mês",
};

const SERVICO_DETALHE_PLURAL: Record<string, string> = {
  FULFILLMENT: "NFs processadas",
  PONTO_COLETA: "pedidos",
  IMPRESSAO_NF: "notas fiscais",
  CARTA_CORRECAO: "pedidos",
  OUTRO_DOCUMENTO: "documentos",
  GESTAO_FRETE: "pedidos",
  ITEM_ADICIONAL: "itens",
  CONFERENCIA: "pedidos",
  URGENCIA: "pedidos",
  LOGISTICA_REVERSA: "itens",
  CANCELAMENTO: "pedidos",
  RETIRADA: "itens",
  DESCARTE: "itens",
  RECEBIMENTO: "unidades",
  ARMAZENAMENTO: "pallets no mês",
  SOFTWARE: "cobrança mensal",
  INTEGRACAO: "integrações ativas",
  REFRIGERADOR: "refrigeradores",
  INSUMO: "itens de insumo",
  COBRANCA_EXTRA: "lançamentos",
};

function fmtBR(n: number, decimals = 2) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

type LancamentoRow = {
  id: string;
  tipo_servico: string;
  valor_total: number;
  valor_unitario: number;
  quantidade: number;
  descricao: string | null;
  referencia_tipo: string | null;
  referencia_id: string | null;
  contrato_snapshot: Record<string, unknown> | null;
};

// Tipos cobrados como agregado mensal (1 lançamento cujo `quantidade` já é a
// contagem real — pallets, refrigeradores, integrações ativas) — o detalhe
// deve somar `quantidade`, não contar lançamentos (que costuma dar sempre 1).
const SERVICO_QTD_AGREGADA = new Set(["ARMAZENAMENTO", "REFRIGERADOR", "INTEGRACAO"]);
// Tipos onde a quantidade não agrega informação nenhuma (cobrança mensal fixa).
const SERVICO_SEM_DETALHE = new Set(["SOFTWARE"]);

function buildServico(tipo: string, itens: LancamentoRow[]): RelatorioServico {
  const total = itens.reduce((s, l) => s + Number(l.valor_total), 0);
  const count = SERVICO_QTD_AGREGADA.has(tipo)
    ? itens.reduce((s, l) => s + Number(l.quantidade), 0)
    : itens.length;
  const plural = SERVICO_DETALHE_PLURAL[tipo] ?? "lançamentos";
  const unidade = SERVICO_UNIDADE[tipo];

  let unitario: string;
  if (tipo === "FULFILLMENT") {
    const snap = itens[0]?.contrato_snapshot as { taxa_fulfillment?: number; minimo_fulfillment?: number } | null;
    unitario = snap
      ? `${(Number(snap.taxa_fulfillment) * 100).toFixed(1)}% s/ valor produtos (mín. ${fmtCurrency(Number(snap.minimo_fulfillment))})`
      : "% sobre valor dos produtos";
  } else if (tipo === "AD_VALOREM") {
    const snap = itens[0]?.contrato_snapshot as { taxa_ad_valorem?: number } | null;
    unitario = snap ? `${(Number(snap.taxa_ad_valorem) * 100).toFixed(2)}% sobre valor declarado` : "% sobre valor declarado";
  } else if (tipo === "INSUMO") {
    unitario = "Custo direto";
  } else if (tipo === "CANCELAMENTO") {
    unitario = "Valor por item, mínimo por pedido";
  } else if (unidade) {
    const valoresUnicos = new Set(itens.map((l) => Number(l.valor_unitario)));
    unitario = valoresUnicos.size === 1
      ? `${fmtCurrency(Number(itens[0].valor_unitario))} por ${unidade}`
      : "Valor variável";
  } else {
    unitario = "Valor variável";
  }

  return {
    id: SERVICO_CODIGO[tipo] ?? tipo.slice(0, 3),
    nome: SERVICO_LABEL[tipo] ?? tipo,
    detalhe: SERVICO_SEM_DETALHE.has(tipo) ? "" : `${count} ${plural}`,
    unitario,
    valor: total,
  };
}

function fmtCurrency(v: number) {
  return "R$ " + fmtBR(v ?? 0);
}

async function fetchRowsInChunks<T>(
  ids: string[],
  chunkSize: number,
  fetcher: (chunk: string[]) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data } = await fetcher(chunk);
    if (data) rows.push(...data);
  }
  return rows;
}

// PostgREST caps every request at 1000 rows regardless of the requested
// limit — uma fatura com muito volume (ex: >1000 lançamentos no mês)
// perdia lançamentos em silêncio (sempre os "de trás" na ordem física da
// tabela, tipicamente os de INSUMO por terem sido lançados por último),
// fazendo o relatório baixável mostrar menos itens do que o drawer do
// financeiro, que já pagina corretamente. Pagina via range() do mesmo jeito.
async function fetchAllLancamentosDaFatura(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  faturaId: string,
): Promise<LancamentoRow[]> {
  const pageSize = 1000;
  const all: LancamentoRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from("lancamentos")
      .select("id, tipo_servico, valor_total, valor_unitario, quantidade, descricao, referencia_tipo, referencia_id, contrato_snapshot")
      .eq("fatura_id", faturaId)
      .eq("estornado", false)
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error || !data?.length) break;
    all.push(...(data as LancamentoRow[]));
    if (data.length < pageSize) break;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Construção dos dados do relatório
// ---------------------------------------------------------------------------

export async function buildRelatorioFaturaData(faturaId: string): Promise<RelatorioFaturaData | null> {
  const admin = createSupabaseAdminClient();

  const { data: fatura } = await admin
    .from("faturas")
    .select("*, depositantes(id, nome, cnpj, configuracoes, observacoes)")
    .eq("id", faturaId)
    .single();

  if (!fatura) return null;

  const dep = fatura.depositantes as {
    id?: string;
    nome?: string;
    cnpj?: string | null;
    configuracoes?: unknown;
    observacoes?: string | null;
  } | null;

  const rawConfig = dep?.configuracoes ? JSON.stringify(dep.configuracoes) : (dep?.observacoes ?? null);
  const config = parseDepositanteConfiguracoes(rawConfig);

  const lancamentos = await fetchAllLancamentosDaFatura(admin, faturaId);

  const agrupado = new Map<string, LancamentoRow[]>();
  for (const l of lancamentos) {
    const arr = agrupado.get(l.tipo_servico) ?? [];
    arr.push(l);
    agrupado.set(l.tipo_servico, arr);
  }

  const servicos = Array.from(agrupado.entries())
    .map(([tipo, itens]) => buildServico(tipo, itens))
    .sort((a, b) => b.valor - a.valor);

  const totalLogistica = servicos.reduce((s, x) => s + x.valor, 0);
  const totalDescontos = Number(fatura.total_descontos ?? 0);

  // ---- KPIs ----
  const nfsExpedidasCount = (agrupado.get("FULFILLMENT") ?? []).length;
  const pontoColetaCount = (agrupado.get("PONTO_COLETA") ?? []).length;
  const palletsArmazenados = (agrupado.get("ARMAZENAMENTO") ?? []).reduce((s, l) => s + Number(l.quantidade), 0);
  const nfsImpressasCount = (agrupado.get("IMPRESSAO_NF") ?? []).length;

  // ---- NFs processadas + transportadoras ----
  const pedidoIds = Array.from(
    new Set(
      [...(agrupado.get("FULFILLMENT") ?? []), ...(agrupado.get("PONTO_COLETA") ?? [])]
        .filter((l) => l.referencia_tipo === "PEDIDO_EXPEDICAO" && l.referencia_id)
        .map((l) => l.referencia_id as string),
    ),
  );

  const pedidosExpedicao = await fetchRowsInChunks(pedidoIds, 200, (chunk) =>
    admin
      .from("pedidos_expedicao")
      .select("id, codigo, numero_wms, canal, valor_total, payload_origem")
      .in("id", chunk),
  );

  const marketplacesPontoColeta = ((await admin
    .from("contratos_cobranca")
    .select("marketplaces_ponto_coleta")
    .eq("depositante_id", dep?.id ?? "")
    .eq("ativo", true)
    .maybeSingle()).data?.marketplaces_ponto_coleta ?? []) as string[];

  const depNomeCurto = dep?.nome ?? "";
  const nfs: RelatorioNf[] = [];
  const carrierAgg = new Map<string, { count: number; total: number; tipos: Set<string> }>();

  for (const p of pedidosExpedicao) {
    const payload = (p.payload_origem ?? {}) as { transportadora?: string; notaFiscal?: { numero?: string } };
    const transp = payload.transportadora?.trim() || "Não informado";
    const canal = (p.canal ?? "").toLowerCase();
    const isPontoColeta = marketplacesPontoColeta.some((kw) => canal.includes(kw.toLowerCase()));
    const tipo: RelatorioNf["tipo"] = isPontoColeta ? "Ponto de Coleta" : "Expedição";
    const nfNumero = payload.notaFiscal?.numero || formatWmsOrderNumber(p.numero_wms, p.codigo, depNomeCurto);
    const valor = Number(p.valor_total ?? 0);

    nfs.push({ nf: nfNumero, transp, tipo, valor });

    const agg = carrierAgg.get(transp) ?? { count: 0, total: 0, tipos: new Set<string>() };
    agg.count += 1;
    agg.total += valor;
    agg.tipos.add(tipo);
    carrierAgg.set(transp, agg);
  }

  const carriers: RelatorioCarrier[] = Array.from(carrierAgg.entries())
    .map(([transp, agg]) => {
      const tipos = Array.from(agg.tipos);
      const tipoKey: RelatorioCarrier["tipoKey"] = tipos.length > 1 ? "mixed" : tipos[0] === "Ponto de Coleta" ? "col" : "exp";
      return {
        transp,
        count: agg.count,
        total: agg.total,
        tipoLabel: tipos.join(" + "),
        tipoKey,
        rank: 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((c, i) => ({ ...c, rank: i + 1 }));

  const valorExpedicao = nfs.filter((n) => n.tipo === "Expedição").reduce((s, n) => s + n.valor, 0);
  const nfsExpedicaoCount = nfs.filter((n) => n.tipo === "Expedição").length;
  const valorPontoColeta = nfs.filter((n) => n.tipo === "Ponto de Coleta").reduce((s, n) => s + n.valor, 0);
  const nfsPontoColetaCount = nfs.filter((n) => n.tipo === "Ponto de Coleta").length;

  // ---- Insumos ----
  const insumoLancamentos = agrupado.get("INSUMO") ?? [];
  const insumoAgg = new Map<string, { qtd: number; unidade: string; total: number; count: number }>();
  for (const l of insumoLancamentos) {
    const nome = insumoNomeFromDescricao(l.descricao ?? "");
    const qtdInfo = insumoQtdFromDescricao(l.descricao ?? "");
    const agg = insumoAgg.get(nome) ?? { qtd: 0, unidade: qtdInfo?.unidade ?? "un", total: 0, count: 0 };
    agg.qtd += qtdInfo?.qtd ?? Number(l.quantidade);
    agg.total += Number(l.valor_total);
    agg.count += 1;
    insumoAgg.set(nome, agg);
  }
  const insumos: RelatorioInsumo[] = Array.from(insumoAgg.entries())
    .map(([nome, agg]) => ({
      nome,
      qtd: agg.qtd,
      unidade: agg.unidade,
      preco: agg.qtd > 0 ? agg.total / agg.qtd : agg.total,
      total: agg.total,
    }))
    .sort((a, b) => b.total - a.total);

  // ---- Recebimentos (itens reais, via NF-e importada) ----
  const recebimentoLancamentos = [...(agrupado.get("RECEBIMENTO") ?? []), ...(agrupado.get("CONFERENCIA") ?? [])];
  const pedidoRecebimentoIds = Array.from(
    new Set(
      recebimentoLancamentos
        .filter((l) => l.referencia_tipo === "PEDIDO_RECEBIMENTO" && l.referencia_id)
        .map((l) => l.referencia_id as string),
    ),
  );

  const itensRecebimento = await fetchRowsInChunks(pedidoRecebimentoIds, 200, (chunk) =>
    admin
      .from("pedidos_recebimento_itens")
      .select("produto_id, quantidade_recebida, updated_at, pedido_recebimento_id")
      .in("pedido_recebimento_id", chunk),
  );

  const produtoIds = Array.from(new Set(itensRecebimento.map((i) => (i as { produto_id: string }).produto_id).filter(Boolean)));
  const produtos = await fetchRowsInChunks(produtoIds, 200, (chunk) =>
    admin.from("produtos").select("id, nome").in("id", chunk),
  );
  const produtoNomeById = new Map(produtos.map((p) => [(p as { id: string }).id, (p as { nome: string }).nome]));

  const recebimentos: RelatorioRecebimentoItem[] = itensRecebimento
    .map((i) => {
      const item = i as { produto_id: string; quantidade_recebida: number; updated_at: string };
      return {
        produto: produtoNomeById.get(item.produto_id) ?? "Produto não identificado",
        quantidade: Number(item.quantidade_recebida ?? 0),
        data: (item.updated_at ?? "").slice(0, 10),
      };
    })
    .filter((r) => r.quantidade > 0)
    .sort((a, b) => (a.data < b.data ? 1 : -1));

  const statusLabel: Record<string, string> = {
    ABERTA: "Aberta",
    FECHADA: "Fechado",
    ENVIADA: "Enviada",
    PAGO: "Pago",
  };

  return {
    faturaId: fatura.id as string,
    depositanteId: dep?.id ?? "",
    codigo: (fatura as { codigo?: string | null }).codigo ?? fatura.id,
    cliente: dep?.nome ?? "—",
    razaoSocial: config.razaoSocial || dep?.nome || "—",
    cnpj: dep?.cnpj ? formatCnpj(dep.cnpj) : "—",
    periodo: formatMesAnoLongo(fatura.mes_ano as string),
    periodoRef: (fatura.mes_ano as string).split("-").reverse().join("/"),
    periodoMesAno: formatMesAnoCurto(fatura.mes_ano as string),
    emitido: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    status: statusLabel[fatura.status as string] ?? (fatura.status as string),
    kpis: {
      nfsExpedidas: nfsExpedidasCount,
      pontoColeta: pontoColetaCount,
      palletsArmazenados,
      nfsImpressas: nfsImpressasCount,
    },
    servicos,
    totalLogistica,
    totalDescontos,
    totalAPagar: Number(fatura.total_a_pagar ?? 0),
    valorExpedicao,
    nfsExpedicaoCount,
    valorPontoColeta,
    nfsPontoColetaCount,
    nfs,
    carriers,
    insumos,
    recebimentos,
  };
}
