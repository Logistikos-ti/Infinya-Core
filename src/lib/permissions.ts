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
  | "yms"
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
  "yms",
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
    "yms",
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
    "yms",
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
    const modules = [...user.modulePermissions];

    // Recebimento está liberado para todos os operadores, inclusive os que
    // ainda carregam uma lista personalizada criada antes desse módulo.
    if (user.papel === "OPERADOR" && !modules.includes("recebimento")) {
      modules.push("recebimento");
    }

    if (
      user.papel === "OPERADOR" &&
      modules.includes("estoque") &&
      !modules.includes("expedicao")
    ) {
      modules.push("expedicao");
    }

    if (
      user.papel === "OPERADOR" &&
      modules.includes("expedicao") &&
      !modules.includes("romaneio")
    ) {
      modules.push("romaneio");
    }

    return modules;
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

export function isCatalogAndStockOperatorUser(user: AppUserContext) {
  const effectiveModules = getEffectiveModules(user);

  return (
    !isAdminUser(user) &&
    effectiveModules.includes("configuracoes") &&
    (effectiveModules.includes("estoque") ||
      effectiveModules.includes("expedicao") ||
      effectiveModules.includes("romaneio")) &&
    effectiveModules.every((module) =>
      ["configuracoes", "recebimento", "estoque", "expedicao", "romaneio"].includes(module),
    ) &&
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

  const sections = user.configSections?.length ? [...user.configSections] : [...CONFIG_SECTIONS];

  // Operadores com acesso operacional a estoque + cadastro de produtos
  // também precisam manter o endereçamento do armazém sem depender de ajuste manual.
  if (
    user.papel === "OPERADOR" &&
    canAccessModule(user, "estoque") &&
    sections.includes("produtos") &&
    !sections.includes("enderecos")
  ) {
    sections.push("enderecos");
  }

  return sections;
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
  if (user.papel === "DEPOSITANTE") {
    return "/portal";
  }

  if (isProductCatalogOnlyUser(user)) {
    return "/configuracoes/produtos";
  }

  if (isCatalogAndStockOperatorUser(user)) {
    if (canAccessModule(user, "estoque")) {
      return "/estoque";
    }

    if (canAccessModule(user, "expedicao")) {
      return "/expedicao";
    }

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
    case "yms":
      return "YMS";
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
