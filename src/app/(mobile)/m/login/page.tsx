import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { InfinyaBrand } from "@/components/branding/infinya-brand";
import { MobileInstallCard } from "@/components/pwa/mobile-install-card";
import { getCurrentUserContext } from "@/lib/auth";
import { getDefaultMobileRoute } from "@/lib/mobile";

export default async function MobileLoginPage() {
  const user = await getCurrentUserContext();

  if (user && user.ativo) {
    redirect(getDefaultMobileRoute(user));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_25%),radial-gradient(circle_at_bottom,rgba(192,132,252,0.18),transparent_22%),#040816] px-4 py-6 text-white">
      <div className="infinya-border-glow w-full max-w-sm rounded-[28px] border border-white/10 bg-[#071120]/82 p-6 shadow-2xl backdrop-blur">
        <div className="space-y-2">
          <InfinyaBrand subtitle="Webapp operacional" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
            Webapp operacional
          </p>
          <h1 className="text-2xl font-semibold">Entrar no mobile</h1>
          <p className="text-sm leading-6 text-slate-300">
            Acesso rápido para recebimento, separação e conferência direto no celular.
          </p>
        </div>

        <div className="mt-5">
          <MobileInstallCard />
        </div>

        <div className="[&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-white [&_input]:text-slate-950 [&_p]:text-slate-200">
          <LoginForm redirectTo="/m/inicio" submitLabel="Entrar no mobile" />
        </div>
      </div>
    </main>
  );
}
