"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import {
  isTransportadorasSchemaMissing,
  normalizeCnpj,
  normalizeTransportadoraModalidades,
} from "@/lib/transportadoras";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { transportadoraFormSchema } from "@/lib/validations/transportadoras";

export type TransportadoraActionState = {
  success: boolean;
  message: string | null;
  errors?: Partial<Record<"nome" | "razaoSocial" | "cnpj" | "email" | "telefone" | "modalidades", string>>;
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
    observacoes: String(formData.get("observacoes") ?? "").trim(),
    ativo: formData.get("ativo") === "on",
  });

  const modalidades = normalizeTransportadoraModalidades(
    formData.getAll("modalidades").map((item) => String(item ?? "").trim().toUpperCase()),
  );

  if (!parsed.success || modalidades.length === 0) {
    const flattened = parsed.success ? {} : parsed.error.flatten().fieldErrors;

    return {
      success: false,
      message: "Revise os campos destacados e tente novamente.",
      errors: {
        nome: "nome" in flattened ? flattened.nome?.[0] ?? "" : "",
        razaoSocial: "razaoSocial" in flattened ? flattened.razaoSocial?.[0] ?? "" : "",
        cnpj: "cnpj" in flattened ? flattened.cnpj?.[0] ?? "" : "",
        email: "email" in flattened ? flattened.email?.[0] ?? "" : "",
        telefone: "telefone" in flattened ? flattened.telefone?.[0] ?? "" : "",
        modalidades: modalidades.length === 0 ? "Selecione ao menos uma modalidade." : "",
      },
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const payload = {
    nome: parsed.data.nome,
    razao_social: parsed.data.razaoSocial,
    cnpj: normalizeCnpj(parsed.data.cnpj),
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    modalidades,
    observacoes: parsed.data.observacoes || null,
    ativo: parsed.data.ativo,
  };

  if (parsed.data.id) {
    const { error } = await adminSupabase.from("transportadoras").update(payload).eq("id", parsed.data.id);

    if (error) {
      if (isTransportadorasSchemaMissing(error)) {
        return {
          success: false,
          message: "A estrutura de transportadoras ainda não foi criada no banco. Rode o SQL de criação para ativar este cadastro.",
        };
      }

      return {
        success: false,
        message: `Não foi possível atualizar a transportadora: ${error.message}`,
      };
    }

    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/transportadoras");
    redirect("/configuracoes/transportadoras?feedback=salvo");
  }

  const { error } = await adminSupabase.from("transportadoras").insert(payload);

  if (error) {
    if (isTransportadorasSchemaMissing(error)) {
      return {
        success: false,
        message: "A estrutura de transportadoras ainda não foi criada no banco. Rode o SQL de criação para ativar este cadastro.",
      };
    }

    return {
      success: false,
      message: `Não foi possível criar a transportadora: ${error.message}`,
    };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/transportadoras");
  redirect("/configuracoes/transportadoras?feedback=criado");
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

export async function deleteTransportadoraAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/configuracoes/transportadoras?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { error } = await adminSupabase.from("transportadoras").delete().eq("id", id);

  if (error) {
    if (isTransportadorasSchemaMissing(error)) {
      redirect("/configuracoes/transportadoras?feedback=estrutura");
    }

    redirect("/configuracoes/transportadoras?feedback=erro");
  }

  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/transportadoras");
  redirect("/configuracoes/transportadoras?feedback=excluido");
}
