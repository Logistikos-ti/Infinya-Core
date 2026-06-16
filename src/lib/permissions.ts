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

export function canAccessModule(user: AppUserContext, module: AppModule) {
  return getEffectiveModules(user).includes(module);
}

export function getEffectiveModules(user: AppUserContext) {
  if (user.modulePermissions?.length) {
    return user.modulePermissions;
  }

  return [...roleDefaultModules[user.papel]];
}

export function getDefaultModulesForRole(role: AppRole) {
  return [...roleDefaultModules[role]];
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

export function isAppModule(value: string): value is AppModule {
  return APP_MODULES.includes(value as AppModule);
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
      return "NFe";
    case "relatorios":
      return "Relatórios";
    case "configuracoes":
      return "Configurações";
    default:
      return module;
  }
}

export function redirectToAccessDenied(module: AppModule) {
  redirect(`/acesso-negado?modulo=${module}`);
}
