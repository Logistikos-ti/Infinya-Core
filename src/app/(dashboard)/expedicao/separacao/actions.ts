"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { buildPickingKitPayload, calculateKitOperationalTotals } from "@/lib/product-kits";
import { resetPickingOrdersToQueue } from "@/lib/shipping-picking-reset";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type KitProgressEntry = {
  componentProductId: string;
  quantityPerKit: number;
  separatedQuantity: number;
  sku: string;
  name: string;
  barcode: string;
};

type PickingOrderRecord = {
  id: string;
  status: string;
  depositante_id: string;
  payload_origem: Record<string, unknown> | null;
  itens?: Array<{
    id: string;
    quantidade: number | string | null;
    quantidade_separada?: number | string | null;
    payload_origem: Record<string, unknown> | null;
  }> | null;
};

export async function beginPickingWaveAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const adminSupabase = createSupabaseAdminClient();
  const orderIds = Array.from(
    new Set(
      formData
        .getAll("orderId")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );

  if (!orderIds.length) {
    redirect("/expedicao/separacao?feedback=erro");
  }

  let ordersQuery = adminSupabase
    .from("pedidos_expedicao")
    .select("id, status, depositante_id, payload_origem")
    .in("id", orderIds);

  if (user.papel === "DEPOSITANTE" && user.depositanteId) {
    ordersQuery = ordersQuery.eq("depositante_id", user.depositanteId);
  }

  const { data, error } = await ordersQuery;

  if (error || !(data ?? []).length) {
    redirect("/expedicao/separacao?feedback=erro");
  }

  const orders = (data ?? []) as PickingOrderRecord[];
  const hasInvalidStatus = orders.some(
    (order) => !["NOVO", "EM_SEPARACAO"].includes(order.status),
  );

  if (hasInvalidStatus) {
    redirect("/expedicao/separacao?feedback=erro");
  }

  redirect(`/expedicao/separacao/lote?ids=${encodeURIComponent(orderIds.join(","))}`);
}

export async function resetPickingOrdersToQueueAction(
  orderIds: string[],
  reason: "cancelado" | "inatividade" = "cancelado",
) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  return resetPickingOrdersToQueue(user, orderIds, reason);
}

export async function savePickingProgressAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const adminSupabase = createSupabaseAdminClient();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const operatorId = String(formData.get("operatorId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "save").trim();
  const redirectBase =
    String(formData.get("redirectBase") ?? "/expedicao/separacao").trim() ||
    "/expedicao/separacao";
  const completeRedirectTo = String(formData.get("completeRedirectTo") ?? "").trim();
  const itemIds = formData
    .getAll("itemId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const itemKitProgressValues = formData.getAll("itemKitProgress").map((value) => String(value));
  const quantityValues = formData
    .getAll("separatedQuantity")
    .map((value) => normalizeQuantity(String(value)));

  if (!orderId || itemIds.length !== quantityValues.length || itemIds.length !== itemKitProgressValues.length) {
    redirect(`${redirectBase}?feedback=erro`);
  }

  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select(
      "id, status, depositante_id, payload_origem, itens:pedidos_expedicao_itens(id, quantidade, quantidade_separada, payload_origem)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    redirect(`${redirectBase}?feedback=erro`);
  }

  const itemMap = new Map(
    ((order.itens ?? []) as Array<{
      id: string;
      quantidade: number | string | null;
      payload_origem: Record<string, unknown> | null;
    }>).map((item) => [item.id, item]),
  );

  let canComplete = true;

  const itemUpdates = itemIds
    .map((itemId, index) => {
      const itemRecord = itemMap.get(itemId);
      if (!itemRecord) {
        return null;
      }

      const requestedQuantity = Number(itemRecord.quantidade ?? 0);
      const currentPayload = isRecord(itemRecord.payload_origem) ? itemRecord.payload_origem : {};
      const kitProgress = parseKitProgress(itemKitProgressValues[index]);

      if (kitProgress.length > 0) {
        const totals = calculateKitOperationalTotals(
          kitProgress.map((item) => ({
            componentProductId: item.componentProductId,
            quantityPerKit: item.quantityPerKit,
            sku: item.sku,
            name: item.name,
            internalCode: item.sku,
            barcode: item.barcode,
          })),
          requestedQuantity,
          new Map(kitProgress.map((item) => [item.componentProductId, item.separatedQuantity])),
        );

        const completedKits = totals.completedKits;
        canComplete = canComplete && completedKits >= requestedQuantity;

        return adminSupabase
          .from("pedidos_expedicao_itens")
          .update({
            quantidade_separada: completedKits,
            payload_origem: buildPickingKitPayload(currentPayload, requestedQuantity, kitProgress.map((item) => ({
              componentProductId: item.componentProductId,
              separatedQuantity: item.separatedQuantity,
            }))),
          })
          .eq("id", itemId)
          .eq("pedido_expedicao_id", orderId);
      }

      const sanitizedQuantity = Math.max(0, Math.min(quantityValues[index], requestedQuantity));
      canComplete = canComplete && sanitizedQuantity >= requestedQuantity;
      return adminSupabase
        .from("pedidos_expedicao_itens")
        .update({ quantidade_separada: sanitizedQuantity })
        .eq("id", itemId)
        .eq("pedido_expedicao_id", orderId);
    })
    .filter(Boolean);

  if (itemUpdates.length) {
    const itemUpdateResults = await Promise.all(itemUpdates);
    const firstItemError = itemUpdateResults.find((result) => result?.error);

    if (firstItemError?.error) {
      redirect(`${redirectBase}?feedback=erro`);
    }
  }

  const operatorName = operatorId
    ? await resolveOperatorName(adminSupabase, operatorId)
    : user.papel === "OPERADOR"
      ? user.nome
      : null;

  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const currentPicking = isRecord(payload.separacao) ? payload.separacao : {};
  const now = new Date().toISOString();
  const nextPickingPayload = {
    ...currentPicking,
    operadorId: operatorId || readString(currentPicking.operadorId) || user.id,
    operadorNome: operatorName || readString(currentPicking.operadorNome) || user.nome,
    iniciadaEm: readString(currentPicking.iniciadaEm) || now,
    atualizadaEm: now,
    finalizadaEm: intent === "complete" ? now : null,
  };

  const nextStatus =
    intent === "complete" ? (canComplete ? "SEPARADO" : order.status) : "EM_SEPARACAO";

  const orderUpdateResult = await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status: nextStatus,
      payload_origem: {
        ...payload,
        separacao: nextPickingPayload,
      },
    })
    .eq("id", orderId);

  if (orderUpdateResult.error) {
    redirect(`${redirectBase}?feedback=erro`);
  }

  revalidatePath("/expedicao");
  revalidatePath("/expedicao/separacao");
  revalidatePath("/m/separacao");
  revalidatePath("/m/conferencia");
  revalidatePath(`/expedicao/${orderId}`);
  revalidatePath(`/m/separacao/${orderId}`);
  revalidatePath(`/m/conferencia/${orderId}`);

  if (intent === "complete" && !canComplete) {
    redirect(`${redirectBase}?feedback=incompleto`);
  }

  if (intent === "complete" && completeRedirectTo) {
    redirect(completeRedirectTo);
  }

  redirect(`${redirectBase}?feedback=${intent === "complete" ? "concluido" : "salvo"}`);
}

export async function savePickingWaveProgressAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const adminSupabase = createSupabaseAdminClient();
  const intent = String(formData.get("intent") ?? "complete").trim();
  const returnTo =
    String(formData.get("returnTo") ?? "/expedicao/separacao").trim() ||
    "/expedicao/separacao";
  const completeRedirectTo =
    String(formData.get("completeRedirectTo") ?? "/expedicao/separacao").trim() ||
    "/expedicao/separacao";

  const orderIds = Array.from(
    new Set(
      formData
        .getAll("waveOrderId")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
  const itemOrderIds = formData
    .getAll("itemOrderId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const itemIds = formData
    .getAll("itemId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const itemKitProgressValues = formData.getAll("itemKitProgress").map((value) => String(value));
  const quantityValues = formData
    .getAll("separatedQuantity")
    .map((value) => normalizeQuantity(String(value)));

  if (
    !orderIds.length ||
    itemIds.length !== quantityValues.length ||
    itemIds.length !== itemKitProgressValues.length ||
    itemIds.length !== itemOrderIds.length
  ) {
    redirect(appendFeedback(returnTo, "erro"));
  }

  let ordersQuery = adminSupabase
    .from("pedidos_expedicao")
    .select(
      "id, status, depositante_id, payload_origem, itens:pedidos_expedicao_itens(id, quantidade, quantidade_separada, payload_origem)",
    )
    .in("id", orderIds);

  if (user.papel === "DEPOSITANTE" && user.depositanteId) {
    ordersQuery = ordersQuery.eq("depositante_id", user.depositanteId);
  }

  const { data, error } = await ordersQuery;

  if (error || !(data ?? []).length) {
    redirect(appendFeedback(returnTo, "erro"));
  }

  const orders = (data ?? []) as PickingOrderRecord[];
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const itemMap = new Map(
    orders.flatMap((order) =>
      (order.itens ?? []).map((item) => [`${order.id}:${item.id}`, { order, item }] as const),
    ),
  );
  const orderCompletionMap = new Map(orderIds.map((orderId) => [orderId, true]));

  const itemUpdates = itemIds
    .map((itemId, index) => {
      const orderId = itemOrderIds[index];
      const itemRecord = itemMap.get(`${orderId}:${itemId}`);

      if (!itemRecord) {
        return null;
      }

      const requestedQuantity = Number(itemRecord.item.quantidade ?? 0);
      const currentPayload = isRecord(itemRecord.item.payload_origem)
        ? itemRecord.item.payload_origem
        : {};
      const kitProgress = parseKitProgress(itemKitProgressValues[index]);

      if (kitProgress.length > 0) {
        const totals = calculateKitOperationalTotals(
          kitProgress.map((item) => ({
            componentProductId: item.componentProductId,
            quantityPerKit: item.quantityPerKit,
            sku: item.sku,
            name: item.name,
            internalCode: item.sku,
            barcode: item.barcode,
          })),
          requestedQuantity,
          new Map(kitProgress.map((item) => [item.componentProductId, item.separatedQuantity])),
        );

        const completedKits = totals.completedKits;
        orderCompletionMap.set(
          orderId,
          (orderCompletionMap.get(orderId) ?? true) && completedKits >= requestedQuantity,
        );

        return adminSupabase
          .from("pedidos_expedicao_itens")
          .update({
            quantidade_separada: completedKits,
            payload_origem: buildPickingKitPayload(
              currentPayload,
              requestedQuantity,
              kitProgress.map((item) => ({
                componentProductId: item.componentProductId,
                separatedQuantity: item.separatedQuantity,
              })),
            ),
          })
          .eq("id", itemId)
          .eq("pedido_expedicao_id", orderId);
      }

      const sanitizedQuantity = Math.max(0, Math.min(quantityValues[index], requestedQuantity));
      orderCompletionMap.set(
        orderId,
        (orderCompletionMap.get(orderId) ?? true) && sanitizedQuantity >= requestedQuantity,
      );

      return adminSupabase
        .from("pedidos_expedicao_itens")
        .update({ quantidade_separada: sanitizedQuantity })
        .eq("id", itemId)
        .eq("pedido_expedicao_id", orderId);
    })
    .filter(Boolean);

  if (itemUpdates.length) {
    const itemUpdateResults = await Promise.all(itemUpdates);
    const firstItemError = itemUpdateResults.find((result) => result?.error);

    if (firstItemError?.error) {
      redirect(appendFeedback(returnTo, "erro"));
    }
  }

  const now = new Date().toISOString();
  const orderUpdates = orderIds
    .map((orderId) => {
      const order = orderMap.get(orderId);
      if (!order) {
        return null;
      }

      const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
      const currentPicking = isRecord(payload.separacao) ? payload.separacao : {};
      const canComplete = orderCompletionMap.get(orderId) ?? false;

      return adminSupabase
        .from("pedidos_expedicao")
        .update({
          status: intent === "complete" ? (canComplete ? "SEPARADO" : "EM_SEPARACAO") : "EM_SEPARACAO",
          payload_origem: {
            ...payload,
            separacao: {
              ...currentPicking,
              operadorId: readString(currentPicking.operadorId) || user.id,
              operadorNome: readString(currentPicking.operadorNome) || user.nome,
              iniciadaEm: readString(currentPicking.iniciadaEm) || now,
              atualizadaEm: now,
              finalizadaEm: intent === "complete" && canComplete ? now : null,
            },
          },
        })
        .eq("id", orderId);
    })
    .filter(Boolean);

  if (orderUpdates.length) {
    const orderUpdateResults = await Promise.all(orderUpdates);
    const firstOrderError = orderUpdateResults.find((result) => result?.error);

    if (firstOrderError?.error) {
      redirect(appendFeedback(returnTo, "erro"));
    }
  }

  revalidatePath("/expedicao");
  revalidatePath("/expedicao/separacao");
  revalidatePath("/expedicao/conferencia");
  revalidatePath("/m/separacao");
  revalidatePath("/m/conferencia");

  for (const orderId of orderIds) {
    revalidatePath(`/expedicao/${orderId}`);
    revalidatePath(`/expedicao/separacao/${orderId}`);
    revalidatePath(`/expedicao/conferencia/${orderId}`);
    revalidatePath(`/m/separacao/${orderId}`);
    revalidatePath(`/m/conferencia/${orderId}`);
  }

  const canCompleteAllOrders = orderIds.every((orderId) => orderCompletionMap.get(orderId));

  if (intent === "complete" && !canCompleteAllOrders) {
    redirect(appendFeedback(returnTo, "incompleto"));
  }

  redirect(appendFeedback(completeRedirectTo, intent === "complete" ? "concluido" : "salvo"));
}

async function resolveOperatorName(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  operatorId: string,
) {
  const { data } = await adminSupabase
    .from("usuarios")
    .select("nome")
    .eq("id", operatorId)
    .maybeSingle();

  return typeof data?.nome === "string" ? data.nome : null;
}

function normalizeQuantity(value: string) {
  const numeric = Number(value.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, numeric);
}

function parseKitProgress(rawValue: string) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const componentProductId =
          typeof entry.componentProductId === "string" ? entry.componentProductId.trim() : "";
        const quantityPerKit = normalizeQuantity(String(entry.quantityPerKit ?? 0));
        const separatedQuantity = normalizeQuantity(String(entry.separatedQuantity ?? 0));
        const sku = typeof entry.sku === "string" ? entry.sku : "";
        const name = typeof entry.name === "string" ? entry.name : "";
        const barcode = typeof entry.barcode === "string" ? entry.barcode : "";

        if (!componentProductId || quantityPerKit <= 0) {
          return null;
        }

        return {
          componentProductId,
          quantityPerKit,
          separatedQuantity,
          sku,
          name,
          barcode,
        } satisfies KitProgressEntry;
      })
      .filter((entry): entry is KitProgressEntry => Boolean(entry));
  } catch {
    return [] as KitProgressEntry[];
  }
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function appendFeedback(path: string, feedback: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}feedback=${feedback}`;
}
