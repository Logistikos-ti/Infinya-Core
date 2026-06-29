import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireUserContext } from "@/lib/auth";
import { getModuleLabel, getRoleLabel, isAppModule } from "@/lib/permissions";

type AccessDeniedPageProps = {
  searchParams?: Promise<{
    modulo?: string;
    motivo?: string;
    papel?: string;
  }>;
};

export default async function AccessDeniedPage({
  searchParams,
}: AccessDeniedPageProps) {
  const user = await requireUserContext();
  const params = searchParams ? await searchParams : undefined;
  const moduleParam = params?.modulo;
  const roleParam = params?.papel;
  const moduleLabel =
    moduleParam && isAppModule(moduleParam) ? getModuleLabel(moduleParam) : "este módulo";

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        <ShieldAlert className="h-7 w-7" />
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Acesso restrito
        </p>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">
          Seu perfil não tem permissão para continuar
        </h1>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          O usuário <strong>{user.nome}</strong> está autenticado como{" "}
          <strong>{getRoleLabel(user.papel)}</strong>, mas não possui acesso liberado para{" "}
          {moduleLabel}.
        </p>
        {params?.motivo === "papel" && roleParam ? (
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            O papel recebido na sessão foi <strong>{roleParam}</strong>. Se esse acesso já
            deveria existir, basta ajustarmos o vínculo do usuário no WMS.
          </p>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          Voltar ao dashboard
        </Link>
        <Link
          href="/nfe"
          className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Ir para um módulo liberado
        </Link>
      </div>
    </div>
  );
}
