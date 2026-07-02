import { cache } from "react";
import { redirect } from "next/navigation";
import {
  APP_MODULES,
  CONFIG_SECTIONS,
  canAccessConfigSection,
  canAccessModule,
  getConfigSectionLabel,
  getModuleLabel,
  hasRoleAccess,
  redirectToAccessDenied,
  type AppModule,
  type AppRole,
  type ConfigSection,
} from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppUserContext = {
  id: string;
  email: string;
  login: string | null;
  nome: string;
  papel: "ADMIN" | "TI" | "OPERADOR" | "DEPOSITANTE";
  depositanteId: string | null;
  depositanteNome: string | null;
  ativo: boolean;
  modulePermissions: AppModule[] | null;
  configSections: ConfigSection[] | null;
};

export const getCurrentUserContext = cache(async (): Promise<AppUserContext | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("usuarios")
    .select("id, email, login, nome, papel, depositante_id, ativo, depositante:depositantes(nome)")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    login: typeof profile.login === "string" ? profile.login : null,
    nome: profile.nome,
    papel: profile.papel,
    depositanteId: profile.depositante_id,
    depositanteNome: extractDepositanteNome(profile.depositante),
    ativo: profile.ativo,
    modulePermissions: parseModulePermissions(user.user_metadata?.module_permissions),
    configSections: parseConfigSections(user.user_metadata?.config_sections),
  };
});

export async function requireUserContext() {
  const user = await getCurrentUserContext();

  if (!user) {
    redirect("/login");
  }

  if (!user.ativo) {
    redirect("/login?motivo=inativo");
  }

  return user;
}

export async function requireModuleAccess(module: AppModule) {
  const user = await requireUserContext();

  if (!canAccessModule(user, module)) {
    redirectToAccessDenied(module);
  }

  return user;
}

export async function requireConfigSectionAccess(section: ConfigSection) {
  const user = await requireModuleAccess("configuracoes");

  if (!canAccessConfigSection(user, section)) {
    redirect(`/acesso-negado?motivo=configuracoes&secao=${encodeURIComponent(section)}`);
  }

  return user;
}

export async function requireRoleAccess(roles: readonly AppRole[]) {
  const user = await requireUserContext();

  if (!hasRoleAccess(user, roles)) {
    redirect(`/acesso-negado?motivo=papel&papel=${encodeURIComponent(user.papel)}`);
  }

  return user;
}

export function getAccessDeniedErrorMessage(module: AppModule) {
  return `Seu perfil não tem acesso ao módulo de ${getModuleLabel(module)}.`;
}

export function getConfigSectionAccessDeniedErrorMessage(section: ConfigSection) {
  return `Seu perfil não tem acesso à área de ${getConfigSectionLabel(section)} dentro de Configurações.`;
}

function parseModulePermissions(value: unknown): AppModule[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const validModules = value.filter(
    (item): item is AppModule => typeof item === "string" && APP_MODULES.includes(item as AppModule),
  );

  return validModules.length ? validModules : null;
}

function parseConfigSections(value: unknown): ConfigSection[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const validSections = value.filter(
    (item): item is ConfigSection =>
      typeof item === "string" && CONFIG_SECTIONS.includes(item as ConfigSection),
  );

  return validSections.length ? validSections : null;
}

function extractDepositanteNome(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first?.nome === "string" ? first.nome : null;
  }

  if (value && typeof value === "object" && "nome" in value) {
    const nome = (value as { nome?: unknown }).nome;
    return typeof nome === "string" ? nome : null;
  }

  return null;
}
