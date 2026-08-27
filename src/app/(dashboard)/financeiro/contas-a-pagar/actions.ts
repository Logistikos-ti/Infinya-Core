"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ContaPagarActionState = {
  success: boolean;
  message: string | null;
};

export async function criarContaPagarAction(
  _prevState: ContaPagarActionState,
  formData: FormData,
): Promise<ContaPagarActionState> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const fornecedor = String(formData.get("fornecedor") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const valor = Number(formData.get("valor") ?? 0);
  const vencimento = String(formData.get("vencimento") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();

  if (!fornecedor) {
    return { success: false, message: "Informe o fornecedor." };
  }
  if (!descricao) {
    return { success: false, message: "Informe uma descrição." };
  }
  if (!valor || valor <= 0) {
    return { success: false, message: "O valor deve ser maior que zero." };
  }
  if (!vencimento) {
    return { success: false, message: "Informe a data de vencimento." };
  }

  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("contas_pagar").insert({
    fornecedor,
    descricao,
    categoria: categoria || null,
    valor,
    vencimento,
    observacoes: observacoes || null,
  });

  if (error) {
    return { success: false, message: `Erro ao criar conta a pagar: ${error.message}` };
  }

  revalidatePath("/financeiro");
  return { success: true, message: null };
}

export async function marcarContaPagarPagaAction(id: string): Promise<{ success: boolean; message: string | null }> {
  await requireRoleAccess(["ADMIN", "TI"]);

  if (!id) return { success: false, message: "ID inválido." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("contas_pagar")
    .update({ status: "PAGO", pago_em: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { success: false, message: `Erro ao marcar como pago: ${error.message}` };
  }

  revalidatePath("/financeiro");
  return { success: true, message: null };
}
