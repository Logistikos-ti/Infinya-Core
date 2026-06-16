"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext, requireRoleAccess } from "@/lib/auth";
import { APP_MODULES, getDefaultModulesForRole, type AppModule, type AppRole } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { usuarioFormSchema, usuarioUpdateFormSchema } from "@/lib/validations/usuarios";

export async function createUsuarioAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const parsed = usuarioFormSchema.safeParse({
    nome: String(formData.get("nome") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    senha: String(formData.get("senha") ?? "").trim(),
    papel: String(formData.get("papel") ?? "OPERADOR").trim(),
    depositanteId: String(formData.get("depositanteId") ?? "").trim() || null,
    ativo: formData.get("ativo") === "on",
  });
  const modulePermissions = parseModulePermissions(formData);

  if (!parsed.success) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: {
      nome: parsed.data.nome,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
    },
    app_metadata: {
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
    },
  });

  if (authError || !authUser.user) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  const { error: profileError } = await adminSupabase.from("usuarios").insert({
    id: authUser.user.id,
    email: parsed.data.email,
    nome: parsed.data.nome,
    papel: parsed.data.papel,
    depositante_id: parsed.data.depositanteId,
    ativo: parsed.data.ativo,
  });

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(authUser.user.id);
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  revalidatePaths();
  redirect("/configuracoes/usuarios?feedback=criado");
}

export async function updateUsuarioAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const actor = await getCurrentUserContext();
  const parsed = usuarioUpdateFormSchema.safeParse({
    id: String(formData.get("id") ?? "").trim(),
    nome: String(formData.get("nome") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    senha: String(formData.get("senha") ?? "").trim(),
    papel: String(formData.get("papel") ?? "OPERADOR").trim(),
    depositanteId: String(formData.get("depositanteId") ?? "").trim() || null,
    ativo: formData.get("ativo") === "on",
  });
  const modulePermissions = parseModulePermissions(formData);

  if (!parsed.success) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  if (actor?.id === parsed.data.id && !parsed.data.ativo) {
    redirect("/configuracoes/usuarios?feedback=autoprotecao");
  }

  const adminSupabase = createSupabaseAdminClient();

  const { error: profileError } = await adminSupabase
    .from("usuarios")
    .update({
      email: parsed.data.email,
      nome: parsed.data.nome,
      papel: parsed.data.papel,
      depositante_id: parsed.data.depositanteId,
      ativo: parsed.data.ativo,
    })
    .eq("id", parsed.data.id);

  if (profileError) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  const attributes: {
    email: string;
    user_metadata: { nome: string; papel: string; module_permissions: AppModule[] };
    app_metadata: { papel: string; module_permissions: AppModule[] };
    password?: string;
  } = {
    email: parsed.data.email,
    user_metadata: {
      nome: parsed.data.nome,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
    },
    app_metadata: {
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
    },
  };

  if (parsed.data.senha) {
    attributes.password = parsed.data.senha;
  }

  const { error: authError } = await adminSupabase.auth.admin.updateUserById(
    parsed.data.id,
    attributes,
  );

  if (authError) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  revalidatePaths();
  redirect("/configuracoes/usuarios?feedback=salvo");
}

export async function toggleUsuarioStatusAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const actor = await getCurrentUserContext();
  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("nextActive") ?? "").trim() === "true";

  if (!id) {
    return;
  }

  if (actor?.id === id && !nextActive) {
    redirect("/configuracoes/usuarios?feedback=autoprotecao");
  }

  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.from("usuarios").update({ ativo: nextActive }).eq("id", id);

  revalidatePaths();
}

export async function deleteUsuarioAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const actor = await getCurrentUserContext();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  if (actor?.id === id) {
    redirect("/configuracoes/usuarios?feedback=autoprotecao");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { error } = await adminSupabase.auth.admin.deleteUser(id);

  if (error) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  revalidatePaths();
  redirect("/configuracoes/usuarios?feedback=excluido");
}

function revalidatePaths() {
  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/usuarios");
}

function parseModulePermissions(formData: FormData): AppModule[] {
  const selectedModules = formData
    .getAll("modulos")
    .map((value) => String(value))
    .filter((value): value is AppModule => APP_MODULES.includes(value as AppModule));

  const papel = String(formData.get("papel") ?? "OPERADOR").trim() as AppRole;

  return selectedModules.length ? selectedModules : getDefaultModulesForRole(papel);
}
