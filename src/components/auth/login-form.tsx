"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "@/app/(auth)/login/actions";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

const initialState: LoginActionState = {
  error: null,
};

type LoginFormProps = {
  redirectTo?: string;
  submitLabel?: string;
};

export function LoginForm({ redirectTo = "/dashboard", submitLabel = "Entrar na operação" }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-8 my-auto z-10 relative">
      <div className="flex flex-col gap-2.5">
        <h2 className="m-0 font-space text-[30px] font-bold text-slate-900 dark:text-slate-100 transition-colors duration-300">
          Bem-vindo de volta
        </h2>
        <p className="m-0 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400 transition-colors duration-300">
          Acesse sua operação para continuar.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold tracking-[0.02em] text-slate-600 dark:text-slate-400">
            Usuário ou e-mail corporativo
          </span>
          <input
            type="text"
            name="identifier"
            autoComplete="username"
            placeholder="voce@suaempresa.com.br"
            className="h-[50px] px-4 rounded-xl border-[1.5px] border-slate-400/30 dark:border-white/10 bg-white dark:bg-[#111C33] text-slate-900 dark:text-white font-manrope text-[15px] outline-none transition-all duration-200 focus:border-[#8B5CF6] focus:ring-[4px] focus:ring-[#8B5CF6]/15 box-border"
          />
        </label>

        <label className="flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] font-bold tracking-[0.02em] text-slate-600 dark:text-slate-400">
              Senha
            </span>
            <span className="text-[13px] font-semibold text-[#8B5CF6] hover:underline cursor-pointer transition-colors">
              Esqueci minha senha
            </span>
          </div>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-[50px] px-4 rounded-xl border-[1.5px] border-slate-400/30 dark:border-white/10 bg-white dark:bg-[#111C33] text-slate-900 dark:text-white font-manrope text-[15px] outline-none transition-all duration-200 focus:border-[#8B5CF6] focus:ring-[4px] focus:ring-[#8B5CF6]/15 box-border"
          />
        </label>

        {state.error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-700 font-medium mt-1 shadow-sm">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="h-[52px] mt-2 border-none rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white font-manrope text-[16px] font-extrabold tracking-[0.01em] cursor-pointer shadow-[0_10px_28px_rgba(99,102,241,0.35)] transition-all duration-200 hover:shadow-[0_14px_36px_rgba(99,102,241,0.5)] hover:-translate-y-px active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none"
        >
          {isPending ? "Entrando..." : submitLabel}
        </button>
      </form>

      <p className="m-0 text-[14px] text-slate-600 dark:text-slate-400 text-center font-medium mt-2">
        Novo por aqui?{" "}
        <span className="text-[#8B5CF6] cursor-pointer hover:underline transition-colors font-bold">
          Fale com nosso time
        </span>
      </p>
    </div>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title="Alternar tema"
      aria-label="Alternar tema"
      type="button"
      className="absolute top-7 right-7 w-[68px] h-[32px] p-0 rounded-full border bg-slate-100 border-slate-300/30 dark:bg-[#0E1729] dark:border-blue-400/30 cursor-pointer transition-all duration-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] z-20"
    >
      <span className="absolute top-1/2 left-3 -translate-y-1/2 text-[12px] leading-none text-slate-400 transition-colors duration-300">
        <Moon className="w-3.5 h-3.5" />
      </span>
      <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[12px] leading-none text-slate-600 transition-colors duration-300">
        <Sun className="w-3.5 h-3.5" />
      </span>
      <span
        className={`absolute top-[3px] left-[3px] w-[24px] h-[24px] flex items-center justify-center rounded-full bg-white dark:bg-[#0B1220] shadow-[0_1px_4px_rgba(0,0,0,0.35)] transition-all duration-300 ease-[cubic-bezier(.4,1.3,.5,1)] ${
          isDark ? "translate-x-0" : "translate-x-[36px]"
        }`}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-blue-500" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-orange-500" />
        )}
      </span>
    </button>
  );
}
