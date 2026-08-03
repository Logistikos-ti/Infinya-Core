import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildMercadoLivreAuthorizationUrl, createMercadoLivreOAuthState } from "@/lib/mercado-livre";
import { getAppEnv } from "@/lib/env";
import { requireApiUser } from "@/lib/api-auth";
import { canManagePortalIntegrations } from "@/lib/portal-integration-access";

const stateCookieName = "ml_oauth_state";
const depositanteCookieName = "ml_oauth_depositante_id";
const portalCookieName = "ml_oauth_return_to_portal";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const depositanteId = url.searchParams.get("depositanteId")?.trim() ?? "";
  const portalRequest = url.searchParams.get("portal") === "1";
  const auth = await requireApiUser();

  if (auth.response) return auth.response;

  const isBackoffice = auth.user.papel === "ADMIN" || auth.user.papel === "TI";
  const isOwnPortalIntegration = portalRequest && canManagePortalIntegrations(auth.user, depositanteId);

  if (!depositanteId || (!isBackoffice && !isOwnPortalIntegration)) {
    return NextResponse.redirect(new URL(portalRequest ? "/portal?view=integracoes&feedback=erro" : "/configuracoes/integracoes?feedback=erro", request.url));
  }

  const isSecureCookie = getAppEnv().publicAppUrl.startsWith("https://");
  const state = createMercadoLivreOAuthState();
  const jar = await cookies();
  jar.set(stateCookieName, state, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  jar.set(depositanteCookieName, depositanteId, {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  jar.set(portalCookieName, isOwnPortalIntegration ? "1" : "0", {
    httpOnly: true,
    secure: isSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildMercadoLivreAuthorizationUrl(state));
}
