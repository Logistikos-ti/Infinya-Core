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

  revalidatePath("/romaneio");
  revalidatePath("/m/romaneio");
  redirect(`/romaneio/${romaneioId}?feedback=criado`);
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
