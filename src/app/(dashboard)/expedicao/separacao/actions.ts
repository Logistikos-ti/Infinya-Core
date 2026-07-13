"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { buildPickingKitPayload, calculateKitOperationalTotals } from "@/lib/product-kits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type KitProgressEntry = {
  componentProductId: string;
  quantityPerKit: number;
  separatedQuantity: number;
  sku: string;
  name: string;
  barcode: string;
};

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
    const firstItemError = itemUpdateResults.find((result) => result.error);

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
