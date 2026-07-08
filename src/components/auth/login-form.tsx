"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

const initialState: LoginActionState = {
  error: null,
};

type LoginFormProps = {
  redirectTo?: string;
  submitLabel?: string;
};

export function LoginForm({
  redirectTo = "/dashboard",
  submitLabel = "Entrar no Infinoos WMS",
}: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <div className="space-y-2">
        <label htmlFor="identifier" className="text-sm font-medium text-slate-700">
          Usuário ou e-mail
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          placeholder="Digite seu usuário"
          className="w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white dark:text-slate-950"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Digite sua senha"
          className="w-full rounded-xl border border-slate-300/90 bg-white/95 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white dark:text-slate-950"
        />
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full bg-infinya-gradient text-slate-950 hover:opacity-95 disabled:opacity-70"
      >
        {isPending ? "Entrando..." : submitLabel}
      </Button>
    </form>
  );
}
