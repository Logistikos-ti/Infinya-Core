import {
  FinanceiroApp,
  type ContaPagarRow,
  type ContratoRow,
  type Depositante,
  type ExtratoRow,
  type FaturaDocRow,
  type FaturaRow,
  type InsumoRow,
} from "@/components/financeiro/financeiro-app";
import { requireModuleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";

// Rótulo do selo na 1ª coluna do extrato — um por tipo_servico, não mais
// agrupado por categoria ampla (senão fulfillment/ponto de coleta/impressão
// NF ficavam todos indistinguíveis como "Expedição").
const TIPO_SERVICO_LABEL: Record<string, string> = {
  FULFILLMENT: "Fulfillment",
  PONTO_COLETA: "Ponto de coleta",
  IMPRESSAO_NF: "Impressão NF",
  CARTA_CORRECAO: "Carta de correção",
  OUTRO_DOCUMENTO: "Outro documento",
  GESTAO_FRETE: "Gestão de frete",
  ITEM_ADICIONAL: "Item adicional",
  CONFERENCIA: "Conferência unitária",
  URGENCIA: "Urgência",
  LOGISTICA_REVERSA: "Logística reversa",
  CANCELAMENTO: "Cancelamento",
  RETIRADA: "Retirada",
  DESCARTE: "Descarte",
  RECEBIMENTO: "Recebimento",
  ARMAZENAMENTO: "Armazenagem",
  SOFTWARE: "Software",
  INTEGRACAO: "Integração",
  AD_VALOREM: "Ad valorem",
  REFRIGERADOR: "Refrigerador",
  INSUMO: "Insumo",
  DESCONTO: "Desconto",
  COBRANCA_EXTRA: "Cobrança extra",
};

// Prefixo do código curto exibido no extrato. Pedidos de expedição usam o
// numero_wms real do pedido (PED-/PDC-); o resto não tem um pedido
// associado, então cai no padrão PREFIXO-AAMM (ano+mês do lançamento).
const CODIGO_PREFIX: Record<string, string> = {
  FULFILLMENT: "PED",
  IMPRESSAO_NF: "PED",
  CARTA_CORRECAO: "CCE",
  OUTRO_DOCUMENTO: "DOC",
  GESTAO_FRETE: "PED",
  ITEM_ADICIONAL: "PED",
  URGENCIA: "PED",
  LOGISTICA_REVERSA: "PED",
  CANCELAMENTO: "PED",
  RETIRADA: "QRT",
  DESCARTE: "QRT",
  PONTO_COLETA: "PDC",
  RECEBIMENTO: "REC",
  CONFERENCIA: "REC",
  ARMAZENAMENTO: "ARM",
  SOFTWARE: "SFT",
  INTEGRACAO: "INT",
  AD_VALOREM: "ADV",
  REFRIGERADOR: "REF",
  INSUMO: "INS",
  DESCONTO: "DSC",
  COBRANCA_EXTRA: "EXT",
};

function faturaVencimento(mesAno: string): string {
  const [year, month] = mesAno.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 10));
  return next.toISOString().slice(0, 10);
}

// PostgREST caps every request at 1000 rows regardless of the requested
// limit, and a single busy month already produces more lançamentos than a
// flat .limit() used to allow — paginate via range() so the extrato never
// silently drops older rows once volume grows past one page.
async function fetchAllLancamentos(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const pageSize = 1000;
  const query = () =>
    admin
      .from("lancamentos")
      .select(
        "id, tipo_servico, valor_total, depositante_id, created_at, mes_ano, referencia_tipo, referencia_id, descricao, fatura_id, depositantes(nome)",
      )
      .eq("estornado", false)
      .order("created_at", { ascending: false });

  type Row = NonNullable<Awaited<ReturnType<typeof query>>["data"]>[number];
  const all: Row[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query().range(offset, offset + pageSize - 1);
    if (error || !data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }

  return all;
}

// A single .in() call with hundreds of UUIDs produces a request URL long
// enough to get rejected outright ("Bad Request") once the id list grows —
// this actually happened once the extrato started fetching every
// lançamento instead of just the most recent 500. Chunk it so the id-count
// ceiling moves out of reach instead of resurfacing as volume grows.
async function fetchRowsInChunks<Row>(
  ids: string[],
  chunkSize: number,
  fetchChunk: (chunk: string[]) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const { data, error } = await fetchChunk(ids.slice(i, i + chunkSize));
    if (error) continue;
    if (data) rows.push(...data);
  }
  return rows;
}

export default async function FinanceiroPage() {
  await requireModuleAccess("financeiro");

  const admin = createSupabaseAdminClient();

  const [depositantesRes, faturasRes, contratosRes, insumosRes, contasPagarRes, lancamentos] = await Promise.all([
    admin.from("depositantes").select("id, nome, ativo").eq("ativo", true).order("nome"),
    admin.from("faturas").select("*, depositantes(id, nome)").order("mes_ano", { ascending: false }),
    admin.from("contratos_cobranca").select("*, depositantes(id, nome, cnpj, logo_url)").order("created_at", { ascending: false }),
    admin.from("insumos_catalogo").select("*").order("ordem").order("nome"),
    admin.from("contas_pagar").select("*").order("vencimento", { ascending: true }),
    fetchAllLancamentos(admin),
  ]);

  const depositantes: Depositante[] = (depositantesRes.data ?? []).map((d) => ({ id: d.id, nome: d.nome }));

  const faturas: FaturaRow[] = (faturasRes.data ?? []).map((f) => ({
    id: f.id as string,
    codigo: (f as { codigo?: string | null }).codigo ?? "—",
    depId: (f.depositantes as { id?: string } | null)?.id ?? "",
    depNome: (f.depositantes as { nome?: string } | null)?.nome ?? "—",
    mesAno: f.mes_ano as string,
    status: f.status as string,
    valor: Number(f.total_a_pagar),
    vencimento: faturaVencimento(f.mes_ano as string),
    boletoUrl: (f.boleto_url as string | null) ?? null,
    boletoNome: (f.boleto_nome as string | null) ?? null,
  }));

  const faturasNfse: FaturaDocRow[] = (faturasRes.data ?? [])
    .filter((f) => f.nf_url)
    .map((f) => ({
      id: f.id as string,
      depNome: (f.depositantes as { nome?: string } | null)?.nome ?? "—",
      mesAno: f.mes_ano as string,
      status: f.status as string,
      valor: Number(f.total_a_pagar),
      docUrl: f.nf_url as string,
      docNome: f.nf_nome as string | null,
    }));

  const faturasBoletos: FaturaDocRow[] = (faturasRes.data ?? [])
    .filter((f) => f.boleto_url)
    .map((f) => ({
      id: f.id as string,
      depNome: (f.depositantes as { nome?: string } | null)?.nome ?? "—",
      mesAno: f.mes_ano as string,
      status: f.status as string,
      valor: Number(f.total_a_pagar),
      docUrl: f.boleto_url as string,
      docNome: f.boleto_nome as string | null,
    }));

  const contratos: ContratoRow[] = (contratosRes.data ?? []).map((c) => {
    const dep = c.depositantes as { id?: string; nome?: string; cnpj?: string; logo_url?: string | null } | null;
    return {
      id: c.id as string,
      depId: dep?.id ?? (c.depositante_id as string),
      depNome: dep?.nome ?? "—",
      cnpj: dep?.cnpj ?? null,
      logoUrl: dep?.logo_url ?? null,
      tipoContrato: c.tipo_contrato as string,
      responsavel: (c as { responsavel?: string | null }).responsavel ?? null,
      emailsCobranca: (c as { emails_cobranca?: string[] | null }).emails_cobranca ?? null,
      marketplacesPontoColeta: (c as { marketplaces_ponto_coleta?: string[] | null }).marketplaces_ponto_coleta ?? null,
      insumosDepositante: (c as { insumos_depositante?: string[] | null }).insumos_depositante ?? null,
      ativo: c.ativo as boolean,
      vigenciaInicio: c.vigencia_inicio as string | null,
      vigenciaFim: c.vigencia_fim as string | null,
      taxaFulfillment: Number(c.taxa_fulfillment),
      minimoFulfillment: Number(c.minimo_fulfillment),
      valorPontoColeta: Number(c.valor_ponto_coleta),
      valorImpressaoNf: Number(c.valor_impressao_nf),
      valorCartaCorrecao: Number((c as { valor_carta_correcao?: number }).valor_carta_correcao ?? 0),
      valorOutroDocumento: Number((c as { valor_outro_documento?: number }).valor_outro_documento ?? 0),
      itensInclusos: Number((c as { itens_inclusos?: number }).itens_inclusos ?? 3),
      valorItemAdicional: Number((c as { valor_item_adicional?: number }).valor_item_adicional ?? 0),
      valorUrgencia: Number((c as { valor_urgencia?: number }).valor_urgencia ?? 0),
      taxaFreteFixa: Number(c.taxa_frete_fixa),
      taxaFretePercentual: Number(c.taxa_frete_percentual),
      tarifaPosicao: Number(c.tarifa_posicao),
      tarifaRecebimento: Number(c.tarifa_recebimento),
      tarifaConferencia: Number((c as { tarifa_conferencia?: number }).tarifa_conferencia ?? 0),
      valorLogisticaReversa: Number((c as { valor_logistica_reversa?: number }).valor_logistica_reversa ?? 0),
      valorCancelamento: Number((c as { valor_cancelamento?: number }).valor_cancelamento ?? 0),
      valorCancelamentoMinimo: Number((c as { valor_cancelamento_minimo?: number }).valor_cancelamento_minimo ?? 0),
      valorRetirada: Number((c as { valor_retirada?: number }).valor_retirada ?? 0),
      valorDescarte: Number((c as { valor_descarte?: number }).valor_descarte ?? 0),
      valorIntegracaoManutencao: Number((c as { valor_integracao_manutencao?: number }).valor_integracao_manutencao ?? 0),
      taxaAdValorem: Number((c as { taxa_ad_valorem?: number }).taxa_ad_valorem ?? 0),
      valorDeclaradoEstoque: Number((c as { valor_declarado_estoque?: number }).valor_declarado_estoque ?? 0),
      valorSoftware: Number(c.valor_software),
      qtdRefrigeradores: Number(c.qtd_refrigeradores),
      valorUnitarioRefrigerador: Number(c.valor_unitario_refrigerador),
      observacoes: c.observacoes as string | null,
    };
  });

  const insumos: InsumoRow[] = (insumosRes.data ?? []).map((i) => ({
    id: i.id as string,
    nome: i.nome as string,
    sku: (i as { sku?: string | null }).sku ?? null,
    categoria: (i as { categoria?: string | null }).categoria ?? null,
    unidade: i.unidade as string,
    precoUnitario: Number(i.preco_unitario),
    estoqueInicial: Number((i as { estoque_inicial?: number }).estoque_inicial ?? 0),
    estoqueMinimo: Number((i as { estoque_minimo?: number }).estoque_minimo ?? 0),
    fornecedor: (i as { fornecedor?: string | null }).fornecedor ?? null,
    ordem: Number(i.ordem),
    ativo: i.ativo as boolean,
  }));

  const insumosCatalogoAtivo = insumos
    .filter((i) => i.ativo)
    .map((i) => ({ id: i.id, nome: i.nome, unidade: i.unidade, preco_unitario: i.precoUnitario }));

  const contasPagar: ContaPagarRow[] = (contasPagarRes.data ?? []).map((c) => ({
    id: c.id as string,
    fornecedor: c.fornecedor as string,
    descricao: c.descricao as string,
    categoria: c.categoria as string | null,
    valor: Number(c.valor),
    vencimento: c.vencimento as string,
    status: c.status as "PENDENTE" | "PAGO" | "VENCIDO",
    observacoes: c.observacoes as string | null,
  }));

  const documentoArmazenadoIds = Array.from(
    new Set(
      lancamentos
        .filter((l) => l.referencia_tipo === "DOCUMENTO_ARMAZENADO" && l.referencia_id)
        .map((l) => l.referencia_id as string),
    ),
  );
  const pedidoIdByDocumentoId = new Map<string, string>();
  if (documentoArmazenadoIds.length > 0) {
    const documentosRes = await fetchRowsInChunks(documentoArmazenadoIds, 200, (chunk) =>
      admin.from("documentos_armazenados").select("id, pedido_expedicao_id").in("id", chunk),
    );
    documentosRes.forEach((d) => {
      if (d.pedido_expedicao_id) {
        pedidoIdByDocumentoId.set(d.id as string, d.pedido_expedicao_id as string);
      }
    });
  }

  const insumoConsumoIds = Array.from(
    new Set(
      lancamentos
        .filter((l) => l.referencia_tipo === "INSUMO_CONSUMO" && l.referencia_id)
        .map((l) => l.referencia_id as string),
    ),
  );
  const pedidoIdByInsumoConsumoId = new Map<string, string>();
  if (insumoConsumoIds.length > 0) {
    const consumoRes = await fetchRowsInChunks(insumoConsumoIds, 200, (chunk) =>
      admin.from("insumo_consumo_pedidos").select("id, pedido_expedicao_id").in("id", chunk),
    );
    consumoRes.forEach((c) => {
      if (c.pedido_expedicao_id) {
        pedidoIdByInsumoConsumoId.set(c.id as string, c.pedido_expedicao_id as string);
      }
    });
  }

  const pedidoExpedicaoIds = Array.from(
    new Set([
      ...lancamentos
        .filter((l) => l.referencia_tipo === "PEDIDO_EXPEDICAO" && l.referencia_id)
        .map((l) => l.referencia_id as string),
      ...pedidoIdByDocumentoId.values(),
      ...pedidoIdByInsumoConsumoId.values(),
    ]),
  );
  const pedidoInfoById = new Map<string, { numeroWms: number | null; codigo: string }>();
  if (pedidoExpedicaoIds.length > 0) {
    const pedidosRes = await fetchRowsInChunks(pedidoExpedicaoIds, 200, (chunk) =>
      admin.from("pedidos_expedicao").select("id, numero_wms, codigo").in("id", chunk),
    );
    pedidosRes.forEach((p) =>
      pedidoInfoById.set(p.id as string, { numeroWms: p.numero_wms as number | null, codigo: p.codigo as string }),
    );
  }

  const pedidoRecebimentoIds = Array.from(
    new Set(
      lancamentos
        .filter((l) => l.referencia_tipo === "PEDIDO_RECEBIMENTO" && l.referencia_id)
        .map((l) => l.referencia_id as string),
    ),
  );
  const recebimentoCodigoById = new Map<string, string>();
  if (pedidoRecebimentoIds.length > 0) {
    const recebimentosRes = await fetchRowsInChunks(pedidoRecebimentoIds, 200, (chunk) =>
      admin.from("pedidos_recebimento").select("id, codigo").in("id", chunk),
    );
    recebimentosRes.forEach((p) => recebimentoCodigoById.set(p.id as string, p.codigo as string));
  }

  const extrato: ExtratoRow[] = lancamentos.map((l) => {
    const tipoServico = l.tipo_servico as string;
    const depNome = (l.depositantes as { nome?: string } | null)?.nome ?? null;
    const pedidoId =
      l.referencia_tipo === "PEDIDO_EXPEDICAO" && l.referencia_id
        ? (l.referencia_id as string)
        : l.referencia_tipo === "DOCUMENTO_ARMAZENADO" && l.referencia_id
          ? pedidoIdByDocumentoId.get(l.referencia_id as string)
          : l.referencia_tipo === "INSUMO_CONSUMO" && l.referencia_id
            ? pedidoIdByInsumoConsumoId.get(l.referencia_id as string)
            : undefined;
    const pedidoInfo = pedidoId ? pedidoInfoById.get(pedidoId) : undefined;
    const recebimentoCodigo =
      l.referencia_tipo === "PEDIDO_RECEBIMENTO" && l.referencia_id
        ? recebimentoCodigoById.get(l.referencia_id as string)
        : undefined;
    const codigo = pedidoInfo
      ? formatWmsOrderNumber(pedidoInfo.numeroWms, pedidoInfo.codigo, depNome)
      : (recebimentoCodigo ?? `${CODIGO_PREFIX[tipoServico] ?? "LAN"}-${(l.mes_ano as string).replace("-", "").slice(2)}`);

    return {
      id: l.id as string,
      tipo: TIPO_SERVICO_LABEL[tipoServico] ?? "Outros",
      depId: l.depositante_id as string,
      depNome: depNome ?? "—",
      descricao: (l.descricao as string | null) ?? "",
      codigo,
      data: new Date(l.created_at as string).toLocaleDateString("pt-BR"),
      dataIso: (l.created_at as string).slice(0, 10),
      valor: Number(l.valor_total),
      faturaId: (l.fatura_id as string | null) ?? null,
    };
  });

  return (
    <FinanceiroApp
      depositantes={depositantes}
      faturas={faturas}
      contratos={contratos}
      insumos={insumos}
      contasPagar={contasPagar}
      faturasNfse={faturasNfse}
      faturasBoletos={faturasBoletos}
      extrato={extrato}
      insumosCatalogoAtivo={insumosCatalogoAtivo}
    />
  );
}
