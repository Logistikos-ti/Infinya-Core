import type { AppUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";

export function getDefaultMobileRoute(user: AppUserContext) {
  if (canAccessModule(user, "expedicao")) {
    return "/m/inicio";
  }

  if (canAccessModule(user, "recebimento")) {
    return "/m/recebimento";
  }

  if (canAccessModule(user, "estoque")) {
    return "/m/inicio";
  }

  return "/dashboard";
}

export function getMobileWelcomeLabel(user: AppUserContext) {
  if (user.papel === "OPERADOR") {
    return "Operação em campo";
  }

  if (user.papel === "DEPOSITANTE") {
    return "Consulta operacional";
  }

  return "Controle móvel";
}
