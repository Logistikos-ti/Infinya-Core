import type { AppUserContext } from "@/lib/auth";

export function isPortalIntegrationEnabled(depositanteName: string | null | undefined) {
  return Boolean(depositanteName?.trim());
}

export function canManagePortalIntegrations(
  user: AppUserContext,
  depositanteId: string,
) {
  if (user.papel === "ADMIN" || user.papel === "TI") {
    return true;
  }

  return (
    user.papel === "DEPOSITANTE" &&
    user.depositanteId === depositanteId &&
    user.portalProfile === "GESTOR"
  );
}

export function canManagePortalStock(user: AppUserContext) {
  return (
    user.papel === "ADMIN" ||
    user.papel === "TI" ||
    (user.papel === "DEPOSITANTE" && user.portalProfile === "GESTOR")
  );
}
