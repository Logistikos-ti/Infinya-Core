import { NextResponse } from "next/server";
import type { AppUserContext } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";

export function isScopedDepositanteUser(user: AppUserContext) {
  return !isAdminUser(user) && Boolean(user.depositanteId);
}

export function ensureUserCanAccessDepositante(user: AppUserContext, depositanteId: string) {
  if (!isScopedDepositanteUser(user)) {
    return null;
  }

  if (user.depositanteId !== depositanteId) {
    return NextResponse.json(
      { error: "Este usuário está vinculado a outro depositante e não pode acessar este registro." },
      { status: 403 },
    );
  }

  return null;
}

export function filterItemsByUserDepositante<T>(
  user: AppUserContext,
  items: readonly T[],
  getDepositanteName: (item: T) => string | null | undefined,
) {
  if (!isScopedDepositanteUser(user)) {
    return [...items];
  }

  const nomeAlvo = normalizeDepositanteName(user.depositanteNome);

  if (!nomeAlvo) {
    return [];
  }

  return items.filter((item) => normalizeDepositanteName(getDepositanteName(item)) === nomeAlvo);
}

export function filterDepositanteOptionsByUser<T extends { id: string; nome: string }>(
  user: AppUserContext,
  items: readonly T[],
) {
  if (!isScopedDepositanteUser(user)) {
    return [...items];
  }

  return items.filter((item) => item.id === user.depositanteId);
}

function normalizeDepositanteName(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}
