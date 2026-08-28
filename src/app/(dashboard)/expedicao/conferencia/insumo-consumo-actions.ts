"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { registrarLancamentoInsumoConsumo } from "@/lib/billing";

export type InsumoConsumoChoice =
  | { origem: "GALPAO"; itens: { insumoId: string; quantidade: number }[] }
  | { origem: "DEPOSITANTE"; nomes: string[] }
  | { origem: "NENHUM" };

export async function registrarConsumoInsumoAction(
  pedidoId: string,
  depositanteId: string,
  choice: InsumoConsumoChoice,
): Promise<{ ok: boolean; erro?: string }> {
  const user = await requireModuleAccess("expedicao");
  const admin = createSupabaseAdminClient();

  if (choice.origem === "GALPAO") {
    if (!choice.itens.length) return { ok: false, erro: "Selecione ao menos um insumo." };
    for (const item of choice.itens) {
      if (!item.insumoId || !(item.quantidade > 0)) {
        return { ok: false, erro: "Insumo e quantidade são obrigatórios." };
      }
    }

    for (const item of choice.itens) {
      const { data: consumo, error } = await admin
        .from("insumo_consumo_pedidos")
        .insert({
          pedido_expedicao_id: pedidoId,
          depositante_id: depositanteId,
          origem: "GALPAO",
          insumo_catalogo_id: item.insumoId,
          quantidade: item.quantidade,
          criado_por: user.id,
        })
        .select("id")
        .single();

      if (error || !consumo) return { ok: false, erro: error?.message ?? "Falha ao registrar consumo." };

      const result = await registrarLancamentoInsumoConsumo(consumo.id);
      if (!result.ok) return { ok: false, erro: result.erro };
    }
  } else if (choice.origem === "DEPOSITANTE") {
    if (!choice.nomes.length) return { ok: false, erro: "Selecione ao menos um insumo do depositante." };

    const { error } = await admin.from("insumo_consumo_pedidos").insert(
      choice.nomes.map((nome) => ({
        pedido_expedicao_id: pedidoId,
        depositante_id: depositanteId,
        origem: "DEPOSITANTE" as const,
        insumo_nome: nome,
        criado_por: user.id,
      })),
    );

    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await admin.from("insumo_consumo_pedidos").insert({
      pedido_expedicao_id: pedidoId,
      depositante_id: depositanteId,
      origem: "NENHUM",
      criado_por: user.id,
    });

    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath(`/expedicao/conferencia/${pedidoId}`);
  revalidatePath(`/m/conferencia/${pedidoId}`);
  return { ok: true };
}
