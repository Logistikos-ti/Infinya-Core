"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TIPOS_SERVICO = [
  "FULFILLMENT", "PONTO_COLETA", "IMPRESSAO_NF", "GESTAO_FRETE",
  "RECEBIMENTO", "ARMAZENAMENTO", "INSUMO", "LOGISTICA_REVERSA",
  "SOFTWARE", "REFRIGERADOR", "DESCONTO", "COBRANCA_EXTRA",
] as const;

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
  const descricao = String(formData.get("descricao") ?? "").trim();
  const quantidade = Number(formData.get("quantidade") ?? 1);
  const valorUnitario = Number(formData.get("valor_unitario") ?? 0);

  if (!depositanteId) {
    return { success: false, message: "Selecione um depositante." };
  }
  if (!TIPOS_SERVICO.includes(tipoServico as typeof TIPOS_SERVICO[number])) {
    return { success: false, message: "Selecione um tipo de serviço válido." };
  }
  if (!descricao) {
    return { success: false, message: "Informe uma descrição." };
  }
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

  revalidatePath("/financeiro/lancamentos");
  revalidatePath("/financeiro");
  redirect("/financeiro/lancamentos?feedback=criado");
}
