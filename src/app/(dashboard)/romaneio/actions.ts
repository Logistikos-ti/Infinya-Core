"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth";
import {
  cancelRomaneioRecord,
  createRomaneioRecordFromOrders,
  releaseRomaneioRecord,
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
    observacoes: getString(formData, "observacoes") || null,
  });

  revalidatePath("/romaneio");
  revalidatePath(`/romaneio/${romaneioId}`);
  revalidatePath("/m/romaneio");
  redirect(`/romaneio/${romaneioId}?feedback=salvo`);
}

export async function releaseRomaneioRecordAction(formData: FormData) {
  const user = await requireModuleAccess("romaneio");
  const romaneioId = getString(formData, "romaneioId");

  if (!romaneioId) {
    redirect("/romaneio?feedback=erro");
  }

  await releaseRomaneioRecord({ user, romaneioId });
  revalidatePath("/romaneio");
  revalidatePath(`/romaneio/${romaneioId}`);
  revalidatePath("/expedicao");
  revalidatePath("/m/expedicao");
  revalidatePath("/m/romaneio");
  redirect(`/romaneio/${romaneioId}?feedback=liberado`);
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
  await requireModuleAccess("romaneio");
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();

  try {
    const matches = params.base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const contentType = matches ? matches[1] : "image/jpeg";
    const base64Clean = matches ? matches[2] : params.base64Data;
    const buffer = Buffer.from(base64Clean, "base64");

    const filePath = `romaneios/${params.romaneioId}/${params.type}-${Date.now()}.jpg`;

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
    const message = err instanceof Error ? err.message : "Erro ao finalizar romaneio.";
    return {
      ok: false,
      message,
    };
  }
}

