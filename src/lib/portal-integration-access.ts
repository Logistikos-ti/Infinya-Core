import type { AppUserContext } from "@/lib/auth";

const enabledDepositantes = new Set(["vegpet", "johnskull"]);

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]/g, "");
}

export function isPortalIntegrationEnabled(depositanteName: string | null | undefined) {
  return enabledDepositantes.has(normalize(depositanteName));
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
    isPortalIntegrationEnabled(user.depositanteNome)
  );
}
