"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireModuleAccess } from "@/lib/auth";
import {
  cancelRomaneioRecord,
  createRomaneioRecordFromOrders,
  updateRomaneioRecordDetails,
} from "@/lib/romaneio-records";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getOrderIds(formData: FormData) {
  return formData
    .getAll("pedidoIds")
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

export async function createRomaneioRecordAction(formData: FormData) {
  const user = await requireModuleAccess("romaneio");
  const orderIds = getOrderIds(formData);

  const romaneioId = await createRomaneioRecordFromOrders({
    user,
    orderIds,
    transportadoraId: getString(formData, "transportadoraId") || null,
    transportadoraNome: getString(formData, "transportadoraNome") || null,
    motoristaNome: getString(formData, "motoristaNome") || null,
    veiculoPlaca: getString(formData, "veiculoPlaca") || null,
    doca: getString(formData, "doca") || null,
    coletaPrevista: getString(formData, "coletaPrevista") || null,
    observacoes: getString(formData, "observacoes") || null,
  });

  const isMobile = getString(formData, "isMobile") === "true";

  revalidatePath("/romaneio");
  revalidatePath("/m/romaneio");
  redirect(isMobile ? `/m/romaneio?feedback=criado` : `/romaneio/${romaneioId}?feedback=criado`);
}

export async function updateRomaneioRecordAction(formData: FormData) {
  const user = await requireModuleAccess("romaneio");
  const romaneioId = getString(formData, "romaneioId");

  if (!romaneioId) {
    redirect("/romaneio?feedback=erro");
  }

  await updateRomaneioRecordDetails({
    user,
    romaneioId,
    transportadoraId: getString(formData, "transportadoraId") || null,
    transportadoraNome: getString(formData, "transportadoraNome") || null,
    motoristaNome: getString(formData, "motoristaNome") || null,
    motoristaDocumento: getString(formData, "motoristaDocumento") || null,
    veiculoModelo: getString(formData, "veiculoModelo") || null,
    veiculoPlaca: getString(formData, "veiculoPlaca") || null,
    doca: getString(formData, "doca") || null,
    coletaPrevista: getString(formData, "coletaPrevista") || null,
    observacoes: getString(formData, "observacoes") || null,
  });

  revalidatePath("/romaneio");
  revalidatePath(`/romaneio/${romaneioId}`);
  revalidatePath("/m/romaneio");
  redirect(`/romaneio/${romaneioId}?feedback=salvo`);
}

export async function cancelRomaneioRecordAction(formData: FormData) {
  const user = await requireModuleAccess("romaneio");
  const romaneioId = getString(formData, "romaneioId");

  if (!romaneioId) {
    redirect("/romaneio?feedback=erro");
  }

  await cancelRomaneioRecord({ user, romaneioId });
  revalidatePath("/romaneio");
  revalidatePath(`/romaneio/${romaneioId}`);
  revalidatePath("/expedicao");
  revalidatePath("/m/expedicao");
  revalidatePath("/m/romaneio");
  redirect(`/romaneio/${romaneioId}?feedback=cancelado`);
}

export async function validateAndAssignOrderDanfeAction(params: {
  orderId: string;
  scannedDanfe: string;
}) {
  try {
    const user = await requireModuleAccess("expedicao");
    const { validateAndAssignOrderDanfeToRomaneio } = await import("@/lib/romaneio-records");

    const result = await validateAndAssignOrderDanfeToRomaneio({
      user,
      orderId: params.orderId,
      scannedDanfe: params.scannedDanfe,
    });

    revalidatePath("/expedicao");
    revalidatePath("/expedicao/conferencia");
    revalidatePath(`/expedicao/conferencia/${params.orderId}`);
    revalidatePath("/conferencia");
    revalidatePath(`/conferencia/${params.orderId}`);
    revalidatePath("/m/conferencia");
    revalidatePath(`/m/conferencia/${params.orderId}`);
    revalidatePath("/romaneio");
    revalidatePath("/m/romaneio");

    return result;
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "Erro ao validar DANFE e atribuir ao romaneio.";
    return {
      ok: false,
      message,
    };
  }
}

export async function listSavedDriversAction(transportadoraNome?: string | null) {
  await requireModuleAccess("romaneio");
  const { listSavedDriversFromDb } = await import("@/lib/romaneio-records");
  return listSavedDriversFromDb(transportadoraNome);
}

export async function uploadRomaneioPhotoAction(params: {
  romaneioId: string;
  type: "operador" | "motorista";
  base64Data: string;
}) {
  try {
    await requireModuleAccess("romaneio");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    // Auth check failed for a non-redirect reason -- don't block the whole
    // finalize flow over a photo, fall back to the raw capture like the
    // storage-upload failure path below already does.
    return { url: params.base64Data };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();

  try {
    const matches = params.base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const contentType = matches ? matches[1] : "image/jpeg";
    const base64Clean = matches ? matches[2] : params.base64Data;
    const buffer = Buffer.from(base64Clean, "base64");

    // Extension must track the real contentType -- the signature pad
    // produces PNG (SignaturePadOverlay's toDataURL("image/png")) while
    // camera captures stay JPEG. Content-Type in Storage was always
    // correct; only the file extension used to be hardcoded to .jpg.
    const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
    };
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "jpg";
    const filePath = `romaneios/${params.romaneioId}/${params.type}-${Date.now()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("wms-documentos")
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      // If upload fails, return the data uri directly as fallback
      return { url: params.base64Data };
    }

    const { data: urlData } = admin.storage.from("wms-documentos").getPublicUrl(filePath);
    return { url: urlData.publicUrl || params.base64Data };
  } catch (err) {
    return { url: params.base64Data };
  }
}

export async function completeRomaneioWithDoubleCheckAction(params: {
  romaneioId: string;
  driverData: {
    nome: string;
    documento: string;
    veiculoModelo: string;
    veiculoPlaca: string;
  };
  photos: {
    operadorUrl?: string | null;
    motoristaUrl?: string | null;
    motoristaCaptureType?: "foto" | "assinatura" | null;
  };
  scannedOrderIds: string[];
}) {
  try {
    const user = await requireModuleAccess("romaneio");
    const { completeRomaneioWithDoubleCheck } = await import("@/lib/romaneio-records");

    const result = await completeRomaneioWithDoubleCheck({
      user,
      romaneioId: params.romaneioId,
      driverData: params.driverData,
      photos: params.photos,
      scannedOrderIds: params.scannedOrderIds,
    });

    revalidatePath("/romaneio");
    revalidatePath(`/romaneio/${params.romaneioId}`);
    revalidatePath("/m/romaneio");
    revalidatePath("/expedicao");
    revalidatePath("/m/expedicao");

    return result;
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : "Erro ao finalizar romaneio.";
    return {
      ok: false,
      message,
    };
  }
}

