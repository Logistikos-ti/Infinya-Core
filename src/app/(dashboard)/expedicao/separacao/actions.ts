"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  const quantityValues = formData
    .getAll("separatedQuantity")
    .map((value) => normalizeQuantity(String(value)));

  if (!orderId || itemIds.length !== quantityValues.length) {
    redirect(`${redirectBase}?feedback=erro`);
  }

  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select(
      "id, status, depositante_id, payload_origem, itens:pedidos_expedicao_itens(id, quantidade, quantidade_separada)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    redirect(`${redirectBase}?feedback=erro`);
  }

  const itemMap = new Map(
    ((order.itens ?? []) as Array<{ id: string; quantidade: number | string | null }>).map((item) => [
      item.id,
      Number(item.quantidade ?? 0),
    ]),
  );

  const itemUpdates = itemIds
    .map((itemId, index) => {
      const maxQuantity = itemMap.get(itemId);

      if (typeof maxQuantity !== "number") {
        return null;
      }

      const sanitizedQuantity = Math.max(0, Math.min(quantityValues[index], maxQuantity));
      return adminSupabase
        .from("pedidos_expedicao_itens")
        .update({ quantidade_separada: sanitizedQuantity })
        .eq("id", itemId)
        .eq("pedido_expedicao_id", orderId);
    })
    .filter(Boolean);

  if (itemUpdates.length) {
    await Promise.all(itemUpdates);
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

  const totalRequested = [...itemMap.values()].reduce((sum, quantity) => sum + quantity, 0);
  const totalSeparated = quantityValues.reduce((sum, quantity) => sum + quantity, 0);
  const canComplete = totalRequested > 0 && totalSeparated >= totalRequested;

  const nextStatus =
    intent === "complete" ? (canComplete ? "SEPARADO" : order.status) : "EM_SEPARACAO";

  await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status: nextStatus,
      payload_origem: {
        ...payload,
        separacao: nextPickingPayload,
      },
    })
    .eq("id", orderId);

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
