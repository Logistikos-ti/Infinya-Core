"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import {
  isTransportadorasSchemaMissing,
  normalizeCnpj,
  normalizeTransportadoraTipo,
} from "@/lib/transportadoras";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { transportadoraFormSchema } from "@/lib/validations/transportadoras";

export type TransportadoraActionState = {
  success: boolean;
  message: string | null;
  errors?: Partial<
    Record<"nome" | "razaoSocial" | "cnpj" | "email" | "telefone" | "cidade" | "uf" | "tipo", string>
  >;
};

export async function saveTransportadoraAction(
  _prevState: TransportadoraActionState,
  formData: FormData,
): Promise<TransportadoraActionState> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const parsed = transportadoraFormSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    nome: String(formData.get("nome") ?? "").trim(),
    razaoSocial: String(formData.get("razaoSocial") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    telefone: String(formData.get("telefone") ?? "").trim(),
    cidade: String(formData.get("cidade") ?? "").trim(),
    uf: String(formData.get("uf") ?? "").trim().toUpperCase(),
    tipo: normalizeTransportadoraTipo(String(formData.get("tipo") ?? "")) ?? "",
    observacoes: String(formData.get("observacoes") ?? "").trim(),
    ativo: formData.get("ativo") !== "false",
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;

    return {
      success: false,
      message: "Revise os campos destacados e tente novamente.",
      errors: {
        nome: flattened.nome?.[0] ?? "",
        razaoSocial: flattened.razaoSocial?.[0] ?? "",
        cnpj: flattened.cnpj?.[0] ?? "",
        email: flattened.email?.[0] ?? "",
        telefone: flattened.telefone?.[0] ?? "",
        cidade: flattened.cidade?.[0] ?? "",
        uf: flattened.uf?.[0] ?? "",
        tipo: flattened.tipo?.[0] ?? "",
      },
    };
  }

  const adminSupabase = createSupabaseAdminClient();

  // "modalidades" é deixado de fora do payload de propósito: a tela nova usa o
  // campo "tipo" como modal principal de transporte. Omitir preserva o valor
  // atual em edições e usa o default '[]' do banco em novos cadastros.
  const payload = {
    nome: parsed.data.nome,
    razao_social: parsed.data.razaoSocial,
    cnpj: normalizeCnpj(parsed.data.cnpj),
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    cidade: parsed.data.cidade || null,
    uf: parsed.data.uf || null,
    tipo: parsed.data.tipo,
    observacoes: parsed.data.observacoes || null,
    ativo: parsed.data.ativo,
  };

  const { error } = parsed.data.id
    ? await adminSupabase.from("transportadoras").update(payload).eq("id", parsed.data.id)
    : await adminSupabase.from("transportadoras").insert(payload);

  if (error) {
    if (isTransportadorasSchemaMissing(error)) {
      return {
        success: false,
        message:
          "A estrutura de transportadoras ainda não foi criada no banco. Rode o SQL de criação para ativar este cadastro.",
      };
    }

    return {
      success: false,
      message: `Não foi possível salvar a transportadora: ${error.message}`,
    };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/transportadoras");

  return {
    success: true,
    message: parsed.data.id
      ? "Transportadora atualizada com sucesso."
      : "Transportadora cadastrada com sucesso.",
  };
}

export async function toggleTransportadoraStatusAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("nextActive") ?? "").trim() === "true";

  if (!id) {
    return;
  }

  const adminSupabase = createSupabaseAdminClient();
  const { error } = await adminSupabase.from("transportadoras").update({ ativo: nextActive }).eq("id", id);

  if (error && !isTransportadorasSchemaMissing(error)) {
    throw new Error(error.message);
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/transportadoras");
}

export type DeleteTransportadoraResult = { success: boolean; message: string };

export async function deleteTransportadoraAction(
  formData: FormData,
): Promise<DeleteTransportadoraResult | void> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();
  const isSpa = String(formData.get("isSpa") ?? "") === "true";

  if (!id) {
    if (isSpa) return { success: false, message: "Transportadora inválida." };
    redirect("/configuracoes/transportadoras?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { error } = await adminSupabase.from("transportadoras").delete().eq("id", id);

  if (error) {
    if (isSpa) {
      return {
        success: false,
        message: isTransportadorasSchemaMissing(error)
          ? "A estrutura de transportadoras ainda não existe no banco."
          : `Não foi possível excluir: ${error.message}`,
      };
    }

    if (isTransportadorasSchemaMissing(error)) {
      redirect("/configuracoes/transportadoras?feedback=estrutura");
    }

    redirect("/configuracoes/transportadoras?feedback=erro");
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/transportadoras");

  if (isSpa) return { success: true, message: "Transportadora excluída." };
  redirect("/configuracoes/transportadoras?feedback=excluido");
}
