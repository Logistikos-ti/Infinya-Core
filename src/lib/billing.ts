import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TipoServico, OrigemLancamento, ReferenciaTipo } from "@/types/billing";

// ---------------------------------------------------------------------------
// Transportadoras isentas de impressão de NF
// ---------------------------------------------------------------------------
const TRANSPORTADORAS_ISENTAS = [
  "correios", "pac", "sedex", "economico", "econômico", "ecopac", "pac mini",
  "magalu", "magalulog",
  "jadlog",
];

function isTransportadoraIsenta(nome: string | null): boolean {
  if (!nome || nome.trim() === "") return true;
  const lower = nome.toLowerCase();
  return TRANSPORTADORAS_ISENTAS.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMesAno(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

type ContratoRow = {
  id: string;
  depositante_id: string;
  taxa_fulfillment: number;
  minimo_fulfillment: number;
  tarifa_posicao: number;
  valor_ponto_coleta: number;
  marketplaces_ponto_coleta: string[];
  valor_impressao_nf: number;
  taxa_frete_fixa: number;
  taxa_frete_percentual: number;
  tarifa_recebimento: number;
  valor_software: number;
  qtd_refrigeradores: number;
  valor_unitario_refrigerador: number;
  tipo_contrato: string;
  ativo: boolean;
};

async function getContratoAtivo(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  depositanteId: string,
): Promise<ContratoRow | null> {
  const { data } = await admin
    .from("contratos_cobranca")
    .select("*")
    .eq("depositante_id", depositanteId)
    .eq("ativo", true)
    .single();
  return data as ContratoRow | null;
}

function contratoSnapshot(contrato: ContratoRow): Record<string, unknown> {
  return {
    id: contrato.id,
    taxa_fulfillment: contrato.taxa_fulfillment,
    minimo_fulfillment: contrato.minimo_fulfillment,
    tarifa_posicao: contrato.tarifa_posicao,
    valor_ponto_coleta: contrato.valor_ponto_coleta,
    valor_impressao_nf: contrato.valor_impressao_nf,
    taxa_frete_fixa: contrato.taxa_frete_fixa,
    taxa_frete_percentual: contrato.taxa_frete_percentual,
    tarifa_recebimento: contrato.tarifa_recebimento,
    valor_logistica_reversa: (contrato as ContratoRow & { valor_logistica_reversa?: number }).valor_logistica_reversa ?? 0,
    tipo_contrato: contrato.tipo_contrato,
  };
}

type LancamentoInsert = {
  depositante_id: string;
  fatura_id: string;
  mes_ano: string;
  tipo_servico: TipoServico;
  origem: OrigemLancamento;
  referencia_tipo: ReferenciaTipo;
  referencia_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  memoria_calculo: Record<string, unknown>;
  contrato_snapshot: Record<string, unknown>;
};

async function inserirLancamentos(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  lancamentos: LancamentoInsert[],
): Promise<number> {
  if (!lancamentos.length) return 0;

  const { data } = await admin
    .from("lancamentos")
    .upsert(lancamentos, { onConflict: "depositante_id,tipo_servico,referencia_tipo,referencia_id", ignoreDuplicates: true })
    .select("id");

  return data?.length ?? 0;
}

async function recalcularFatura(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  faturaId: string,
): Promise<void> {
  await admin.rpc("recalcular_totais_fatura", { p_fatura_id: faturaId });
}

// ---------------------------------------------------------------------------
// Cobrança: Pedido de Expedição (EXPEDIDO)
// ---------------------------------------------------------------------------

export async function registrarLancamentosExpedicao(
  pedidoIds: string[],
  romaneioId?: string | null,
): Promise<{ total: number; erros: string[] }> {
  const admin = createSupabaseAdminClient();
  let totalInseridos = 0;
  const erros: string[] = [];

  const { data: pedidos } = await admin
    .from("pedidos_expedicao")
    .select("id, depositante_id, codigo, canal, valor_total, quantidade_itens")
    .in("id", pedidoIds);

  if (!pedidos?.length) return { total: 0, erros: ["Nenhum pedido encontrado."] };

  let transportadoraNome: string | null = null;
  if (romaneioId) {
    const { data: romaneio } = await admin
      .from("romaneios_carga")
      .select("id, codigo, transportadora_nome")
      .eq("id", romaneioId)
      .single();
    transportadoraNome = romaneio?.transportadora_nome ?? null;
  }

  const depositanteIds = [...new Set(pedidos.map((p) => p.depositante_id))];

  for (const depositanteId of depositanteIds) {
    const contrato = await getContratoAtivo(admin, depositanteId);
    if (!contrato) {
      erros.push(`Depositante ${depositanteId}: sem contrato ativo.`);
      continue;
    }

    const isConsignado = contrato.tipo_contrato === "consignado";
    const pedidosDepo = pedidos.filter((p) => p.depositante_id === depositanteId);
    const mesAno = getMesAno();

    const { data: faturaIdResult } = await admin.rpc("garantir_ou_criar_fatura", {
      p_depositante_id: depositanteId,
      p_mes_ano: mesAno,
    });
    const faturaId = faturaIdResult as string;
    if (!faturaId) {
      erros.push(`Depositante ${depositanteId}: falha ao criar fatura.`);
      continue;
    }

    const snapshot = contratoSnapshot(contrato);
    const lancamentos: LancamentoInsert[] = [];

    for (const pedido of pedidosDepo) {
      const valorNf = Number(pedido.valor_total) || 0;
      const canal = (pedido.canal ?? "").toLowerCase();

      // Fulfillment
      if (!isConsignado) {
        const valorPercentual = valorNf * Number(contrato.taxa_fulfillment);
        const valorFulfillment = roundCurrency(
          Math.max(Number(contrato.minimo_fulfillment), valorPercentual),
        );

        lancamentos.push({
          depositante_id: depositanteId,
          fatura_id: faturaId,
          mes_ano: mesAno,
          tipo_servico: "FULFILLMENT",
          origem: "AUTOMATICO",
          referencia_tipo: "PEDIDO_EXPEDICAO",
          referencia_id: pedido.id,
          descricao: `Fulfillment pedido ${pedido.codigo}`,
          quantidade: 1,
          valor_unitario: valorFulfillment,
          valor_total: valorFulfillment,
          memoria_calculo: {
            valor_nf: valorNf,
            taxa: Number(contrato.taxa_fulfillment),
            percentual: roundCurrency(valorPercentual),
            minimo: Number(contrato.minimo_fulfillment),
            resultado: valorFulfillment,
            formula: "MAX(minimo, valor_nf * taxa)",
          },
          contrato_snapshot: snapshot,
        });
      }

      // Ponto de coleta
      if (!isConsignado) {
        const marketplaces = contrato.marketplaces_ponto_coleta ?? [];
        const isPontoColeta = marketplaces.some((kw) => canal.includes(kw.toLowerCase()));

        if (isPontoColeta) {
          const valor = Number(contrato.valor_ponto_coleta);
          lancamentos.push({
            depositante_id: depositanteId,
            fatura_id: faturaId,
            mes_ano: mesAno,
            tipo_servico: "PONTO_COLETA",
            origem: "AUTOMATICO",
            referencia_tipo: "PEDIDO_EXPEDICAO",
            referencia_id: pedido.id,
            descricao: `Ponto de coleta ${pedido.codigo} (${pedido.canal})`,
            quantidade: 1,
            valor_unitario: valor,
            valor_total: valor,
            memoria_calculo: { canal: pedido.canal, marketplaces },
            contrato_snapshot: snapshot,
          });
        }
      }

      // Impressão NF
      if (!isConsignado && !isTransportadoraIsenta(transportadoraNome)) {
        const valor = Number(contrato.valor_impressao_nf);
        lancamentos.push({
          depositante_id: depositanteId,
          fatura_id: faturaId,
          mes_ano: mesAno,
          tipo_servico: "IMPRESSAO_NF",
          origem: "AUTOMATICO",
          referencia_tipo: "PEDIDO_EXPEDICAO",
          referencia_id: pedido.id,
          descricao: `Impressão NF pedido ${pedido.codigo}`,
          quantidade: 1,
          valor_unitario: valor,
          valor_total: valor,
          memoria_calculo: { transportadora: transportadoraNome },
          contrato_snapshot: snapshot,
        });
      }

      // Gestão de frete
      if (!isConsignado && Number(contrato.taxa_frete_fixa) > 0) {
        const freteFixo = Number(contrato.taxa_frete_fixa);
        const fretePerc = roundCurrency(valorNf * Number(contrato.taxa_frete_percentual));
        const totalFrete = roundCurrency(freteFixo + fretePerc);

        lancamentos.push({
          depositante_id: depositanteId,
          fatura_id: faturaId,
          mes_ano: mesAno,
          tipo_servico: "GESTAO_FRETE",
          origem: "AUTOMATICO",
          referencia_tipo: "PEDIDO_EXPEDICAO",
          referencia_id: pedido.id,
          descricao: `Gestão de frete pedido ${pedido.codigo}`,
          quantidade: 1,
          valor_unitario: totalFrete,
          valor_total: totalFrete,
          memoria_calculo: {
            valor_nf: valorNf,
            frete_fixo: freteFixo,
            frete_percentual: fretePerc,
            taxa_percentual: Number(contrato.taxa_frete_percentual),
          },
          contrato_snapshot: snapshot,
        });
      }
    }

    const inseridos = await inserirLancamentos(admin, lancamentos);
    totalInseridos += inseridos;

    await recalcularFatura(admin, faturaId);
  }

  return { total: totalInseridos, erros };
}

// ---------------------------------------------------------------------------
// Cobrança: Pedido de Recebimento (RECEBIDO)
// ---------------------------------------------------------------------------

export async function registrarLancamentoRecebimento(
  pedidoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const admin = createSupabaseAdminClient();

  const { data: pedido } = await admin
    .from("pedidos_recebimento")
    .select("id, depositante_id, codigo, status")
    .eq("id", pedidoId)
    .single();

  if (!pedido) return { ok: false, erro: "Pedido nao encontrado." };

  const contrato = await getContratoAtivo(admin, pedido.depositante_id);
  if (!contrato) return { ok: false, erro: "Sem contrato ativo." };
  if (contrato.tipo_contrato === "consignado") return { ok: true };
  if (Number(contrato.tarifa_recebimento) <= 0) return { ok: true };

  const mesAno = getMesAno();

  const { data: faturaId } = await admin.rpc("garantir_ou_criar_fatura", {
    p_depositante_id: pedido.depositante_id,
    p_mes_ano: mesAno,
  });

  if (!faturaId) return { ok: false, erro: "Falha ao criar fatura." };

  const { data: itens } = await admin
    .from("pedidos_recebimento_itens")
    .select("quantidade_recebida")
    .eq("pedido_recebimento_id", pedidoId);

  const totalUnidades = (itens ?? []).reduce(
    (sum, i) => sum + (Number(i.quantidade_recebida) || 0),
    0,
  );

  const tarifa = Number(contrato.tarifa_recebimento);
  const valorTotal = roundCurrency(totalUnidades * tarifa);

  const lancamento: LancamentoInsert = {
    depositante_id: pedido.depositante_id,
    fatura_id: faturaId as string,
    mes_ano: mesAno,
    tipo_servico: "RECEBIMENTO",
    origem: "AUTOMATICO",
    referencia_tipo: "PEDIDO_RECEBIMENTO",
    referencia_id: pedido.id,
    descricao: `Recebimento pedido ${pedido.codigo} (${totalUnidades} un)`,
    quantidade: totalUnidades,
    valor_unitario: tarifa,
    valor_total: valorTotal,
    memoria_calculo: {
      total_unidades: totalUnidades,
      tarifa_por_unidade: tarifa,
    },
    contrato_snapshot: contratoSnapshot(contrato),
  };

  await inserirLancamentos(admin, [lancamento]);
  await recalcularFatura(admin, faturaId as string);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cron: Snapshot diário de armazenamento
// ---------------------------------------------------------------------------

export async function registrarSnapshotArmazenamento(): Promise<{ ok: boolean; count: number }> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.rpc("snapshot_armazenamento_diario", { p_data: new Date().toISOString().slice(0, 10) });
  return { ok: true, count: (data as number) ?? 0 };
}

// ---------------------------------------------------------------------------
// Cron: Fechamento mensal (último dia do mês)
// ---------------------------------------------------------------------------

export async function fecharFaturasMensais(
  mesAno?: string,
): Promise<{ fechadas: number; erros: string[] }> {
  const admin = createSupabaseAdminClient();
  const mes = mesAno ?? getMesAnoAnterior();
  const erros: string[] = [];
  let fechadas = 0;

  const { data: faturas } = await admin
    .from("faturas")
    .select("id, depositante_id, mes_ano")
    .eq("mes_ano", mes)
    .eq("status", "ABERTA");

  if (!faturas?.length) return { fechadas: 0, erros: [] };

  for (const fatura of faturas) {
    const contrato = await getContratoAtivo(admin, fatura.depositante_id);
    if (!contrato) {
      erros.push(`Depositante ${fatura.depositante_id}: sem contrato.`);
      continue;
    }

    const snapshot = contratoSnapshot(contrato);

    // Armazenamento: pico do mês
    const { data: picoRows } = await admin
      .from("armazenamento_diario")
      .select("qtd_posicoes_ocupadas")
      .eq("depositante_id", fatura.depositante_id)
      .like("data", `${mes}%`)
      .order("qtd_posicoes_ocupadas", { ascending: false })
      .limit(1);

    const picoPositions = picoRows?.[0]?.qtd_posicoes_ocupadas ?? 0;

    if (picoPositions > 0) {
      const tarifa = Number(contrato.tarifa_posicao);
      const valorArmazenamento = roundCurrency(picoPositions * tarifa);

      await inserirLancamentos(admin, [{
        depositante_id: fatura.depositante_id,
        fatura_id: fatura.id,
        mes_ano: mes,
        tipo_servico: "ARMAZENAMENTO",
        origem: "CRON",
        referencia_tipo: "SNAPSHOT_ARMAZENAMENTO",
        referencia_id: `${fatura.depositante_id}-${mes}`,
        descricao: `Armazenamento ${mes} (pico: ${picoPositions} posições)`,
        quantidade: picoPositions,
        valor_unitario: tarifa,
        valor_total: valorArmazenamento,
        memoria_calculo: {
          pico_posicoes: picoPositions,
          tarifa_posicao: tarifa,
        },
        contrato_snapshot: snapshot,
      }]);
    }

    // Software
    const valorSoftware = Number(contrato.valor_software);
    if (valorSoftware > 0) {
      await inserirLancamentos(admin, [{
        depositante_id: fatura.depositante_id,
        fatura_id: fatura.id,
        mes_ano: mes,
        tipo_servico: "SOFTWARE",
        origem: "CRON",
        referencia_tipo: "SNAPSHOT_ARMAZENAMENTO",
        referencia_id: `software-${fatura.depositante_id}-${mes}`,
        descricao: `Taxa de software ${mes}`,
        quantidade: 1,
        valor_unitario: valorSoftware,
        valor_total: valorSoftware,
        memoria_calculo: {},
        contrato_snapshot: snapshot,
      }]);
    }

    // Refrigerador
    const qtdRefrig = contrato.qtd_refrigeradores ?? 0;
    const valorUnitRefrig = Number(contrato.valor_unitario_refrigerador);
    if (qtdRefrig > 0 && valorUnitRefrig > 0) {
      const totalRefrig = roundCurrency(qtdRefrig * valorUnitRefrig);
      await inserirLancamentos(admin, [{
        depositante_id: fatura.depositante_id,
        fatura_id: fatura.id,
        mes_ano: mes,
        tipo_servico: "REFRIGERADOR",
        origem: "CRON",
        referencia_tipo: "SNAPSHOT_ARMAZENAMENTO",
        referencia_id: `refrig-${fatura.depositante_id}-${mes}`,
        descricao: `Refrigeração ${mes} (${qtdRefrig}x)`,
        quantidade: qtdRefrig,
        valor_unitario: valorUnitRefrig,
        valor_total: totalRefrig,
        memoria_calculo: { qtd: qtdRefrig, valor_unitario: valorUnitRefrig },
        contrato_snapshot: snapshot,
      }]);
    }

    // Recalcular totais e fechar
    await recalcularFatura(admin, fatura.id);

    await admin
      .from("faturas")
      .update({
        status: "FECHADA",
        fechado_em: new Date().toISOString(),
      })
      .eq("id", fatura.id);

    fechadas++;
  }

  return { fechadas, erros };
}

function getMesAnoAnterior(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return getMesAno(d);
}

// ---------------------------------------------------------------------------
// Cobrança: Logística Reversa (NF-e de devolução aceita)
// ---------------------------------------------------------------------------

export async function registrarLancamentoLogisticaReversa(
  pedidoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const admin = createSupabaseAdminClient();

  const { data: pedido } = await admin
    .from("pedidos_expedicao")
    .select("id, depositante_id, codigo, quantidade_itens")
    .eq("id", pedidoId)
    .single();

  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  const contrato = await getContratoAtivo(admin, pedido.depositante_id);
  if (!contrato) return { ok: false, erro: "Sem contrato ativo." };
  if (contrato.tipo_contrato === "consignado") return { ok: true };

  const valorUnitario = Number((contrato as ContratoRow & { valor_logistica_reversa?: number }).valor_logistica_reversa ?? 0);
  if (valorUnitario <= 0) return { ok: true };

  const mesAno = getMesAno();

  const { data: faturaId } = await admin.rpc("garantir_ou_criar_fatura", {
    p_depositante_id: pedido.depositante_id,
    p_mes_ano: mesAno,
  });

  if (!faturaId) return { ok: false, erro: "Falha ao criar fatura." };

  const { data: itens } = await admin
    .from("pedidos_expedicao_itens")
    .select("quantidade")
    .eq("pedido_expedicao_id", pedidoId);

  const totalUnidades = (itens ?? []).reduce(
    (sum, i) => sum + (Number(i.quantidade) || 0),
    0,
  );

  const quantidade = totalUnidades || 1;
  const valorTotal = roundCurrency(quantidade * valorUnitario);

  const lancamento: LancamentoInsert = {
    depositante_id: pedido.depositante_id,
    fatura_id: faturaId as string,
    mes_ano: mesAno,
    tipo_servico: "LOGISTICA_REVERSA",
    origem: "AUTOMATICO",
    referencia_tipo: "PEDIDO_EXPEDICAO",
    referencia_id: pedido.id,
    descricao: `Logística reversa pedido ${pedido.codigo} (${quantidade} un)`,
    quantidade,
    valor_unitario: valorUnitario,
    valor_total: valorTotal,
    memoria_calculo: {
      total_unidades: quantidade,
      valor_unitario: valorUnitario,
    },
    contrato_snapshot: contratoSnapshot(contrato),
  };

  await inserirLancamentos(admin, [lancamento]);
  await recalcularFatura(admin, faturaId as string);

  return { ok: true };
}
