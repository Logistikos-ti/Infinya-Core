import { cache } from "react";
import { redirect } from "next/navigation";
import {
  APP_MODULES,
  canAccessModule,
  getModuleLabel,
  hasRoleAccess,
  redirectToAccessDenied,
  type AppModule,
  type AppRole,
} from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppUserContext = {
  id: string;
  email: string;
  nome: string;
  papel: "ADMIN" | "TI" | "OPERADOR" | "DEPOSITANTE";
  depositanteId: string | null;
  depositanteNome: string | null;
  ativo: boolean;
  modulePermissions: AppModule[] | null;
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
    .select("id, email, nome, papel, depositante_id, ativo, depositante:depositantes(nome)")
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
    depositanteNome: extractDepositanteNome(profile.depositante),
    ativo: profile.ativo,
    modulePermissions: parseModulePermissions(user.user_metadata?.module_permissions),
  };
});

export async function requireUserContext() {
  const user = await getCurrentUserContext();

  if (!user) {
    redirect("/login");
  }

  if (!user.ativo) {
    redirect("/login?motivo=inativo");
  }

  return user;
}

export async function requireModuleAccess(module: AppModule) {
  const user = await requireUserContext();

  if (!canAccessModule(user, module)) {
    redirectToAccessDenied(module);
  }

  return user;
}

export async function requireRoleAccess(roles: readonly AppRole[]) {
  const user = await requireUserContext();

  if (!hasRoleAccess(user, roles)) {
    redirect(`/acesso-negado?motivo=papel&papel=${encodeURIComponent(user.papel)}`);
  }

  return user;
}

export function getAccessDeniedErrorMessage(module: AppModule) {
  return `Seu perfil não tem acesso ao módulo de ${getModuleLabel(module)}.`;
}

function parseModulePermissions(value: unknown): AppModule[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const validModules = value.filter(
    (item): item is AppModule => typeof item === "string" && APP_MODULES.includes(item as AppModule),
  );

  return validModules.length ? validModules : null;
}

function extractDepositanteNome(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first?.nome === "string" ? first.nome : null;
  }

  if (value && typeof value === "object" && "nome" in value) {
    const nome = (value as { nome?: unknown }).nome;
    return typeof nome === "string" ? nome : null;
  }

  return null;
}
