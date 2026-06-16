import { NextResponse } from "next/server";
import { getAccessDeniedErrorMessage, getCurrentUserContext } from "@/lib/auth";
import {
  canAccessModule,
  hasRoleAccess,
  type AppModule,
  type AppRole,
} from "@/lib/permissions";

export {
  ensureUserCanAccessDepositante,
  filterItemsByUserDepositante,
  isScopedDepositanteUser,
} from "@/lib/tenant-scope";

export async function requireApiUser() {
  const user = await getCurrentUserContext();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Sessão expirada. Faça login novamente." },
        { status: 401 },
      ),
    };
  }

  if (!user.ativo) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Este usuário está inativo no WMS." },
        { status: 403 },
      ),
    };
  }

  return { user, response: null };
}

export async function requireApiModuleAccess(module: AppModule) {
  const auth = await requireApiUser();

  if (auth.response) {
    return auth;
  }

  if (!canAccessModule(auth.user, module)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: getAccessDeniedErrorMessage(module) },
        { status: 403 },
      ),
    };
  }

  return auth;
}

export async function requireApiRoleAccess(roles: readonly AppRole[]) {
  const auth = await requireApiUser();

  if (auth.response) {
    return auth;
  }

  if (!hasRoleAccess(auth.user, roles)) {
    return {
      user: null,
      response: NextResponse.json(
        {
          error: `Seu perfil não tem acesso a este recurso. Permissão necessária: ${roles
            .map(getRoleLabelForApi)
            .join(", ")}.`,
        },
        { status: 403 },
      ),
    };
  }

  return auth;
}

function getRoleLabelForApi(role: AppRole) {
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

export function createForbiddenModuleResponse(module: AppModule) {
  return NextResponse.json(
    { error: getAccessDeniedErrorMessage(module) },
    { status: 403 },
  );
}
