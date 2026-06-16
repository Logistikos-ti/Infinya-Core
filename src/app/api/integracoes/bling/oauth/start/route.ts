import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { assertBlingCredentials, buildBlingAuthorizationUrl, createBlingOAuthState } from "@/lib/bling";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const oauthStateCookieName = "bling_oauth_state";

export async function GET(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  try {
    assertBlingCredentials();
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/configuracoes/integracoes?feedback=erro&motivo=${encodeURIComponent(
          error instanceof Error ? error.message : "Credenciais ausentes",
        )}`,
        request.url,
      ),
    );
  }

  const url = new URL(request.url);
  const depositanteId = url.searchParams.get("depositanteId")?.trim() ?? "";

  if (!depositanteId) {
    return NextResponse.redirect(new URL("/configuracoes/integracoes?feedback=erro", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data: depositante } = await supabase
    .from("depositantes")
    .select("id")
    .eq("id", depositanteId)
    .maybeSingle();

  if (!depositante) {
    return NextResponse.redirect(new URL("/configuracoes/integracoes?feedback=erro", request.url));
  }

  const state = createBlingOAuthState();
  const response = NextResponse.redirect(buildBlingAuthorizationUrl(state));
  response.cookies.set(
    oauthStateCookieName,
    JSON.stringify({
      state,
      depositanteId,
      createdAt: Date.now(),
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/",
      maxAge: 60 * 15,
    },
  );

  return response;
}
