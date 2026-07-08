import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { InfinyaBrand } from "@/components/branding/infinya-brand";
import { getCurrentUserContext } from "@/lib/auth";
import { getPreferredWebRoute } from "@/lib/permissions";

export default async function LoginPage() {
  const user = await getCurrentUserContext();

  if (user) {
    redirect(getPreferredWebRoute(user));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_bottom,rgba(192,132,252,0.14),transparent_28%),linear-gradient(180deg,#eef4ff_0%,#f7fbff_55%,#ffffff_100%)] px-4 dark:bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_26%),radial-gradient(circle_at_bottom,rgba(192,132,252,0.16),transparent_22%),linear-gradient(180deg,#040816_0%,#050b19_60%,#071120_100%)]">
      <div className="infinya-border-glow w-full max-w-md rounded-[28px] border border-white/30 bg-white/78 p-8 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#071120]/82">
        <div className="space-y-3">
          <InfinyaBrand subtitle="Plataforma operacional para recebimento, estoque e expedição" />
          <span className="inline-flex rounded-full bg-sky-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:bg-cyan-400/10 dark:text-cyan-300">
            Autenticação
          </span>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Entrar no WMS</h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Entre com seu usuário para operar recebimento, estoque e expedição com segregação por
            depositante desde a base do sistema.
          </p>
        </div>
        <LoginForm submitLabel="Entrar no Infinoos WMS" />
      </div>
    </main>
  );
}
