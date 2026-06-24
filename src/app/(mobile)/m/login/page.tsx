import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUserContext } from "@/lib/auth";
import { getDefaultMobileRoute } from "@/lib/mobile";

export default async function MobileLoginPage() {
  const user = await getCurrentUserContext();

  if (user && user.ativo) {
    redirect(getDefaultMobileRoute(user));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-6 text-white">
      <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-white">
          <Smartphone className="h-7 w-7" />
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
            Webapp operacional
          </p>
          <h1 className="text-2xl font-semibold">Entrar no mobile</h1>
          <p className="text-sm leading-6 text-slate-300">
            Acesso rápido para recebimento, separação e conferência direto no celular.
          </p>
        </div>

        <div className="[&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-white [&_input]:text-slate-950 [&_p]:text-slate-200">
          <LoginForm redirectTo="/m/inicio" submitLabel="Entrar no mobile" />
        </div>
      </div>
    </main>
  );
}
