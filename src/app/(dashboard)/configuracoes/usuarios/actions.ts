"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext, requireRoleAccess } from "@/lib/auth";
import {
  APP_MODULES,
  CONFIG_SECTIONS,
  getDefaultModulesForRole,
  type AppModule,
  type AppRole,
  type ConfigSection,
} from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildInternalAuthEmail, normalizeUserLogin } from "@/lib/user-login";
import { usuarioFormSchema, usuarioUpdateFormSchema } from "@/lib/validations/usuarios";

export type UsuarioActionState = {
  success: boolean;
  message: string | null;
};

export async function saveUsuarioAction(
  _prevState: UsuarioActionState,
  formData: FormData,
): Promise<UsuarioActionState> {
  const id = String(formData.get("id") ?? "").trim();

  if (id) {
    return updateUsuarioActionState(formData, id);
  }

  return createUsuarioActionState(formData);
}

async function createUsuarioActionState(formData: FormData): Promise<UsuarioActionState> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const parsed = usuarioFormSchema.safeParse({
    nome: String(formData.get("nome") ?? "").trim(),
    login: normalizeUserLogin(String(formData.get("login") ?? "")),
    senha: String(formData.get("senha") ?? "").trim(),
    papel: String(formData.get("papel") ?? "OPERADOR").trim(),
    depositanteId: String(formData.get("depositanteId") ?? "").trim() || null,
    ativo: formData.get("ativo") === "on",
  });
  const modulePermissions = parseModulePermissions(formData);
  const configSections = parseConfigSections(formData, modulePermissions);
  const portalProfile = parsePortalProfile(
    formData,
    String(formData.get("papel") ?? "OPERADOR"),
  );
  const contactEmail = String(formData.get("email") ?? "").trim() || null;

  if (!parsed.success) {
    return { success: false, message: "Revise os campos e tente novamente." };
  }

  const adminSupabase = createSupabaseAdminClient();
  const generatedEmail = buildInternalAuthEmail(parsed.data.login, randomUUID());

  const { data: existingLogin } = await adminSupabase
    .from("usuarios")
    .select("id")
    .eq("login", parsed.data.login)
    .maybeSingle();

  if (existingLogin) {
    return {
      success: false,
      message: "Esse ID de usuário já existe. Escolha outro identificador.",
    };
  }

  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email: generatedEmail,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: {
      nome: parsed.data.nome,
      login: parsed.data.login,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
      config_sections: configSections,
      portal_profile: portalProfile,
      force_password_reset: true,
      contact_email: contactEmail,
    },
    app_metadata: {
      login: parsed.data.login,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
      config_sections: configSections,
      portal_profile: portalProfile,
      force_password_reset: true,
      contact_email: contactEmail,
    },
  });

  if (authError || !authUser.user) {
    return { success: false, message: "Não foi possível criar o usuário." };
  }

  const { error: profileError } = await adminSupabase.from("usuarios").insert({
    id: authUser.user.id,
    email: generatedEmail,
    login: parsed.data.login,
    nome: parsed.data.nome,
    papel: parsed.data.papel,
    depositante_id: parsed.data.depositanteId,
    ativo: parsed.data.ativo,
  });

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(authUser.user.id);
    return { success: false, message: "Não foi possível gravar o perfil do usuário." };
  }

  revalidatePaths();
  return { success: true, message: "Usuário criado com sucesso." };
}

async function updateUsuarioActionState(
  formData: FormData,
  id: string,
): Promise<UsuarioActionState> {
  await requireRoleAccess(["ADMIN", "TI"]);

  const actor = await getCurrentUserContext();
  const parsed = usuarioUpdateFormSchema.safeParse({
    id,
    nome: String(formData.get("nome") ?? "").trim(),
    login: normalizeUserLogin(String(formData.get("login") ?? "")),
    senha: String(formData.get("senha") ?? "").trim(),
    papel: String(formData.get("papel") ?? "OPERADOR").trim(),
    depositanteId: String(formData.get("depositanteId") ?? "").trim() || null,
    ativo: formData.get("ativo") === "on",
  });
  const modulePermissions = parseModulePermissions(formData);
  const configSections = parseConfigSections(formData, modulePermissions);
  const portalProfile = parsePortalProfile(
    formData,
    String(formData.get("papel") ?? "OPERADOR"),
  );
  const contactEmail = String(formData.get("email") ?? "").trim() || null;

  if (!parsed.success) {
    return { success: false, message: "Revise os campos e tente novamente." };
  }

  if (actor?.id === parsed.data.id && !parsed.data.ativo) {
    return {
      success: false,
      message: "Seu próprio usuário não pode ser desativado por esta tela.",
    };
  }

  const adminSupabase = createSupabaseAdminClient();

  const { data: existingLogin } = await adminSupabase
    .from("usuarios")
    .select("id")
    .eq("login", parsed.data.login)
    .neq("id", parsed.data.id)
    .maybeSingle();

  if (existingLogin) {
    return {
      success: false,
      message: "Esse ID de usuário já existe. Escolha outro identificador.",
    };
  }

  const { data: currentProfile } = await adminSupabase
    .from("usuarios")
    .select("email")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const { data: currentAuthUser } = await adminSupabase.auth.admin.getUserById(parsed.data.id);

  const persistedEmail =
    currentProfile?.email || buildInternalAuthEmail(parsed.data.login, parsed.data.id);
  const forcePasswordReset = parsed.data.senha
    ? true
    : currentAuthUser?.user?.user_metadata?.force_password_reset === true;

  const { error: profileError } = await adminSupabase
    .from("usuarios")
    .update({
      email: persistedEmail,
      login: parsed.data.login,
      nome: parsed.data.nome,
      papel: parsed.data.papel,
      depositante_id: parsed.data.depositanteId,
      ativo: parsed.data.ativo,
    })
    .eq("id", parsed.data.id);

  if (profileError) {
    return { success: false, message: "Não foi possível atualizar o perfil do usuário." };
  }

  const attributes: {
    email: string;
    user_metadata: {
      nome: string;
      login: string;
      papel: string;
      module_permissions: AppModule[];
      config_sections: ConfigSection[];
      portal_profile: "GESTOR" | "COLABORADOR";
      force_password_reset: boolean;
      contact_email: string | null;
    };
    app_metadata: {
      login: string;
      papel: string;
      module_permissions: AppModule[];
      config_sections: ConfigSection[];
      portal_profile: "GESTOR" | "COLABORADOR";
      force_password_reset: boolean;
      contact_email: string | null;
    };
    password?: string;
  } = {
    email: persistedEmail,
    user_metadata: {
      nome: parsed.data.nome,
      login: parsed.data.login,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
      config_sections: configSections,
      portal_profile: portalProfile,
      force_password_reset: forcePasswordReset,
      contact_email: contactEmail,
    },
    app_metadata: {
      login: parsed.data.login,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
      config_sections: configSections,
      portal_profile: portalProfile,
      force_password_reset: forcePasswordReset,
      contact_email: contactEmail,
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
    return { success: false, message: "Não foi possível atualizar o usuário." };
  }

  revalidatePaths();
  return { success: true, message: "Usuário atualizado com sucesso." };
}

export async function createUsuarioAction(formData: FormData) {
  await requireRoleAccess(["ADMIN", "TI"]);

  const parsed = usuarioFormSchema.safeParse({
    nome: String(formData.get("nome") ?? "").trim(),
    login: normalizeUserLogin(String(formData.get("login") ?? "")),
    senha: String(formData.get("senha") ?? "").trim(),
    papel: String(formData.get("papel") ?? "OPERADOR").trim(),
    depositanteId: String(formData.get("depositanteId") ?? "").trim() || null,
    ativo: formData.get("ativo") === "on",
  });
  const modulePermissions = parseModulePermissions(formData);
  const configSections = parseConfigSections(formData, modulePermissions);
  const portalProfile = parsePortalProfile(
    formData,
    String(formData.get("papel") ?? "OPERADOR"),
  );
  const contactEmail = String(formData.get("email") ?? "").trim() || null;

  if (!parsed.success) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const generatedEmail = buildInternalAuthEmail(parsed.data.login, randomUUID());

  const { data: existingLogin } = await adminSupabase
    .from("usuarios")
    .select("id")
    .eq("login", parsed.data.login)
    .maybeSingle();

  if (existingLogin) {
    redirect("/configuracoes/usuarios?feedback=login-duplicado");
  }

  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email: generatedEmail,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: {
      nome: parsed.data.nome,
      login: parsed.data.login,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
      config_sections: configSections,
      portal_profile: portalProfile,
      force_password_reset: true,
      contact_email: contactEmail,
    },
    app_metadata: {
      login: parsed.data.login,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
      config_sections: configSections,
      portal_profile: portalProfile,
      force_password_reset: true,
      contact_email: contactEmail,
    },
  });

  if (authError || !authUser.user) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  const { error: profileError } = await adminSupabase.from("usuarios").insert({
    id: authUser.user.id,
    email: generatedEmail,
    login: parsed.data.login,
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
    login: normalizeUserLogin(String(formData.get("login") ?? "")),
    senha: String(formData.get("senha") ?? "").trim(),
    papel: String(formData.get("papel") ?? "OPERADOR").trim(),
    depositanteId: String(formData.get("depositanteId") ?? "").trim() || null,
    ativo: formData.get("ativo") === "on",
  });
  const modulePermissions = parseModulePermissions(formData);
  const configSections = parseConfigSections(formData, modulePermissions);
  const portalProfile = parsePortalProfile(
    formData,
    String(formData.get("papel") ?? "OPERADOR"),
  );
  const contactEmail = String(formData.get("email") ?? "").trim() || null;

  if (!parsed.success) {
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  if (actor?.id === parsed.data.id && !parsed.data.ativo) {
    redirect("/configuracoes/usuarios?feedback=autoprotecao");
  }

  const adminSupabase = createSupabaseAdminClient();

  const { data: existingLogin } = await adminSupabase
    .from("usuarios")
    .select("id")
    .eq("login", parsed.data.login)
    .neq("id", parsed.data.id)
    .maybeSingle();

  if (existingLogin) {
    redirect("/configuracoes/usuarios?feedback=login-duplicado");
  }

  const { data: currentProfile } = await adminSupabase
    .from("usuarios")
    .select("email")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const { data: currentAuthUser } = await adminSupabase.auth.admin.getUserById(parsed.data.id);

  const persistedEmail =
    currentProfile?.email || buildInternalAuthEmail(parsed.data.login, parsed.data.id);
  const forcePasswordReset = parsed.data.senha
    ? true
    : currentAuthUser?.user?.user_metadata?.force_password_reset === true;

  const { error: profileError } = await adminSupabase
    .from("usuarios")
    .update({
      email: persistedEmail,
      login: parsed.data.login,
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
    user_metadata: {
      nome: string;
      login: string;
      papel: string;
      module_permissions: AppModule[];
      config_sections: ConfigSection[];
      portal_profile: "GESTOR" | "COLABORADOR";
      force_password_reset: boolean;
      contact_email: string | null;
    };
    app_metadata: {
      login: string;
      papel: string;
      module_permissions: AppModule[];
      config_sections: ConfigSection[];
      portal_profile: "GESTOR" | "COLABORADOR";
      force_password_reset: boolean;
      contact_email: string | null;
    };
    password?: string;
  } = {
    email: persistedEmail,
    user_metadata: {
      nome: parsed.data.nome,
      login: parsed.data.login,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
      config_sections: configSections,
      portal_profile: portalProfile,
      force_password_reset: forcePasswordReset,
      contact_email: contactEmail,
    },
    app_metadata: {
      login: parsed.data.login,
      papel: parsed.data.papel,
      module_permissions: modulePermissions,
      config_sections: configSections,
      portal_profile: portalProfile,
      force_password_reset: forcePasswordReset,
      contact_email: contactEmail,
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
  const isSpa = String(formData.get("isSpa") ?? "") === "true";

  if (!id) {
    if (isSpa) return { success: false, message: "ID do usuário não informado." };
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  if (actor?.id === id) {
    if (isSpa) {
      return {
        success: false,
        message: "Seu próprio usuário não pode ser excluído por esta tela.",
      };
    }
    redirect("/configuracoes/usuarios?feedback=autoprotecao");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { error } = await adminSupabase.auth.admin.deleteUser(id);

  if (error) {
    if (isSpa) return { success: false, message: "Não foi possível excluir o usuário." };
    redirect("/configuracoes/usuarios?feedback=erro");
  }

  revalidatePaths();
  if (isSpa) return { success: true, message: "Usuário excluído." };
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

function parseConfigSections(formData: FormData, modulePermissions: AppModule[]): ConfigSection[] {
  if (!modulePermissions.includes("configuracoes")) {
    return [];
  }

  const selectedSections = formData
    .getAll("configSections")
    .map((value) => String(value))
    .filter((value): value is ConfigSection => CONFIG_SECTIONS.includes(value as ConfigSection));

  return selectedSections.length ? selectedSections : [...CONFIG_SECTIONS];
}

function parsePortalProfile(formData: FormData, papel: string): "GESTOR" | "COLABORADOR" {
  if (papel !== "DEPOSITANTE") return "GESTOR";
  return formData.get("portalProfile") === "COLABORADOR" ? "COLABORADOR" : "GESTOR";
}
