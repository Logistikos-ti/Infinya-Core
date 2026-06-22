import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildMercadoLivreAuthorizationUrl, createMercadoLivreOAuthState } from "@/lib/mercado-livre";
import { getAppEnv } from "@/lib/env";

const stateCookieName = "ml_oauth_state";
const depositanteCookieName = "ml_oauth_depositante_id";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const depositanteId = url.searchParams.get("depositanteId")?.trim() ?? "";

  if (!depositanteId) {
    return NextResponse.redirect(new URL("/configuracoes/integracoes?feedback=erro", request.url));
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

  return NextResponse.redirect(buildMercadoLivreAuthorizationUrl(state));
}
