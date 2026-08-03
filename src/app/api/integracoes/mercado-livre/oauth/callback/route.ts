import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildMercadoLivreConnectionConfig,
  exchangeMercadoLivreAuthorizationCode,
  fetchMercadoLivreUserInfo,
} from "@/lib/mercado-livre";
import {
  updateDepositanteMercadoLivreConfig,
} from "@/lib/depositantes";
import { requireApiUser } from "@/lib/api-auth";
import { canManagePortalIntegrations } from "@/lib/portal-integration-access";

const stateCookieName = "ml_oauth_state";
const depositanteCookieName = "ml_oauth_depositante_id";
const portalCookieName = "ml_oauth_return_to_portal";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const error = url.searchParams.get("error")?.trim() ?? "";
  const jar = await cookies();
  const expectedState = jar.get(stateCookieName)?.value ?? "";
  const depositanteId = jar.get(depositanteCookieName)?.value ?? "";
  const returnToPortal = jar.get(portalCookieName)?.value === "1";

  jar.delete(stateCookieName);
  jar.delete(depositanteCookieName);
  jar.delete(portalCookieName);

  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const isBackoffice = auth.user.papel === "ADMIN" || auth.user.papel === "TI";
  const isOwnPortalIntegration = returnToPortal && canManagePortalIntegrations(auth.user, depositanteId);
  const resultPath = isOwnPortalIntegration ? "/portal?view=integracoes" : "/configuracoes/integracoes";

  if (!isBackoffice && !isOwnPortalIntegration) {
    return NextResponse.redirect(new URL("/portal?view=integracoes&feedback=erro&motivo=Sem%20permiss%C3%A3o%20para%20concluir%20esta%20integra%C3%A7%C3%A3o.", request.url));
  }

  if (error) {
    return NextResponse.redirect(
      new URL(
        `${resultPath}&feedback=erro&motivo=${encodeURIComponent(
          `Mercado Livre retornou: ${error}`,
        )}`,
        request.url,
      ),
    );
  }

  if (!code || !state || !depositanteId || state !== expectedState) {
    return NextResponse.redirect(
      new URL(
        `${resultPath}&feedback=erro&motivo=${encodeURIComponent(
          "Não foi possível validar o retorno OAuth do Mercado Livre.",
        )}`,
        request.url,
      ),
    );
  }

  try {
    const tokens = await exchangeMercadoLivreAuthorizationCode(code);
    const user = await fetchMercadoLivreUserInfo(tokens.access_token);

    const adminSupabase = createSupabaseAdminClient();
    const { data: depositante } = await adminSupabase
      .from("depositantes")
      .select("id, configuracoes, observacoes")
      .eq("id", depositanteId)
      .maybeSingle();

    if (!depositante) {
      throw new Error("Depositante não encontrado para concluir a conexão do Mercado Livre.");
    }

    const rawConfig = depositante.configuracoes
      ? JSON.stringify(depositante.configuracoes)
      : depositante.observacoes;
    const nextConfig = buildMercadoLivreConnectionConfig(tokens, user);

    const { error: updateError } = await adminSupabase
      .from("depositantes")
      .update({
        configuracoes: updateDepositanteMercadoLivreConfig(rawConfig, nextConfig),
      })
      .eq("id", depositanteId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.redirect(
      new URL(`${resultPath}&feedback=mercado-livre-conectado`, request.url),
    );
  } catch (callbackError) {
    const message =
      callbackError instanceof Error
        ? callbackError.message
        : "Falha ao concluir a conexão do Mercado Livre.";

    return NextResponse.redirect(
      new URL(
        `${resultPath}&feedback=erro&motivo=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}
