import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import type {
  DepositanteBlingConfig,
  DepositanteMercadoLivreConfig,
} from "@/lib/depositantes";
import { BlingImportConfiguration } from "@/components/portal/bling-import-configuration";

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
          benefit="Pedidos entram automaticamente no WMS, reduzindo digitação, retrabalho e o tempo entre a venda e a separação."
          description="Importa pedidos e acompanha a operação comercial conectada ao seu ERP."
          connected={Boolean(bling?.connected)}
          account={bling?.companyName}
          provider="bling"
          href={`/api/integracoes/bling/oauth/start?depositanteId=${encodeURIComponent(depositanteId)}&portal=1`}
        />
        <IntegrationCard
          title="Mercado Livre"
          benefit="Centraliza pedidos e documentos de envio para a operação preparar e despachar com menos conferências manuais."
          description="Conecta pedidos, etiquetas e rastreamento da sua conta de vendedor."
          connected={Boolean(mercadoLivre?.connected)}
          account={mercadoLivre?.nickname}
          provider="mercado-livre"
          href={`/api/integracoes/mercado-livre/oauth/start?depositanteId=${encodeURIComponent(depositanteId)}&portal=1`}
        />
      </div>

      {bling?.connected ? <BlingImportConfiguration depositanteId={depositanteId} /> : null}

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
  provider,
  benefit,
}: {
  title: string;
  description: string;
  connected: boolean;
  account: string | null | undefined;
  href: string;
  provider: "bling" | "mercado-livre";
  benefit: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
      <div className="flex items-start justify-between gap-3">
        <IntegrationLogo provider={provider} />
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"}`}>
          {connected ? "Conectado" : "Não conectado"}
        </span>
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">{title}</h2>
      <p className="mt-2 min-h-11 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600 dark:bg-white/5 dark:text-slate-300">
        <span className="font-bold text-slate-800 dark:text-white">Ganho operacional: </span>
        {benefit}
      </p>
      <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4 dark:border-white/10">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Mensalidade</p>
          <p className="mt-0.5 text-xl font-extrabold text-slate-950 dark:text-white">R$ 49,90<span className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">/mês</span></p>
        </div>
        <p className="max-w-40 text-right text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          A cobrança inicia na próxima fatura após a conexão.
        </p>
      </div>
      {connected ? (
        <p className="mt-4 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          Conta: {account || "Conectada"}
        </p>
      ) : null}
      <a
        href={href}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 text-sm font-bold !text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 hover:!text-white hover:shadow-violet-500/35"
      >
        <RefreshCw className="h-4 w-4" />
        {connected ? `Reconectar ${title}` : `Conectar ${title}`}
      </a>
    </article>
  );
}

function IntegrationLogo({ provider }: { provider: "bling" | "mercado-livre" }) {
  return (
    <div className="flex h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-sm">
      <img
        src={provider === "bling" ? "/integrations/bling.png" : "/integrations/mercado-livre.png"}
        alt={provider === "bling" ? "Bling" : "Mercado Livre"}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
