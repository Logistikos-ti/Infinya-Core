import { NextResponse } from "next/server";
import {
  getAccessDeniedErrorMessage,
  getConfigSectionAccessDeniedErrorMessage,
  getCurrentUserContext,
} from "@/lib/auth";
import {
  canAccessConfigSection,
  canAccessModule,
  hasRoleAccess,
  type AppModule,
  type AppRole,
  type ConfigSection,
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
      response: NextResponse.json({ error: getAccessDeniedErrorMessage(module) }, { status: 403 }),
    };
  }

  return auth;
}

/**
 * Acesso aos documentos anexados a um pedido de expedição (XML da NF-e,
 * DANFE, etiqueta, carta de correção).
 *
 * O portal mostra esses anexos ao depositante, mas o papel DEPOSITANTE não
 * tem o módulo `expedicao` — só ADMIN, TI e OPERADOR têm. Com o gate padrão
 * o card aparecia habilitado no portal e o download respondia 403.
 *
 * Aqui liberamos o depositante apenas para estas rotas de documento. Isso
 * não amplia o que ele enxerga: cada rota ainda chama
 * `ensureUserCanAccessDepositante` com o depositante do pedido, então ele
 * continua restrito aos próprios pedidos, e segue sem acesso à tela
 * `/expedicao` do backoffice.
 */
export async function requireApiShippingDocumentAccess() {
  const auth = await requireApiUser();

  if (auth.response) {
    return auth;
  }

  if (auth.user.papel === "DEPOSITANTE" || canAccessModule(auth.user, "expedicao")) {
    return auth;
  }

  return {
    user: null,
    response: NextResponse.json({ error: getAccessDeniedErrorMessage("expedicao") }, { status: 403 }),
  };
}

export async function requireApiConfigSectionAccess(section: ConfigSection) {
  const auth = await requireApiModuleAccess("configuracoes");

  if (auth.response) {
    return auth;
  }

  if (!canAccessConfigSection(auth.user, section)) {
    return {
      user: null,
      response: NextResponse.json(
        { error: getConfigSectionAccessDeniedErrorMessage(section) },
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
