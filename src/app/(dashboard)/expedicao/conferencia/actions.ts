"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function saveShippingConferenceAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const adminSupabase = createSupabaseAdminClient();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const operatorId = String(formData.get("operatorId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "save").trim();
  const redirectBase =
    String(formData.get("redirectBase") ?? "/expedicao/conferencia").trim() ||
    "/expedicao/conferencia";
  const completeRedirectTo = String(formData.get("completeRedirectTo") ?? "").trim();
  const wrongProductScans = normalizeQuantity(String(formData.get("wrongProductScans") ?? "0"));
  const itemIds = formData.getAll("itemId").map((value) => String(value).trim()).filter(Boolean);
  const quantityValues = formData
    .getAll("confirmedQuantity")
    .map((value) => normalizeQuantity(String(value)));

  if (!orderId || itemIds.length !== quantityValues.length) {
    redirect(`${redirectBase}?feedback=erro`);
  }

  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select(
      "id, status, payload_origem, itens:pedidos_expedicao_itens(id, quantidade, payload_origem)",
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

  const itemUpdates = itemIds
    .map((itemId, index) => {
      const itemRecord = itemMap.get(itemId);

      if (!itemRecord) {
        return null;
      }

      const requested = Number(itemRecord.quantidade ?? 0);
      const confirmed = Math.max(0, Math.min(quantityValues[index], requested));
      const payload = isRecord(itemRecord.payload_origem) ? itemRecord.payload_origem : {};
      const currentConference = isRecord(payload.conferencia) ? payload.conferencia : {};

      return adminSupabase
        .from("pedidos_expedicao_itens")
        .update({
          payload_origem: {
            ...payload,
            conferencia: {
              ...currentConference,
              quantidadeConferida: confirmed,
            },
          },
        })
        .eq("id", itemId)
        .eq("pedido_expedicao_id", orderId);
    })
    .filter(Boolean);

  if (itemUpdates.length) {
    await Promise.all(itemUpdates);
  }

  const operatorName = operatorId ? await resolveOperatorName(adminSupabase, operatorId) : user.nome;
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const currentConference = isRecord(payload.conferencia) ? payload.conferencia : {};
  const now = new Date().toISOString();
  const nextConferencePayload = {
    ...currentConference,
    operadorId: operatorId || readString(currentConference.operadorId) || user.id,
    operadorNome: operatorName || readString(currentConference.operadorNome) || user.nome,
    iniciadaEm: readString(currentConference.iniciadaEm) || now,
    atualizadaEm: now,
    finalizadaEm: intent === "complete" ? now : null,
    produtoErradoCount: wrongProductScans,
  };

  const totalRequested = [...itemMap.values()].reduce((sum, item) => sum + Number(item.quantidade ?? 0), 0);
  const totalConfirmed = quantityValues.reduce((sum, quantity) => sum + quantity, 0);
  const canComplete = totalRequested > 0 && totalConfirmed >= totalRequested;
  const nextStatus = intent === "complete" ? (canComplete ? "CONFERIDO" : order.status) : "EM_CONFERENCIA";

  await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status: nextStatus,
      payload_origem: {
        ...payload,
        conferencia: nextConferencePayload,
      },
    })
    .eq("id", orderId);

  revalidatePath("/expedicao");
  revalidatePath("/expedicao/conferencia");
  revalidatePath("/m/conferencia");
  revalidatePath(`/expedicao/conferencia/${orderId}`);
  revalidatePath(`/m/conferencia/${orderId}`);
  revalidatePath(`/expedicao/${orderId}`);

  if (intent === "complete" && !canComplete) {
    redirect(`${redirectBase}/${orderId}?feedback=incompleto`);
  }

  if (intent === "complete" && completeRedirectTo) {
    redirect(completeRedirectTo);
  }

  redirect(`${redirectBase}/${orderId}?feedback=${intent === "complete" ? "concluido" : "salvo"}`);
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
