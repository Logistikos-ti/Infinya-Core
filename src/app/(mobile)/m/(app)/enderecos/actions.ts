"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireConfigSectionAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enderecoFormSchema } from "@/lib/validations/enderecos";

export async function saveMobileEnderecoAction(formData: FormData) {
  await requireConfigSectionAccess("enderecos");

  const parsed = enderecoFormSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    codigo: String(formData.get("codigo") ?? "").trim().toUpperCase(),
    descricao: String(formData.get("descricao") ?? "").trim(),
    area: String(formData.get("area") ?? "PICKING").trim(),
    rua: String(formData.get("rua") ?? "").trim().toUpperCase(),
    modulo: String(formData.get("modulo") ?? "").trim().toUpperCase(),
    nivel: String(formData.get("nivel") ?? "").trim().toUpperCase(),
    posicao: String(formData.get("posicao") ?? "").trim().toUpperCase(),
    capacidadeMaxima: String(formData.get("capacidadeMaxima") ?? "").trim(),
    unidadePadrao: String(formData.get("unidadePadrao") ?? "").trim(),
    ativo: formData.get("ativo") === "on",
  });

  if (!parsed.success) {
    redirect("/m/enderecos/novo?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const payload = {
    codigo: parsed.data.codigo,
    descricao: parsed.data.descricao || null,
    area: parsed.data.area,
    rua: parsed.data.rua || null,
    modulo: parsed.data.modulo || null,
    nivel: parsed.data.nivel || null,
    posicao: parsed.data.posicao || null,
    capacidade_maxima: parsed.data.capacidadeMaxima
      ? Number(parsed.data.capacidadeMaxima.replace(",", "."))
      : null,
    unidade_padrao: parsed.data.unidadePadrao || null,
    ativo: parsed.data.ativo,
  };

  const { error } = await adminSupabase.from("enderecos").insert(payload);

  if (error) {
    redirect("/m/enderecos/novo?feedback=erro");
  }

  revalidatePath("/m/enderecos");
  revalidatePath("/m/enderecos/novo");
  revalidatePath("/configuracoes/enderecos");
  redirect("/m/enderecos?feedback=criado");
}
