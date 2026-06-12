import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppUserContext = {
  id: string;
  email: string;
  nome: string;
  papel: "ADMIN" | "TI" | "OPERADOR" | "DEPOSITANTE";
  depositanteId: string | null;
};

export const getCurrentUserContext = cache(async (): Promise<AppUserContext | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("usuarios")
    .select("id, email, nome, papel, depositante_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    nome: profile.nome,
    papel: profile.papel,
    depositanteId: profile.depositante_id,
  };
});

export async function requireUserContext() {
  const user = await getCurrentUserContext();

  if (!user) {
    redirect("/login");
  }

  return user;
}
