"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FirstAccessPasswordState = {
  error: string | null;
  success: boolean;
};

export async function updateFirstAccessPasswordAction(
  _prevState: FirstAccessPasswordState,
  formData: FormData,
): Promise<FirstAccessPasswordState> {
  const password = String(formData.get("password") ?? "").trim();
  const confirmPassword = String(formData.get("confirmPassword") ?? "").trim();

  if (!password || !confirmPassword) {
    return { error: "Preencha a nova senha e a confirmação.", success: false };
  }

  if (password.length < 8) {
    return { error: "A nova senha deve ter no mínimo 8 caracteres.", success: false };
  }

  if (password !== confirmPassword) {
    return { error: "A confirmação de senha não confere.", success: false };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Faça login novamente.", success: false };
  }

  const nextUserMetadata = {
    ...(user.user_metadata ?? {}),
    force_password_reset: false,
  };

  const { error: updateUserError } = await supabase.auth.updateUser({
    password,
    data: nextUserMetadata,
  });

  if (updateUserError) {
    return {
      error: "Não foi possível atualizar sua senha neste momento.",
      success: false,
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const nextAppMetadata = {
    ...(user.app_metadata ?? {}),
    force_password_reset: false,
  };

  const { error: updateMetadataError } = await adminSupabase.auth.admin.updateUserById(user.id, {
    app_metadata: nextAppMetadata,
  });

  if (updateMetadataError) {
    return {
      error: "A senha foi atualizada, mas não foi possível concluir o primeiro acesso.",
      success: false,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/configuracoes/usuarios");

  return { error: null, success: true };
}
