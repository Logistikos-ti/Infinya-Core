import { CheckCircle2, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import type {
  DepositanteBlingConfig,
  DepositanteMercadoLivreConfig,
} from "@/lib/depositantes";

type Props = {
  depositanteId: string;
  bling: DepositanteBlingConfig | null;
  mercadoLivre: DepositanteMercadoLivreConfig | null;
  feedback?: string;
};

export function PortalIntegrationsView({
  depositanteId,
  bling,
  mercadoLivre,
  feedback,
}: Props) {
  const successMessage =
    feedback === "bling-conectado"
      ? "Bling conectado com sucesso."
      : feedback === "mercado-livre-conectado"
        ? "Mercado Livre conectado com sucesso."
        : null;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
          Integrações
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
          Canais conectados
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Autorize apenas as contas da sua operação. As credenciais ficam protegidas no WMS.
        </p>
      </div>

      {successMessage ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <IntegrationCard
          title="Bling"
          description="Importa pedidos e acompanha a operação comercial conectada ao seu ERP."
          connected={Boolean(bling?.connected)}
          account={bling?.companyName}
          href={`/api/integracoes/bling/oauth/start?depositanteId=${encodeURIComponent(depositanteId)}&portal=1`}
        />
        <IntegrationCard
          title="Mercado Livre"
          description="Conecta pedidos, etiquetas e rastreamento da sua conta de vendedor."
          connected={Boolean(mercadoLivre?.connected)}
          account={mercadoLivre?.nickname}
          href={`/api/integracoes/mercado-livre/oauth/start?depositanteId=${encodeURIComponent(depositanteId)}&portal=1`}
        />
      </div>

      <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
        A conexão é individual por depositante. Nenhuma outra operação pode visualizar ou usar sua conta integrada.
      </div>
    </section>
  );
}

function IntegrationCard({
  title,
  description,
  connected,
  account,
  href,
}: {
  title: string;
  description: string;
  connected: boolean;
  account: string | null | undefined;
  href: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-white">
          <Link2 className="h-5 w-5" />
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"}`}>
          {connected ? "Conectado" : "Não conectado"}
        </span>
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">{title}</h2>
      <p className="mt-2 min-h-11 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      {connected ? (
        <p className="mt-4 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          Conta: {account || "Conectada"}
        </p>
      ) : null}
      <a
        href={href}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 hover:shadow-violet-500/35"
      >
        <RefreshCw className="h-4 w-4" />
        {connected ? `Reconectar ${title}` : `Conectar ${title}`}
      </a>
    </article>
  );
}
