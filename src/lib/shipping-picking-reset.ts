import { revalidatePath } from "next/cache";
import type { AppUserContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ResetReason = "cancelado" | "inatividade";
type ResetPickingOptions = {
  revalidate?: boolean;
};

export async function resetPickingOrdersToQueue(
  user: AppUserContext,
  orderIds: string[],
  reason: ResetReason = "cancelado",
  options?: ResetPickingOptions,
) {
  const adminSupabase = createSupabaseAdminClient();
  const normalizedIds = Array.from(new Set(orderIds.map((value) => value.trim()).filter(Boolean)));

  if (!normalizedIds.length) {
    return { success: false as const };
  }

  let ordersQuery = adminSupabase
    .from("pedidos_expedicao")
    .select("id, depositante_id, payload_origem")
    .in("id", normalizedIds);

  if (user.papel === "DEPOSITANTE" && user.depositanteId) {
    ordersQuery = ordersQuery.eq("depositante_id", user.depositanteId);
  }

  const { data, error } = await ordersQuery;

  if (error || !(data ?? []).length) {
    return { success: false as const };
  }

  const now = new Date().toISOString();
  const updates = (data ?? []).map((order) => {
    const payload = isRecord(order.payload_origem) ? order.payload_origem : {};

    return adminSupabase
      .from("pedidos_expedicao")
      .update({
        status: "NOVO",
        payload_origem: {
          ...payload,
          separacao: {
            operadorId: null,
            operadorNome: null,
            iniciadaEm: null,
            atualizadaEm: now,
            finalizadaEm: null,
            canceladaEm: now,
            motivoRetornoFila: reason,
          },
        },
      })
      .eq("id", order.id);
  });

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    return { success: false as const };
  }

  if (options?.revalidate !== false) {
    revalidatePath("/expedicao");
    revalidatePath("/expedicao/separacao");
    revalidatePath("/expedicao/conferencia");
    revalidatePath("/m/separacao");
    revalidatePath("/m/conferencia");

    for (const orderId of normalizedIds) {
      revalidatePath(`/expedicao/${orderId}`);
      revalidatePath(`/expedicao/separacao/${orderId}`);
      revalidatePath(`/expedicao/conferencia/${orderId}`);
      revalidatePath(`/m/separacao/${orderId}`);
      revalidatePath(`/m/conferencia/${orderId}`);
    }
  }

  return { success: true as const };
}

export async function resetPickingOrdersForCurrentOperator(
  user: AppUserContext,
  reason: ResetReason = "inatividade",
  options?: ResetPickingOptions,
) {
  const adminSupabase = createSupabaseAdminClient();

  let query = adminSupabase
    .from("pedidos_expedicao")
    .select("id, status, depositante_id, payload_origem")
    .eq("status", "EM_SEPARACAO");

  if (user.papel === "DEPOSITANTE" && user.depositanteId) {
    query = query.eq("depositante_id", user.depositanteId);
  }

  const { data, error } = await query.limit(100);

  if (error || !(data ?? []).length) {
    return { success: false as const, count: 0 };
  }

  const ids = (data ?? [])
    .filter((order) => {
      const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
      const picking = isRecord(payload.separacao) ? payload.separacao : {};
      return (
        readString(picking.operadorId) === user.id &&
        !readString(picking.finalizadaEm)
      );
    })
    .map((order) => order.id);

  if (!ids.length) {
    return { success: true as const, count: 0 };
  }

  const result = await resetPickingOrdersToQueue(user, ids, reason, options);
  return {
    success: result.success,
    count: ids.length,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  return null;
}
