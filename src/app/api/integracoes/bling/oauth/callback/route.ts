import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { buildBlingConnectionConfig, exchangeBlingAuthorizationCode, fetchBlingCompanyInfo, getBlingWebhookUrl } from "@/lib/bling";
import { updateDepositanteBlingConfig } from "@/lib/depositantes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const oauthStateCookieName = "bling_oauth_state";

export async function GET(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() ?? "";
  const state = requestUrl.searchParams.get("state")?.trim() ?? "";
  const oauthCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${oauthStateCookieName}=`));

  if (!code || !state || !oauthCookie) {
    return NextResponse.redirect(new URL("/configuracoes/integracoes?feedback=erro", request.url));
  }

  const rawCookieValue = decodeURIComponent(oauthCookie.split("=").slice(1).join("="));

  let cookiePayload: { state: string; depositanteId: string; createdAt: number } | null = null;

  try {
    cookiePayload = JSON.parse(rawCookieValue) as {
      state: string;
      depositanteId: string;
      createdAt: number;
    };
  } catch {
    cookiePayload = null;
  }

  if (!cookiePayload || cookiePayload.state !== state || !cookiePayload.depositanteId) {
    return NextResponse.redirect(new URL("/configuracoes/integracoes?feedback=erro", request.url));
  }

  try {
    const tokens = await exchangeBlingAuthorizationCode(code);
    let company = null;

    try {
      company = await fetchBlingCompanyInfo(tokens.access_token);
    } catch {
      company = null;
    }

    const adminSupabase = createSupabaseAdminClient();
    const { data: depositante, error } = await adminSupabase
      .from("depositantes")
      .select("id, configuracoes, observacoes")
      .eq("id", cookiePayload.depositanteId)
      .maybeSingle();

    if (error || !depositante) {
      throw new Error("Depositante não encontrado para concluir a integração.");
    }

    const rawConfig = depositante.configuracoes
      ? JSON.stringify(depositante.configuracoes)
      : depositante.observacoes;
    const nextBlingConfig = buildBlingConnectionConfig(
      tokens,
      company,
      getBlingWebhookUrl(requestUrl.origin),
    );

    const { error: updateError } = await adminSupabase
      .from("depositantes")
      .update({
        configuracoes: updateDepositanteBlingConfig(rawConfig, nextBlingConfig),
      })
      .eq("id", depositante.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const response = NextResponse.redirect(
      new URL("/configuracoes/integracoes?feedback=bling-conectado", request.url),
    );
    response.cookies.delete(oauthStateCookieName);
    return response;
  } catch (error) {
    const response = NextResponse.redirect(
      new URL(
        `/configuracoes/integracoes?feedback=erro&motivo=${encodeURIComponent(
          error instanceof Error ? error.message : "Falha ao concluir a autenticação no Bling.",
        )}`,
        request.url,
      ),
    );
    response.cookies.delete(oauthStateCookieName);
    return response;
  }
}
