"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TIPOS_SERVICO = [
  "FULFILLMENT", "PONTO_COLETA", "IMPRESSAO_NF", "CARTA_CORRECAO", "OUTRO_DOCUMENTO", "GESTAO_FRETE",
  "ITEM_ADICIONAL", "CONFERENCIA", "URGENCIA",
  "RECEBIMENTO", "ARMAZENAMENTO", "INSUMO", "LOGISTICA_REVERSA", "CANCELAMENTO",
  "RETIRADA", "DESCARTE", "INTEGRACAO",
  "SOFTWARE", "REFRIGERADOR", "DESCONTO", "COBRANCA_EXTRA",
] as const;

const TIPO_SERVICO_LABELS: Record<string, string> = {
  FULFILLMENT: "Fulfillment",
  PONTO_COLETA: "Ponto de Coleta",
  IMPRESSAO_NF: "Impressão NF",
  CARTA_CORRECAO: "Carta de Correção",
  OUTRO_DOCUMENTO: "Outro Documento",
  GESTAO_FRETE: "Gestão de Frete",
  ITEM_ADICIONAL: "Item Adicional",
  CONFERENCIA: "Conferência Unitária",
  URGENCIA: "Urgência",
  RECEBIMENTO: "Recebimento",
  ARMAZENAMENTO: "Armazenamento",
  INSUMO: "Insumo",
  LOGISTICA_REVERSA: "Logística Reversa",
  CANCELAMENTO: "Cancelamento",
  RETIRADA: "Retirada",
  DESCARTE: "Descarte",
  INTEGRACAO: "Integração",
  SOFTWARE: "Software",
  REFRIGERADOR: "Refrigerador",
  DESCONTO: "Desconto",
  COBRANCA_EXTRA: "Cobrança Extra",
};

export type LancamentoActionState = {
  success: boolean;
  message: string | null;
};

export async function criarLancamentoManualAction(
  _prevState: LancamentoActionState,
  formData: FormData,
): Promise<LancamentoActionState> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const depositanteId = String(formData.get("depositante_id") ?? "").trim();
  const tipoServico = String(formData.get("tipo_servico") ?? "").trim();
  const descricaoRaw = String(formData.get("descricao") ?? "").trim();
  const quantidade = Number(formData.get("quantidade") ?? 1);
  const valorUnitario = Number(formData.get("valor_unitario") ?? 0);

  if (!depositanteId) {
    return { success: false, message: "Selecione um depositante." };
  }
  if (!TIPOS_SERVICO.includes(tipoServico as typeof TIPOS_SERVICO[number])) {
    return { success: false, message: "Selecione um tipo de serviço válido." };
  }
  const descricao = descricaoRaw || TIPO_SERVICO_LABELS[tipoServico] || tipoServico;
  if (quantidade <= 0) {
    return { success: false, message: "A quantidade deve ser maior que zero." };
  }
  if (valorUnitario === 0) {
    return { success: false, message: "O valor unitário não pode ser zero." };
  }

  const valorTotal = Math.round(quantidade * valorUnitario * 100) / 100;
  const admin = createSupabaseAdminClient();
  const mesAno = new Date().toISOString().slice(0, 7);

  const { data: faturaId } = await admin.rpc("garantir_ou_criar_fatura", {
    p_depositante_id: depositanteId,
    p_mes_ano: mesAno,
  });

  if (!faturaId) {
    return { success: false, message: "Falha ao criar/obter fatura." };
  }

  const { error } = await admin
    .from("lancamentos")
    .insert({
      depositante_id: depositanteId,
      fatura_id: faturaId,
      mes_ano: mesAno,
      tipo_servico: tipoServico,
      origem: "MANUAL",
      referencia_id: `manual-${Date.now()}`,
      descricao,
      quantidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
    })
    .select()
    .single();

  if (error) {
    return { success: false, message: `Erro ao criar lançamento: ${error.message}` };
  }

  await admin.rpc("recalcular_totais_fatura", { p_fatura_id: faturaId });

  revalidatePath("/financeiro");
  return { success: true, message: null };
}
