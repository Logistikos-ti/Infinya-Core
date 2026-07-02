"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateFirstAccessPasswordAction,
  type FirstAccessPasswordState,
} from "@/components/layout/first-access-password-actions";
import { Button } from "@/components/ui/button";

const initialState: FirstAccessPasswordState = {
  error: null,
  success: false,
};

type FirstAccessPasswordDialogProps = {
  isVisible: boolean;
  userName: string;
};

export function FirstAccessPasswordDialog({
  isVisible,
  userName,
}: FirstAccessPasswordDialogProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updateFirstAccessPasswordAction,
    initialState,
  );

  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.refresh();
  }, [router, state.success]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[30px] border border-cyan-200 bg-white p-6 shadow-2xl dark:border-cyan-500/30 dark:bg-slate-950 md:p-8">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300">
            Primeiro acesso
          </p>
          <h2 className="text-3xl font-semibold text-slate-950 dark:text-white">
            Redefina sua senha
          </h2>
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">
            Olá, {userName}. Para continuar no WMS, defina uma nova senha pessoal. Esse passo é
            obrigatório no primeiro login.
          </p>
        </div>

        <form action={formAction} className="mt-6 space-y-4">
          <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="font-medium">Nova senha</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Digite a nova senha"
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-500/20"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="font-medium">Confirmar nova senha</span>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-500/20"
            />
          </label>

          {state.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {state.error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            Depois de salvar, o sistema libera automaticamente o restante da navegação.
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="h-12 w-full bg-infinya-gradient text-slate-950 hover:opacity-95 disabled:opacity-70"
          >
            {isPending ? "Salvando nova senha..." : "Salvar nova senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
