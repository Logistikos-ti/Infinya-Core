"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import {
  listShippingOrderDocumentTypes,
  storeOperationalDocumentFromBuffer,
} from "@/lib/operational-documents";
import { buildConferenceKitPayload, calculateKitOperationalTotals } from "@/lib/product-kits";
import { canUploadOperationalDocuments } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureUserCanAccessDepositante } from "@/lib/tenant-scope";
import { allowedDocumentMimeTypes, maxDocumentFileSizeBytes } from "@/lib/storage";

type KitProgressEntry = {
  componentProductId: string;
  quantityPerKit: number;
  separatedQuantity: number;
  sku: string;
  name: string;
  barcode: string;
};

type ShippingAttachmentUploadState = {
  ok: boolean;
  message: string | null;
  uploadedKind: "NF" | "ETIQUETA" | null;
};

const allowedShippingAttachmentTypes = new Set(["NF", "ETIQUETA"]);

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
  const itemKitProgressValues = formData.getAll("itemKitProgress").map((value) => String(value));
  const quantityValues = formData
    .getAll("confirmedQuantity")
    .map((value) => normalizeQuantity(String(value)));

  if (!orderId || itemIds.length !== quantityValues.length || itemIds.length !== itemKitProgressValues.length) {
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

  let canComplete = true;

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
          requested,
          new Map(kitProgress.map((item) => [item.componentProductId, item.separatedQuantity])),
        );

        canComplete = canComplete && totals.completedKits >= requested;

        return adminSupabase
          .from("pedidos_expedicao_itens")
          .update({
            payload_origem: {
              ...payload,
              conferencia: {
                ...currentConference,
                quantidadeConferida: totals.completedKits,
              },
              ...buildConferenceKitPayload(payload, requested, kitProgress.map((item) => ({
                componentProductId: item.componentProductId,
                separatedQuantity: item.separatedQuantity,
              }))),
            },
          })
          .eq("id", itemId)
          .eq("pedido_expedicao_id", orderId);
      }

      canComplete = canComplete && confirmed >= requested;

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
  const isReleaseToRomaneio = intent === "release-romaneio";
  const isReleaseWithoutRomaneio = intent === "release-sem-romaneio";
  const isCompletingConference =
    intent === "complete" || isReleaseToRomaneio || isReleaseWithoutRomaneio;

  const nextConferencePayload: Record<string, unknown> = {
    ...currentConference,
    operadorId: operatorId || readString(currentConference.operadorId) || user.id,
    operadorNome: operatorName || readString(currentConference.operadorNome) || user.nome,
    iniciadaEm: readString(currentConference.iniciadaEm) || now,
    atualizadaEm: now,
    finalizadaEm: isCompletingConference ? now : null,
    produtoErradoCount: wrongProductScans,
  };

  const documentTypes =
    isReleaseToRomaneio && canComplete
      ? await listShippingOrderDocumentTypes(adminSupabase, orderId)
      : new Set<string>();
  const hasInvoiceXml = documentTypes.has("NF");
  const hasShippingLabel = documentTypes.has("ETIQUETA");

  let nextStatus = "EM_CONFERENCIA";
  let nextPayload = {
    ...payload,
    conferencia: nextConferencePayload,
  };

  if (isReleaseToRomaneio) {
    if (!canComplete || !hasInvoiceXml || !hasShippingLabel) {
      revalidatePath(`/expedicao/conferencia/${orderId}`);
      redirect(`${redirectBase}/${orderId}?feedback=documentos-pendentes`);
    }

    nextStatus = "PRONTO_ROMANEIO";
    nextPayload = {
      ...payload,
      conferencia: {
        ...nextConferencePayload,
        liberadoParaRomaneioEm: now,
        liberadoSemRomaneioEm: null,
      },
    };
  } else if (isReleaseWithoutRomaneio) {
    if (!canComplete) {
      revalidatePath(`/expedicao/conferencia/${orderId}`);
      redirect(`${redirectBase}/${orderId}?feedback=incompleto`);
    }

    nextStatus = "CONFERIDO";
    nextPayload = {
      ...payload,
      conferencia: {
        ...nextConferencePayload,
        liberadoSemRomaneioEm: now,
        liberadoParaRomaneioEm: null,
      },
    };
  } else if (intent === "complete") {
    nextStatus = canComplete ? "CONFERIDO" : order.status;
  }

  await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status: nextStatus,
      payload_origem: nextPayload,
    })
    .eq("id", orderId);

  revalidatePath("/expedicao");
  revalidatePath("/expedicao/conferencia");
  revalidatePath("/expedicao/conferidos");
  revalidatePath("/m/conferencia");
  revalidatePath(`/expedicao/conferencia/${orderId}`);
  revalidatePath(`/m/conferencia/${orderId}`);
  revalidatePath(`/expedicao/${orderId}`);
  revalidatePath("/romaneio");
  revalidatePath("/m/romaneio");

  if (isCompletingConference && !canComplete) {
    redirect(`${redirectBase}/${orderId}?feedback=incompleto`);
  }

  if (isReleaseToRomaneio) {
    redirect("/expedicao/conferidos?feedback=liberado-romaneio");
  }

  if (isReleaseWithoutRomaneio) {
    redirect("/expedicao/conferidos?feedback=liberado-sem-romaneio");
  }

  if (intent === "complete" && completeRedirectTo) {
    redirect(completeRedirectTo);
  }

  redirect(`${redirectBase}/${orderId}?feedback=${intent === "complete" ? "concluido" : "salvo"}`);
}

export async function releaseShippingOrderToRomaneioAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const adminSupabase = createSupabaseAdminClient();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const redirectTo =
    String(formData.get("redirectTo") ?? "/expedicao?status=PRONTO_ROMANEIO").trim() ||
    "/expedicao?status=PRONTO_ROMANEIO";
  const fallbackRedirect =
    String(formData.get("fallbackRedirect") ?? "").trim() || `/expedicao/conferencia/${orderId}`;

  if (!orderId) {
    redirect("/expedicao/conferencia?feedback=erro");
  }

  const { data: order, error } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, status, itens:pedidos_expedicao_itens(id, quantidade, payload_origem)")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    redirect(`${fallbackRedirect}?feedback=erro`);
  }

  const itemRows =
    ((order.itens ?? []) as Array<{
      id: string;
      quantidade: number | string | null;
      payload_origem: Record<string, unknown> | null;
    }>) ?? [];

  const allItemsConfirmed = itemRows.every((item) => {
    const requested = Number(item.quantidade ?? 0);
    const payload = isRecord(item.payload_origem) ? item.payload_origem : {};
    const conference = isRecord(payload.conferencia) ? payload.conferencia : {};
    const confirmed = Number(readString(conference.quantidadeConferida) ?? 0);
    return confirmed >= requested;
  });

  const documentTypes = await listShippingOrderDocumentTypes(adminSupabase, orderId);
  const hasInvoiceXml = documentTypes.has("NF");
  const hasShippingLabel = documentTypes.has("ETIQUETA");

  if (!allItemsConfirmed || !hasInvoiceXml || !hasShippingLabel) {
    redirect(`${fallbackRedirect}?feedback=documentos-pendentes`);
  }

  const { data: currentOrder } = await adminSupabase
    .from("pedidos_expedicao")
    .select("payload_origem")
    .eq("id", orderId)
    .maybeSingle();
  const payload = isRecord(currentOrder?.payload_origem) ? currentOrder.payload_origem : {};
  const currentConference = isRecord(payload.conferencia) ? payload.conferencia : {};

  await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status: "PRONTO_ROMANEIO",
      payload_origem: {
        ...payload,
        conferencia: {
          ...currentConference,
          liberadoParaRomaneioEm: new Date().toISOString(),
          liberadoSemRomaneioEm: null,
        },
      },
    })
    .eq("id", orderId);

  revalidatePath("/expedicao");
  revalidatePath("/expedicao/conferencia");
  revalidatePath(`/expedicao/conferencia/${orderId}`);
  revalidatePath("/romaneio");
  revalidatePath("/m/romaneio");

  redirect(redirectTo);
}

export async function releaseShippingOrderWithoutRomaneioAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const adminSupabase = createSupabaseAdminClient();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const redirectTo =
    String(formData.get("redirectTo") ?? "/expedicao/conferidos").trim() ||
    "/expedicao/conferidos";
  const fallbackRedirect =
    String(formData.get("fallbackRedirect") ?? "").trim() || `/expedicao/conferencia/${orderId}`;

  if (!orderId) {
    redirect("/expedicao/conferencia?feedback=erro");
  }

  const { data: order, error } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, status, payload_origem, itens:pedidos_expedicao_itens(id, quantidade, payload_origem)")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    redirect(`${fallbackRedirect}?feedback=erro`);
  }

  const itemRows =
    ((order.itens ?? []) as Array<{
      id: string;
      quantidade: number | string | null;
      payload_origem: Record<string, unknown> | null;
    }>) ?? [];

  const allItemsConfirmed = itemRows.every((item) => {
    const requested = Number(item.quantidade ?? 0);
    const payload = isRecord(item.payload_origem) ? item.payload_origem : {};
    const conference = isRecord(payload.conferencia) ? payload.conferencia : {};
    const confirmed = Number(readString(conference.quantidadeConferida) ?? 0);
    return confirmed >= requested;
  });

  if (!allItemsConfirmed) {
    redirect(`${fallbackRedirect}?feedback=incompleto`);
  }

  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const currentConference = isRecord(payload.conferencia) ? payload.conferencia : {};

  await adminSupabase
    .from("pedidos_expedicao")
    .update({
      status: "CONFERIDO",
      payload_origem: {
        ...payload,
        conferencia: {
          ...currentConference,
          liberadoSemRomaneioEm: new Date().toISOString(),
          liberadoParaRomaneioEm: null,
        },
      },
    })
    .eq("id", orderId);

  revalidatePath("/expedicao");
  revalidatePath("/expedicao/conferencia");
  revalidatePath("/expedicao/conferidos");
  revalidatePath(`/expedicao/conferencia/${orderId}`);
  revalidatePath(`/expedicao/${orderId}`);

  redirect(redirectTo);
}

export async function uploadShippingAttachmentAction(
  _previousState: ShippingAttachmentUploadState,
  formData: FormData,
): Promise<ShippingAttachmentUploadState> {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);

  if (!canUploadOperationalDocuments(user)) {
    return {
      ok: false,
      message: "Seu perfil pode consultar documentos, mas não pode enviar novos arquivos.",
      uploadedKind: null,
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const orderId = String(formData.get("pedidoExpedicaoId") ?? "").trim();
  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim().toUpperCase();
  const file = formData.get("arquivo");

  if (!orderId) {
    return { ok: false, message: "Pedido de expedição não informado.", uploadedKind: null };
  }

  if (!depositanteId) {
    return { ok: false, message: "Selecione o depositante do documento.", uploadedKind: null };
  }

  if (!allowedShippingAttachmentTypes.has(tipo)) {
    return { ok: false, message: "Tipo de documento inválido.", uploadedKind: null };
  }

  if (!(file instanceof File)) {
    return { ok: false, message: "Selecione um arquivo para upload.", uploadedKind: null };
  }

  if (!file.name || file.size <= 0) {
    return { ok: false, message: "O arquivo enviado está vazio ou inválido.", uploadedKind: null };
  }

  if (file.size > maxDocumentFileSizeBytes) {
    return { ok: false, message: "O arquivo excede o limite de 10 MB.", uploadedKind: null };
  }

  if (!allowedDocumentMimeTypes.includes(file.type as (typeof allowedDocumentMimeTypes)[number])) {
    return {
      ok: false,
      message: "Formato não suportado. Envie PDF, XML, PNG ou JPG.",
      uploadedKind: null,
    };
  }

  const scopeError = ensureUserCanAccessDepositante(user, depositanteId);
  if (scopeError) {
    return {
      ok: false,
      message: "Seu perfil não pode anexar documentos para este depositante.",
      uploadedKind: null,
    };
  }

  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, depositante_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return {
      ok: false,
      message: `Não foi possível validar o pedido: ${orderError.message}`,
      uploadedKind: null,
    };
  }

  if (!order || order.depositante_id !== depositanteId) {
    return {
      ok: false,
      message: "O pedido informado não pertence a este depositante.",
      uploadedKind: null,
    };
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());

    await storeOperationalDocumentFromBuffer({
      adminSupabase,
      depositanteId,
      tipo,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      pedidoExpedicaoId: orderId,
      enviadoPor: user.id,
    });

    revalidatePath("/expedicao");
    revalidatePath("/expedicao/conferencia");
    revalidatePath(`/expedicao/conferencia/${orderId}`);
    revalidatePath(`/expedicao/${orderId}`);
    revalidatePath("/m/conferencia");
    revalidatePath(`/m/conferencia/${orderId}`);

    return {
      ok: true,
      message:
        tipo === "ETIQUETA"
          ? "Etiqueta anexada com sucesso ao pedido."
          : "XML da nota fiscal anexado com sucesso ao pedido.",
      uploadedKind: tipo as "NF" | "ETIQUETA",
    };
  } catch (error) {
    const typedError =
      error && typeof error === "object" && "message" in error
        ? (error as { message?: string; code?: string })
        : null;

    if (typedError?.code === "42703") {
      return {
        ok: false,
        message:
          "O banco ainda não recebeu a atualização de anexos da expedição. Rode a migration pendente antes de anexar arquivos ao pedido.",
        uploadedKind: null,
      };
    }

    return {
      ok: false,
      message: `Falha ao registrar documento no banco: ${typedError?.message ?? "erro desconhecido"}`,
      uploadedKind: null,
    };
  }
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
