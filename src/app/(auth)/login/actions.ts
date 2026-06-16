"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginActionState = {
  error: string | null;
};

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    return { error: "Preencha e-mail e senha para entrar." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Não foi possível entrar com essas credenciais." };
  }

  if (!user) {
    return { error: "Não foi possível iniciar a sessão do usuário." };
  }

  const adminSupabase = createSupabaseAdminClient();

  const { data: profile } = await adminSupabase
    .from("usuarios")
    .select("id, ativo")
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
    })
    .eq("id", user.id);

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/login");
}
