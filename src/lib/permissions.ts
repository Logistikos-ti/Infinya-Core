import { redirect } from "next/navigation";
import type { AppUserContext } from "@/lib/auth";

export type AppRole = AppUserContext["papel"];

export type AppModule =
  | "dashboard"
  | "recebimento"
  | "expedicao"
  | "romaneio"
  | "estoque"
  | "nfe"
  | "relatorios"
  | "configuracoes";

export type ConfigSection =
  | "depositantes"
  | "usuarios"
  | "produtos"
  | "enderecos"
  | "transportadoras"
  | "integracoes";

export const APP_MODULES: AppModule[] = [
  "dashboard",
  "recebimento",
  "expedicao",
  "romaneio",
  "estoque",
  "nfe",
  "relatorios",
  "configuracoes",
];

export const CONFIG_SECTIONS: ConfigSection[] = [
  "depositantes",
  "usuarios",
  "produtos",
  "enderecos",
  "transportadoras",
  "integracoes",
];

const roleDefaultModules: Record<AppRole, readonly AppModule[]> = {
  ADMIN: [
    "dashboard",
    "recebimento",
    "expedicao",
    "romaneio",
    "estoque",
    "nfe",
    "relatorios",
    "configuracoes",
  ],
  TI: [
    "dashboard",
    "recebimento",
    "expedicao",
    "romaneio",
    "estoque",
    "nfe",
    "relatorios",
    "configuracoes",
  ],
  OPERADOR: ["dashboard", "recebimento", "expedicao", "romaneio", "estoque", "nfe", "relatorios"],
  DEPOSITANTE: ["dashboard", "estoque", "nfe", "relatorios"],
};

export function hasRoleAccess(user: AppUserContext, roles: readonly AppRole[]) {
  return roles.includes(user.papel);
}

export function getEffectiveModules(user: AppUserContext) {
  if (user.modulePermissions?.length) {
    return user.modulePermissions;
  }

  return [...roleDefaultModules[user.papel]];
}

export function canAccessModule(user: AppUserContext, module: AppModule) {
  return getEffectiveModules(user).includes(module);
}

export function isProductCatalogOnlyUser(user: AppUserContext) {
  const effectiveModules = getEffectiveModules(user);

  return (
    !isAdminUser(user) &&
    effectiveModules.length === 1 &&
    effectiveModules[0] === "configuracoes" &&
    canAccessConfigSection(user, "produtos")
  );
}

export function getDefaultModulesForRole(role: AppRole) {
  return [...roleDefaultModules[role]];
}

export function getEffectiveConfigSections(user: AppUserContext) {
  if (!canAccessModule(user, "configuracoes")) {
    return [] as ConfigSection[];
  }

  if (user.configSections?.length) {
    return user.configSections;
  }

  return [...CONFIG_SECTIONS];
}

export function canAccessConfigSection(user: AppUserContext, section: ConfigSection) {
  return getEffectiveConfigSections(user).includes(section);
}

export function isAdminUser(user: AppUserContext) {
  return hasRoleAccess(user, ["ADMIN", "TI"]);
}

export function canManageMultipleTenants(user: AppUserContext) {
  return hasRoleAccess(user, ["ADMIN", "TI", "OPERADOR"]);
}

export function canUploadOperationalDocuments(user: AppUserContext) {
  return canAccessModule(user, "recebimento") || hasRoleAccess(user, ["ADMIN", "TI", "OPERADOR"]);
}

export function getPreferredWebRoute(user: AppUserContext) {
  if (isProductCatalogOnlyUser(user)) {
    return "/configuracoes/produtos";
  }

  if (canAccessModule(user, "dashboard")) {
    return "/dashboard";
  }

  if (canAccessModule(user, "configuracoes") && canAccessConfigSection(user, "produtos")) {
    return "/configuracoes/produtos";
  }

  if (canAccessModule(user, "recebimento")) {
    return "/recebimento";
  }

  if (canAccessModule(user, "expedicao")) {
    return "/expedicao";
  }

  if (canAccessModule(user, "estoque")) {
    return "/estoque";
  }

  if (canAccessModule(user, "romaneio")) {
    return "/romaneio";
  }

  if (canAccessModule(user, "nfe")) {
    return "/nfe";
  }

  if (canAccessModule(user, "relatorios")) {
    return "/relatorios";
  }

  if (canAccessModule(user, "configuracoes")) {
    return "/configuracoes";
  }

  return "/login";
}

export function isAppModule(value: string): value is AppModule {
  return APP_MODULES.includes(value as AppModule);
}

export function isConfigSection(value: string): value is ConfigSection {
  return CONFIG_SECTIONS.includes(value as ConfigSection);
}

export function getRoleLabel(role: AppRole) {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "TI":
      return "TI";
    case "OPERADOR":
      return "Operador";
    case "DEPOSITANTE":
      return "Depositante";
    default:
      return role;
  }
}

export function getModuleLabel(module: AppModule) {
  switch (module) {
    case "dashboard":
      return "Dashboard";
    case "recebimento":
      return "Recebimento";
    case "expedicao":
      return "Expedição";
    case "romaneio":
      return "Romaneio";
    case "estoque":
      return "Estoque";
    case "nfe":
      return "NF-e";
    case "relatorios":
      return "Relatórios";
    case "configuracoes":
      return "Configurações";
    default:
      return module;
  }
}

export function getConfigSectionLabel(section: ConfigSection) {
  switch (section) {
    case "depositantes":
      return "Depositantes";
    case "usuarios":
      return "Usuários";
    case "produtos":
      return "Produtos";
    case "enderecos":
      return "Endereços";
    case "transportadoras":
      return "Transportadoras";
    case "integracoes":
      return "Integrações";
    default:
      return section;
  }
}

export function redirectToAccessDenied(module: AppModule) {
  redirect(`/acesso-negado?modulo=${module}`);
}
