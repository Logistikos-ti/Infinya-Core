"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isEmailLike, normalizeUserLogin } from "@/lib/user-login";

export type LoginActionState = {
  error: string | null;
};

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard").trim() || "/dashboard";

  if (!identifier || !password) {
    return { error: "Preencha usuário e senha para entrar." };
  }

  const normalizedLogin = normalizeUserLogin(identifier);
  const adminSupabase = createSupabaseAdminClient();
  let authEmail = identifier;

  if (!isEmailLike(identifier)) {
    const { data: profileByLogin } = await adminSupabase
      .from("usuarios")
      .select("email")
      .eq("login", normalizedLogin)
      .maybeSingle();

    if (!profileByLogin?.email) {
      return { error: "Não foi possível encontrar um usuário com esse login." };
    }

    authEmail = profileByLogin.email;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ email: authEmail, password });

  if (error) {
    return { error: "Não foi possível entrar com essas credenciais." };
  }

  if (!user) {
    return { error: "Não foi possível iniciar a sessão do usuário." };
  }
  const { data: profile } = await adminSupabase
    .from("usuarios")
    .select("id, ativo, login")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return {
      error: "Seu usuário existe no Auth, mas ainda não foi vinculado ao perfil operacional do WMS.",
    };
  }

  if (!profile.ativo) {
    await supabase.auth.signOut();
    return {
      error: "Este usuário está inativo no WMS. Solicite liberação ao administrador.",
    };
  }

  await adminSupabase
    .from("usuarios")
    .update({
      ultimo_acesso_em: new Date().toISOString(),
      login: profile.login ?? `user.${randomUUID().slice(0, 8)}`,
    })
    .eq("id", user.id);

  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/login");
}
