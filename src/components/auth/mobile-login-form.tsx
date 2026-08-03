"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "@/app/(auth)/login/actions";
import { mobileColors, hexAlpha, bodyFont, MobilePrimaryButton, MobileButtonSpinner } from "@/components/mobile/mobile-kit";

const initialState: LoginActionState = {
  error: null,
};

type MobileLoginFormProps = {
  redirectTo?: string;
  submitLabel?: string;
};

export function MobileLoginForm({ redirectTo = "/dashboard", submitLabel = "Entrar" }: MobileLoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  const inputStyle: React.CSSProperties = {
    height: 50,
    padding: "0 16px",
    borderRadius: 12,
    border: `1.5px solid ${hexAlpha("#94A3B8", 0.18)}`,
    background: hexAlpha("#94A3B8", 0.06),
    color: mobileColors.text,
    fontSize: 15,
    outline: "none",
    ...bodyFont,
  };

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold" style={{ color: mobileColors.muted }}>
            Usuário ou e-mail corporativo
          </span>
          <input
            type="text"
            name="identifier"
            autoComplete="username"
            placeholder="voce@suaempresa.com.br"
            style={inputStyle}
            className="focus:border-[#8B5CF6]"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold" style={{ color: mobileColors.muted }}>
            Senha
          </span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            style={inputStyle}
            className="focus:border-[#8B5CF6]"
          />
        </label>

        {state.error && (
          <p
            className="rounded-xl px-4 py-3 text-[13.5px] font-medium"
            style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.3)}`, background: hexAlpha(mobileColors.red, 0.1), color: mobileColors.redLight }}
          >
            {state.error}
          </p>
        )}

        <MobilePrimaryButton type="submit" disabled={isPending} style={{ height: 52, marginTop: 4 }}>
          {isPending ? <MobileButtonSpinner /> : submitLabel}
        </MobilePrimaryButton>
      </form>
    </div>
  );
}
