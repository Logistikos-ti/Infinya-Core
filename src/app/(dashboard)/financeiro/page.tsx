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

// Rótulo do selo na 1ª coluna do extrato — um por tipo_servico, não mais
// agrupado por categoria ampla (senão fulfillment/ponto de coleta/impressão
// NF ficavam todos indistinguíveis como "Expedição").
const TIPO_SERVICO_LABEL: Record<string, string> = {
  FULFILLMENT: "Fulfillment",
  PONTO_COLETA: "Ponto de coleta",
  IMPRESSAO_NF: "Impressão NF",
  GESTAO_FRETE: "Gestão de frete",
  LOGISTICA_REVERSA: "Logística reversa",
  RECEBIMENTO: "Recebimento",
  ARMAZENAMENTO: "Armazenagem",
  SOFTWARE: "Software",
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
  GESTAO_FRETE: "PED",
  LOGISTICA_REVERSA: "PED",
  PONTO_COLETA: "PDC",
  RECEBIMENTO: "REC",
  ARMAZENAMENTO: "ARM",
  SOFTWARE: "SFT",
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

export default async function FinanceiroPage() {
  await requireModuleAccess("financeiro");

  const admin = createSupabaseAdminClient();

  const [depositantesRes, faturasRes, contratosRes, insumosRes, contasPagarRes, lancamentosRes] = await Promise.all([
    admin.from("depositantes").select("id, nome, ativo").eq("ativo", true).order("nome"),
    admin.from("faturas").select("*, depositantes(id, nome)").order("mes_ano", { ascending: false }),
    admin.from("contratos_cobranca").select("*, depositantes(id, nome, cnpj, logo_url)").order("created_at", { ascending: false }),
    admin.from("insumos_catalogo").select("*").order("ordem").order("nome"),
    admin.from("contas_pagar").select("*").order("vencimento", { ascending: true }),
    admin
      .from("lancamentos")
      .select("id, tipo_servico, valor_total, depositante_id, created_at, mes_ano, referencia_tipo, referencia_id, descricao, depositantes(nome)")
      .eq("estornado", false)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const depositantes: Depositante[] = (depositantesRes.data ?? []).map((d) => ({ id: d.id, nome: d.nome }));

  const faturas: FaturaRow[] = (faturasRes.data ?? []).map((f) => ({
    id: f.id as string,
    depId: (f.depositantes as { id?: string } | null)?.id ?? "",
    depNome: (f.depositantes as { nome?: string } | null)?.nome ?? "—",
    mesAno: f.mes_ano as string,
    status: f.status as string,
    valor: Number(f.total_a_pagar),
    vencimento: faturaVencimento(f.mes_ano as string),
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
      ativo: c.ativo as boolean,
      vigenciaInicio: c.vigencia_inicio as string | null,
      vigenciaFim: c.vigencia_fim as string | null,
      taxaFulfillment: Number(c.taxa_fulfillment),
      minimoFulfillment: Number(c.minimo_fulfillment),
      valorPontoColeta: Number(c.valor_ponto_coleta),
      valorImpressaoNf: Number(c.valor_impressao_nf),
      taxaFreteFixa: Number(c.taxa_frete_fixa),
      taxaFretePercentual: Number(c.taxa_frete_percentual),
      tarifaPosicao: Number(c.tarifa_posicao),
      tarifaRecebimento: Number(c.tarifa_recebimento),
      valorLogisticaReversa: Number((c as { valor_logistica_reversa?: number }).valor_logistica_reversa ?? 0),
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

  const pedidoExpedicaoIds = Array.from(
    new Set(
      (lancamentosRes.data ?? [])
        .filter((l) => l.referencia_tipo === "PEDIDO_EXPEDICAO" && l.referencia_id)
        .map((l) => l.referencia_id as string),
    ),
  );
  const numeroWmsPorPedido = new Map<string, number>();
  if (pedidoExpedicaoIds.length > 0) {
    const { data: pedidosRes } = await admin
      .from("pedidos_expedicao")
      .select("id, numero_wms")
      .in("id", pedidoExpedicaoIds);
    (pedidosRes ?? []).forEach((p) => numeroWmsPorPedido.set(p.id as string, p.numero_wms as number));
  }

  const extrato: ExtratoRow[] = (lancamentosRes.data ?? []).map((l) => {
    const tipoServico = l.tipo_servico as string;
    const prefixo = CODIGO_PREFIX[tipoServico] ?? "LAN";
    const numeroWms =
      l.referencia_tipo === "PEDIDO_EXPEDICAO" && l.referencia_id
        ? numeroWmsPorPedido.get(l.referencia_id as string)
        : undefined;
    const codigo =
      numeroWms !== undefined ? `${prefixo}-${numeroWms}` : `${prefixo}-${(l.mes_ano as string).replace("-", "").slice(2)}`;

    return {
      id: l.id as string,
      tipo: TIPO_SERVICO_LABEL[tipoServico] ?? "Outros",
      depNome: (l.depositantes as { nome?: string } | null)?.nome ?? "—",
      codigo,
      data: new Date(l.created_at as string).toLocaleDateString("pt-BR"),
      valor: Number(l.valor_total),
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
