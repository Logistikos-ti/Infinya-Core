"use server";

import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type InsumoActionState = {
  success: boolean;
  message: string | null;
};

export async function saveInsumoAction(
  _prevState: InsumoActionState,
  formData: FormData,
): Promise<InsumoActionState> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim() || null;
  const nome = String(formData.get("nome") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const unidade = String(formData.get("unidade") ?? "").trim() || "un";
  const precoUnitario = Number(formData.get("preco_unitario") ?? 0);
  const estoqueInicial = Number(formData.get("estoque_inicial") ?? 0);
  const estoqueMinimo = Number(formData.get("estoque_minimo") ?? 0);
  const fornecedor = String(formData.get("fornecedor") ?? "").trim() || null;
  const ordem = Number(formData.get("ordem") ?? 0);
  const ativo = formData.get("ativo") === "on";

  if (!nome) {
    return { success: false, message: "Informe o nome do insumo." };
  }
  if (precoUnitario <= 0) {
    return { success: false, message: "O preço unitário deve ser maior que zero." };
  }

  const admin = createSupabaseAdminClient();
  const payload = {
    nome,
    sku,
    categoria,
    unidade,
    preco_unitario: precoUnitario,
    estoque_inicial: estoqueInicial,
    estoque_minimo: estoqueMinimo,
    fornecedor,
    ordem,
    ativo,
  };

  if (id) {
    const { error } = await admin.from("insumos_catalogo").update(payload).eq("id", id);
    if (error) return { success: false, message: `Erro ao atualizar: ${error.message}` };
    revalidatePath("/financeiro");
    return { success: true, message: null };
  }

  const { error } = await admin.from("insumos_catalogo").insert(payload);
  if (error) return { success: false, message: `Erro ao criar: ${error.message}` };
  revalidatePath("/financeiro");
  return { success: true, message: null };
}

export async function cobrarInsumoAction(
  _prevState: InsumoActionState,
  formData: FormData,
): Promise<InsumoActionState> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const depositanteId = String(formData.get("depositante_id") ?? "").trim();
  const insumoId = String(formData.get("insumo_id") ?? "").trim();
  const quantidade = Number(formData.get("quantidade") ?? 0);

  if (!depositanteId) return { success: false, message: "Selecione um depositante." };
  if (!insumoId) return { success: false, message: "Selecione um insumo." };
  if (quantidade <= 0) return { success: false, message: "Quantidade deve ser maior que zero." };

  const admin = createSupabaseAdminClient();

  const { data: insumo } = await admin
    .from("insumos_catalogo")
    .select("id, nome, unidade, preco_unitario")
    .eq("id", insumoId)
    .single();

  if (!insumo) return { success: false, message: "Insumo não encontrado." };

  const valorUnitario = Number(insumo.preco_unitario);
  const valorTotal = Math.round(quantidade * valorUnitario * 100) / 100;
  const mesAno = new Date().toISOString().slice(0, 7);

  const { data: faturaId } = await admin.rpc("garantir_ou_criar_fatura", {
    p_depositante_id: depositanteId,
    p_mes_ano: mesAno,
  });

  if (!faturaId) return { success: false, message: "Falha ao criar/obter fatura." };

  const { error } = await admin
    .from("lancamentos")
    .insert({
      depositante_id: depositanteId,
      fatura_id: faturaId,
      mes_ano: mesAno,
      tipo_servico: "INSUMO",
      origem: "MANUAL",
      referencia_id: `insumo-${insumoId}-${Date.now()}`,
      descricao: `${insumo.nome} (${quantidade} ${insumo.unidade})`,
      quantidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao cobrar: ${error.message}` };

  await admin.rpc("recalcular_totais_fatura", { p_fatura_id: faturaId });

  revalidatePath("/financeiro");
  return { success: true, message: null };
}
