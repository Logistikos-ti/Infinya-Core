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

const stateCookieName = "ml_oauth_state";
const depositanteCookieName = "ml_oauth_depositante_id";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const error = url.searchParams.get("error")?.trim() ?? "";
  const jar = await cookies();
  const expectedState = jar.get(stateCookieName)?.value ?? "";
  const depositanteId = jar.get(depositanteCookieName)?.value ?? "";

  jar.delete(stateCookieName);
  jar.delete(depositanteCookieName);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/configuracoes/integracoes?feedback=erro&motivo=${encodeURIComponent(
          `Mercado Livre retornou: ${error}`,
        )}`,
        request.url,
      ),
    );
  }

  if (!code || !state || !depositanteId || state !== expectedState) {
    return NextResponse.redirect(
      new URL(
        `/configuracoes/integracoes?feedback=erro&motivo=${encodeURIComponent(
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
      new URL("/configuracoes/integracoes?feedback=mercado-livre-conectado", request.url),
    );
  } catch (callbackError) {
    const message =
      callbackError instanceof Error
        ? callbackError.message
        : "Falha ao concluir a conexão do Mercado Livre.";

    return NextResponse.redirect(
      new URL(
        `/configuracoes/integracoes?feedback=erro&motivo=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}
