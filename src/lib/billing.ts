import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TipoServico, OrigemLancamento, ReferenciaTipo } from "@/types/billing";

// ---------------------------------------------------------------------------
// Transportadoras isentas de impressão de NF: logística própria de
// marketplace (o canal já cuida da etiqueta) + Correios e Mandaê. Qualquer
// outra transportadora (Jadlog, transportadora própria etc.) cobra a tarifa
// configurada no contrato.
// ---------------------------------------------------------------------------
const TRANSPORTADORAS_ISENTAS = [
  "mercado livre", "meli", "shopee", "amazon", "magalu", "magazine luiza",
  "shein", "tiktok", "kwai", "olist",
  "correios", "mandae", "mandaê",
];

function isTransportadoraIsenta(nome: string | null): boolean {
  if (!nome || nome.trim() === "") return false;
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
  valor_carta_correcao: number;
  valor_outro_documento: number;
  itens_inclusos: number;
  valor_item_adicional: number;
  taxa_frete_fixa: number;
  taxa_frete_percentual: number;
  tarifa_recebimento: number;
  tarifa_conferencia: number;
  valor_cancelamento: number;
  valor_cancelamento_minimo: number;
  valor_retirada: number;
  valor_descarte: number;
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
    valor_carta_correcao: contrato.valor_carta_correcao,
    valor_outro_documento: contrato.valor_outro_documento,
    itens_inclusos: contrato.itens_inclusos,
    valor_item_adicional: contrato.valor_item_adicional,
    taxa_frete_fixa: contrato.taxa_frete_fixa,
    taxa_frete_percentual: contrato.taxa_frete_percentual,
    tarifa_recebimento: contrato.tarifa_recebimento,
    tarifa_conferencia: contrato.tarifa_conferencia,
    valor_logistica_reversa: (contrato as ContratoRow & { valor_logistica_reversa?: number }).valor_logistica_reversa ?? 0,
    valor_cancelamento: contrato.valor_cancelamento,
    valor_cancelamento_minimo: contrato.valor_cancelamento_minimo,
    valor_retirada: contrato.valor_retirada,
    valor_descarte: contrato.valor_descarte,
    tipo_contrato: contrato.tipo_contrato,
  };
}

export type InsumoConsumoOption = { id: string; nome: string; unidade: string };

export async function getInsumoConsumoOptions(
  depositanteId: string,
  pedidoId: string,
): Promise<{ catalogoGalpao: InsumoConsumoOption[]; insumosDepositante: string[]; jaRespondido: boolean }> {
  const admin = createSupabaseAdminClient();

  const [{ data: catalogoRows }, { data: contratoRow }, { data: consumoRows }] = await Promise.all([
    admin
      .from("insumos_catalogo")
      .select("id, nome, unidade")
      .eq("ativo", true)
      .order("ordem")
      .order("nome"),
    admin
      .from("contratos_cobranca")
      .select("insumos_depositante")
      .eq("depositante_id", depositanteId)
      .eq("ativo", true)
      .maybeSingle(),
    admin
      .from("insumo_consumo_pedidos")
      .select("id")
      .eq("pedido_expedicao_id", pedidoId)
      .limit(1),
  ]);

  return {
    catalogoGalpao: (catalogoRows ?? []).map((i) => ({ id: i.id as string, nome: i.nome as string, unidade: i.unidade as string })),
    insumosDepositante: (contratoRow?.insumos_depositante as string[] | null) ?? [],
    jaRespondido: (consumoRows?.length ?? 0) > 0,
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
): Promise<{ count: number; erro?: string }> {
  if (!lancamentos.length) return { count: 0 };

  const { data, error } = await admin
    .from("lancamentos")
    .upsert(lancamentos, { onConflict: "depositante_id,tipo_servico,referencia_tipo,referencia_id", ignoreDuplicates: true })
    .select("id");

  if (error) return { count: 0, erro: error.message };
  return { count: data?.length ?? 0 };
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
): Promise<{ total: number; erros: string[] }> {
  const admin = createSupabaseAdminClient();
  let totalInseridos = 0;
  const erros: string[] = [];

  const { data: pedidos } = await admin
    .from("pedidos_expedicao")
    .select("id, depositante_id, codigo, canal, valor_total, quantidade_itens, quantidade_unidades, payload_origem")
    .in("id", pedidoIds);

  if (!pedidos?.length) return { total: 0, erros: ["Nenhum pedido encontrado."] };

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
      const transportadoraPedido =
        ((pedido.payload_origem as Record<string, unknown> | null)?.transportadora as string | undefined) ?? null;

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

      // Impressão NF — cobra sempre que a transportadora do pedido não for
      // a logística própria de um marketplace (que já cuida da etiqueta).
      if (!isConsignado && !isTransportadoraIsenta(transportadoraPedido)) {
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
          memoria_calculo: { transportadora: transportadoraPedido },
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

      // Item adicional no pedido — cobra por unidade além das inclusas na
      // expedição base (planilha: "Expedição B2C incluída até N itens").
      if (!isConsignado && Number(contrato.valor_item_adicional) > 0) {
        const unidades = Number(pedido.quantidade_unidades) || 0;
        const inclusos = Number(contrato.itens_inclusos) || 0;
        const adicionais = Math.max(0, unidades - inclusos);

        if (adicionais > 0) {
          const valorUnit = Number(contrato.valor_item_adicional);
          const totalAdicional = roundCurrency(adicionais * valorUnit);
          lancamentos.push({
            depositante_id: depositanteId,
            fatura_id: faturaId,
            mes_ano: mesAno,
            tipo_servico: "ITEM_ADICIONAL",
            origem: "AUTOMATICO",
            referencia_tipo: "PEDIDO_EXPEDICAO",
            referencia_id: pedido.id,
            descricao: `Itens adicionais pedido ${pedido.codigo} (${adicionais} un)`,
            quantidade: adicionais,
            valor_unitario: valorUnit,
            valor_total: totalAdicional,
            memoria_calculo: {
              unidades,
              itens_inclusos: inclusos,
              adicionais,
              valor_unitario: valorUnit,
            },
            contrato_snapshot: snapshot,
          });
        }
      }
    }

    const { count, erro } = await inserirLancamentos(admin, lancamentos);
    totalInseridos += count;
    if (erro) erros.push(`Depositante ${depositanteId}: ${erro}`);

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

  const tarifaRecebimento = Number(contrato.tarifa_recebimento);
  const tarifaConferencia = Number(contrato.tarifa_conferencia);
  // Recebimento e conferência unitária são cobranças separadas (planilha):
  // se nenhuma das duas tem tarifa, não há o que cobrar.
  if (tarifaRecebimento <= 0 && tarifaConferencia <= 0) return { ok: true };

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

  const snapshot = contratoSnapshot(contrato);
  const lancamentos: LancamentoInsert[] = [];

  if (tarifaRecebimento > 0) {
    lancamentos.push({
      depositante_id: pedido.depositante_id,
      fatura_id: faturaId as string,
      mes_ano: mesAno,
      tipo_servico: "RECEBIMENTO",
      origem: "AUTOMATICO",
      referencia_tipo: "PEDIDO_RECEBIMENTO",
      referencia_id: pedido.id,
      descricao: `Recebimento pedido ${pedido.codigo} (${totalUnidades} un)`,
      quantidade: totalUnidades,
      valor_unitario: tarifaRecebimento,
      valor_total: roundCurrency(totalUnidades * tarifaRecebimento),
      memoria_calculo: {
        total_unidades: totalUnidades,
        tarifa_por_unidade: tarifaRecebimento,
      },
      contrato_snapshot: snapshot,
    });
  }

  if (tarifaConferencia > 0 && totalUnidades > 0) {
    lancamentos.push({
      depositante_id: pedido.depositante_id,
      fatura_id: faturaId as string,
      mes_ano: mesAno,
      tipo_servico: "CONFERENCIA",
      origem: "AUTOMATICO",
      referencia_tipo: "PEDIDO_RECEBIMENTO",
      referencia_id: pedido.id,
      descricao: `Conferência unitária pedido ${pedido.codigo} (${totalUnidades} un)`,
      quantidade: totalUnidades,
      valor_unitario: tarifaConferencia,
      valor_total: roundCurrency(totalUnidades * tarifaConferencia),
      memoria_calculo: {
        total_unidades: totalUnidades,
        tarifa_por_unidade: tarifaConferencia,
      },
      contrato_snapshot: snapshot,
    });
  }

  const { erro: insertErro } = await inserirLancamentos(admin, lancamentos);
  if (insertErro) return { ok: false, erro: insertErro };
  await recalcularFatura(admin, faturaId as string);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cobrança: Documento anexado (Carta de Correção / Outro documento)
// ---------------------------------------------------------------------------

export async function registrarLancamentoDocumento(
  documentoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const admin = createSupabaseAdminClient();

  const { data: documento } = await admin
    .from("documentos_armazenados")
    .select("id, depositante_id, tipo, nome_arquivo")
    .eq("id", documentoId)
    .single();

  if (!documento) return { ok: false, erro: "Documento não encontrado." };

  const tipoServico: TipoServico | null =
    documento.tipo === "CARTA_CORRECAO" || documento.tipo === "CCE"
      ? "CARTA_CORRECAO"
      : documento.tipo === "OUTRO" || documento.tipo === "DOCUMENTO_ADICIONAL"
        ? "OUTRO_DOCUMENTO"
        : null;

  if (!tipoServico) return { ok: true };

  const contrato = await getContratoAtivo(admin, documento.depositante_id);
  if (!contrato) return { ok: false, erro: "Sem contrato ativo." };
  if (contrato.tipo_contrato === "consignado") return { ok: true };

  const valor =
    tipoServico === "CARTA_CORRECAO" ? Number(contrato.valor_carta_correcao) : Number(contrato.valor_outro_documento);
  if (valor <= 0) return { ok: true };

  const mesAno = getMesAno();

  const { data: faturaId } = await admin.rpc("garantir_ou_criar_fatura", {
    p_depositante_id: documento.depositante_id,
    p_mes_ano: mesAno,
  });

  if (!faturaId) return { ok: false, erro: "Falha ao criar fatura." };

  const lancamento: LancamentoInsert = {
    depositante_id: documento.depositante_id,
    fatura_id: faturaId as string,
    mes_ano: mesAno,
    tipo_servico: tipoServico,
    origem: "AUTOMATICO",
    referencia_tipo: "DOCUMENTO_ARMAZENADO",
    referencia_id: documento.id,
    descricao: `${tipoServico === "CARTA_CORRECAO" ? "Carta de correção" : "Outro documento"}: ${documento.nome_arquivo}`,
    quantidade: 1,
    valor_unitario: valor,
    valor_total: valor,
    memoria_calculo: { tipo_documento: documento.tipo },
    contrato_snapshot: contratoSnapshot(contrato),
  };

  const { erro: insertErro } = await inserirLancamentos(admin, [lancamento]);
  if (insertErro) return { ok: false, erro: insertErro };
  await recalcularFatura(admin, faturaId as string);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cobrança: Consumo de insumo do galpão (registrado na conferência)
// ---------------------------------------------------------------------------

export async function registrarLancamentoInsumoConsumo(
  consumoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const admin = createSupabaseAdminClient();

  const { data: consumo } = await admin
    .from("insumo_consumo_pedidos")
    .select("id, pedido_expedicao_id, depositante_id, origem, insumo_catalogo_id, quantidade")
    .eq("id", consumoId)
    .single();

  if (!consumo) return { ok: false, erro: "Registro de consumo não encontrado." };
  if (consumo.origem !== "GALPAO" || !consumo.insumo_catalogo_id) return { ok: true };

  const { data: insumo } = await admin
    .from("insumos_catalogo")
    .select("id, nome, unidade, preco_unitario")
    .eq("id", consumo.insumo_catalogo_id)
    .single();

  if (!insumo) return { ok: false, erro: "Insumo não encontrado no catálogo." };

  const contrato = await getContratoAtivo(admin, consumo.depositante_id);
  if (!contrato) return { ok: false, erro: "Sem contrato ativo." };
  if (contrato.tipo_contrato === "consignado") return { ok: true };

  const quantidade = Number(consumo.quantidade) || 0;
  if (quantidade <= 0) return { ok: false, erro: "Quantidade inválida." };

  const valorUnitario = Number(insumo.preco_unitario);
  const valorTotal = roundCurrency(quantidade * valorUnitario);
  const mesAno = getMesAno();

  const { data: faturaId } = await admin.rpc("garantir_ou_criar_fatura", {
    p_depositante_id: consumo.depositante_id,
    p_mes_ano: mesAno,
  });

  if (!faturaId) return { ok: false, erro: "Falha ao criar fatura." };

  const lancamento: LancamentoInsert = {
    depositante_id: consumo.depositante_id,
    fatura_id: faturaId as string,
    mes_ano: mesAno,
    tipo_servico: "INSUMO",
    origem: "AUTOMATICO",
    referencia_tipo: "INSUMO_CONSUMO",
    referencia_id: consumo.id,
    descricao: `${insumo.nome} (${quantidade} ${insumo.unidade})`,
    quantidade,
    valor_unitario: valorUnitario,
    valor_total: valorTotal,
    memoria_calculo: { insumo_id: insumo.id, quantidade, preco_unitario: valorUnitario },
    contrato_snapshot: contratoSnapshot(contrato),
  };

  const { erro: insertErro, count } = await inserirLancamentos(admin, [lancamento]);
  if (insertErro) return { ok: false, erro: insertErro };

  if (count > 0) {
    const { data: lancamentoRow } = await admin
      .from("lancamentos")
      .select("id")
      .eq("referencia_tipo", "INSUMO_CONSUMO")
      .eq("referencia_id", consumo.id)
      .single();

    if (lancamentoRow) {
      await admin.from("insumo_consumo_pedidos").update({ lancamento_id: lancamentoRow.id }).eq("id", consumo.id);
    }
  }

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
  const mes = mesAno ?? getMesAno();
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

      const { erro: erroArmazenamento } = await inserirLancamentos(admin, [{
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
      if (erroArmazenamento) {
        erros.push(`Depositante ${fatura.depositante_id}: armazenamento - ${erroArmazenamento}`);
      }
    }

    // Software
    const valorSoftware = Number(contrato.valor_software);
    if (valorSoftware > 0) {
      const { erro: erroSoftware } = await inserirLancamentos(admin, [{
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
      if (erroSoftware) {
        erros.push(`Depositante ${fatura.depositante_id}: software - ${erroSoftware}`);
      }
    }

    // Refrigerador
    const qtdRefrig = contrato.qtd_refrigeradores ?? 0;
    const valorUnitRefrig = Number(contrato.valor_unitario_refrigerador);
    if (qtdRefrig > 0 && valorUnitRefrig > 0) {
      const totalRefrig = roundCurrency(qtdRefrig * valorUnitRefrig);
      const { erro: erroRefrig } = await inserirLancamentos(admin, [{
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
      if (erroRefrig) {
        erros.push(`Depositante ${fatura.depositante_id}: refrigerador - ${erroRefrig}`);
      }
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

  const { erro: insertErro } = await inserirLancamentos(admin, [lancamento]);
  if (insertErro) return { ok: false, erro: insertErro };

  await recalcularFatura(admin, faturaId as string);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cobrança: Cancelamento de pedido (fluxo de bipagem de devolução)
// ---------------------------------------------------------------------------

// Só cobra cancelamento "após início do picking" (conforme planilha de
// precificação): pedido que ainda estava em NOVO quando o cancelamento foi
// aberto não teve trabalho operacional, então é isento. A partir de
// EM_SEPARACAO (picking iniciado) em diante, cobra.
const STATUS_CANCELAMENTO_SEM_COBRANCA = ["NOVO"];

export async function registrarLancamentoCancelamento(
  cancelamentoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const admin = createSupabaseAdminClient();

  const { data: cancelamento } = await admin
    .from("pedidos_expedicao_cancelamentos")
    .select("id, pedido_expedicao_id, depositante_id, status_pedido_na_abertura")
    .eq("id", cancelamentoId)
    .single();

  if (!cancelamento) return { ok: false, erro: "Cancelamento não encontrado." };
  if (STATUS_CANCELAMENTO_SEM_COBRANCA.includes(cancelamento.status_pedido_na_abertura)) {
    return { ok: true };
  }

  const { data: pedido } = await admin
    .from("pedidos_expedicao")
    .select("id, codigo, quantidade_unidades, quantidade_itens")
    .eq("id", cancelamento.pedido_expedicao_id)
    .single();

  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  const contrato = await getContratoAtivo(admin, cancelamento.depositante_id);
  if (!contrato) return { ok: false, erro: "Sem contrato ativo." };
  if (contrato.tipo_contrato === "consignado") return { ok: true };

  // Planilha: "R$ X por item, mínimo R$ Y". Cobra o maior entre
  // (itens × valor por item) e o valor mínimo configurado. Se ambos forem
  // zero, não há cobrança configurada.
  const valorPorItem = Number(contrato.valor_cancelamento);
  const valorMinimo = Number(contrato.valor_cancelamento_minimo);
  if (valorPorItem <= 0 && valorMinimo <= 0) return { ok: true };

  const itens = Number(pedido.quantidade_unidades) || Number(pedido.quantidade_itens) || 1;
  const valorPorItens = roundCurrency(itens * valorPorItem);
  const valorTotal = Math.max(valorPorItens, valorMinimo);
  if (valorTotal <= 0) return { ok: true };

  const mesAno = getMesAno();

  const { data: faturaId } = await admin.rpc("garantir_ou_criar_fatura", {
    p_depositante_id: cancelamento.depositante_id,
    p_mes_ano: mesAno,
  });

  if (!faturaId) return { ok: false, erro: "Falha ao criar fatura." };

  const lancamento: LancamentoInsert = {
    depositante_id: cancelamento.depositante_id,
    fatura_id: faturaId as string,
    mes_ano: mesAno,
    tipo_servico: "CANCELAMENTO",
    origem: "AUTOMATICO",
    referencia_tipo: "PEDIDO_EXPEDICAO",
    referencia_id: pedido.id,
    descricao: `Cancelamento pedido ${pedido.codigo} (${itens} ${itens === 1 ? "item" : "itens"})`,
    quantidade: itens,
    valor_unitario: valorPorItem,
    valor_total: valorTotal,
    memoria_calculo: {
      status_pedido_na_abertura: cancelamento.status_pedido_na_abertura,
      itens,
      valor_por_item: valorPorItem,
      valor_por_itens: valorPorItens,
      valor_minimo: valorMinimo,
      aplicou_minimo: valorMinimo > valorPorItens,
    },
    contrato_snapshot: contratoSnapshot(contrato),
  };

  const { erro: insertErro } = await inserirLancamentos(admin, [lancamento]);
  if (insertErro) return { ok: false, erro: insertErro };

  await recalcularFatura(admin, faturaId as string);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cobrança: Produto vencido em quarentena (retirada pelo depositante / descarte)
// ---------------------------------------------------------------------------

export async function registrarLancamentoQuarentena(
  quarentenaId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const admin = createSupabaseAdminClient();

  const { data: q } = await admin
    .from("estoque_quarentena")
    .select("id, depositante_id, quantidade, tipo, decisao_depositante, status")
    .eq("id", quarentenaId)
    .single();

  if (!q) return { ok: false, erro: "Item de quarentena não encontrado." };

  // Só cobra o fluxo de produtos vencidos (retirada/descarte). Outros motivos
  // de quarentena (avaria etc.) não entram nesta cobrança.
  if (String(q.tipo ?? "").trim().toUpperCase() !== "VENCIMENTO") return { ok: true };

  const decisao = String(q.decisao_depositante ?? "").trim().toUpperCase();
  const tipoServico: TipoServico | null =
    decisao === "DOAR" ? "RETIRADA" : decisao === "DESCARTAR" ? "DESCARTE" : null;
  if (!tipoServico) return { ok: true };

  const contrato = await getContratoAtivo(admin, q.depositante_id);
  if (!contrato) return { ok: false, erro: "Sem contrato ativo." };
  if (contrato.tipo_contrato === "consignado") return { ok: true };

  const tarifa =
    tipoServico === "RETIRADA" ? Number(contrato.valor_retirada) : Number(contrato.valor_descarte);
  if (tarifa <= 0) return { ok: true };

  const quantidade = Number(q.quantidade) || 0;
  if (quantidade <= 0) return { ok: true };
  const valorTotal = roundCurrency(quantidade * tarifa);

  const mesAno = getMesAno();
  const { data: faturaId } = await admin.rpc("garantir_ou_criar_fatura", {
    p_depositante_id: q.depositante_id,
    p_mes_ano: mesAno,
  });
  if (!faturaId) return { ok: false, erro: "Falha ao criar fatura." };

  const label = tipoServico === "RETIRADA" ? "Retirada de vencidos" : "Descarte de vencidos";
  const lancamento: LancamentoInsert = {
    depositante_id: q.depositante_id,
    fatura_id: faturaId as string,
    mes_ano: mesAno,
    tipo_servico: tipoServico,
    origem: "AUTOMATICO",
    referencia_tipo: "QUARENTENA",
    referencia_id: q.id,
    descricao: `${label} (${quantidade} un)`,
    quantidade,
    valor_unitario: tarifa,
    valor_total: valorTotal,
    memoria_calculo: { tipo_quarentena: q.tipo, decisao, quantidade, tarifa_unitaria: tarifa },
    contrato_snapshot: contratoSnapshot(contrato),
  };

  const { erro: insertErro } = await inserirLancamentos(admin, [lancamento]);
  if (insertErro) return { ok: false, erro: insertErro };

  await recalcularFatura(admin, faturaId as string);

  return { ok: true };
}
