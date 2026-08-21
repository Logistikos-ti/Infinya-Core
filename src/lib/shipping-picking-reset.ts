import { revalidatePath } from "next/cache";
import type { AppUserContext } from "@/lib/auth";
import { canResetPickingOrderToQueue } from "@/lib/shipping-picking-status";
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
    .select("id, status, depositante_id, payload_origem")
    .in("id", normalizedIds);

  if (user.papel === "DEPOSITANTE" && user.depositanteId) {
    ordersQuery = ordersQuery.eq("depositante_id", user.depositanteId);
  }

  const { data: allOrders, error } = await ordersQuery;

  if (error || !(allOrders ?? []).length) {
    return { success: false as const };
  }

  // Never drag an order that already advanced past picking back to the
  // queue -- this wipes quantidade_separada too. See
  // canResetPickingOrderToQueue in src/lib/shipping-picking-status.ts.
  const data = (allOrders ?? []).filter((order) =>
    canResetPickingOrderToQueue(String(order.status ?? "")),
  );

  if (!data.length) {
    return { success: false as const };
  }

  const resettableIds = data.map((order) => order.id);

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

  const itemResetResults = await Promise.all(
    resettableIds.map((orderId) =>
      adminSupabase
        .from("pedidos_expedicao_itens")
        .update({ quantidade_separada: 0 })
        .eq("pedido_expedicao_id", orderId),
    ),
  );

  if (itemResetResults.some((result) => result.error)) {
    return { success: false as const };
  }

  // Returning to the queue resets the operational scan progress, but the
  // allocation belongs to the order and remains active until cancellation or
  // physical debit at conference.
  const { error: scanResetError } = await adminSupabase
    .from("bipagens_separacao")
    .delete()
    .in("pedido_expedicao_id", resettableIds);

  if (scanResetError && !isMissingPickingScanTable(scanResetError)) {
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

function isMissingPickingScanTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("bipagens_separacao") ||
    message.includes("schema cache")
  );
}
