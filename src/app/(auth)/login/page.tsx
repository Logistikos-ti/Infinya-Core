import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUserContext } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUserContext();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
            Autenticação
          </span>
          <h1 className="text-2xl font-semibold text-slate-950">Login do WMS</h1>
          <p className="text-sm leading-6 text-slate-600">
            Entre com seu usuário para operar recebimento, estoque e expedição
            com segregação por depositante desde a base do sistema.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
