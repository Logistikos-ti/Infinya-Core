import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  Download,
  FileSearch,
  Lock,
  Route,
} from "lucide-react";
import { StockBalanceAdminActions } from "@/components/estoque/stock-balance-admin-actions";
import { StockBalanceBlockActions } from "@/components/estoque/stock-balance-block-actions";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireModuleAccess } from "@/lib/auth";
import { isAdminUser } from "@/lib/permissions";
import { getStockTraceabilityDetailFromDb } from "@/lib/stock";

type ProtocoloEstoquePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProtocoloEstoquePage({
  params,
}: ProtocoloEstoquePageProps) {
  const user = await requireModuleAccess("estoque");

  const { id } = await params;
  const detail = await getStockTraceabilityDetailFromDb(id);

  if (!detail) {
    notFound();
  }

  const lastTrackedMovement = [...detail.movements]
    .reverse()
    .find((movement) => movement.user && movement.user !== "Sistema");
  const operationalReference = lastTrackedMovement
    ? `${lastTrackedMovement.user} • ${lastTrackedMovement.createdAt}`
    : `Registro sistêmico • ${detail.createdAt}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/estoque"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para estoque
        </Link>
      </div>

      <ModulePageHeader
        title={detail.protocol}
        description={`Rastreabilidade completa do SKU ${detail.sku} em ${detail.endereco}.`}
        badge={detail.status}
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/api/estoque/protocolos/${detail.id}/pdf`}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Download className="h-4 w-4" />
          Emitir protocolo em PDF
        </Link>

        {user.papel !== "DEPOSITANTE" ? (
          <StockBalanceBlockActions
            stockId={detail.id}
            stockLabel={detail.protocol}
            status={detail.status}
            currentReason={detail.blockReason}
            blockedAt={detail.blockedAt}
          />
        ) : null}

        {isAdminUser(user) ? (
          <StockBalanceAdminActions
            stockId={detail.id}
            stockLabel={detail.protocol}
            currentBalance={detail.saldo}
            reservedBalance={detail.reservado}
          />
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Boxes}
          label="Saldo atual"
          value={detail.saldo}
          help={`Disponível ${detail.disponivel} • Reservado ${detail.reservado}`}
        />
        <StatCard
          icon={CalendarClock}
          label="Validade"
          value={detail.validade}
          help={`Fabricação ${detail.fabricacao}`}
        />
        <StatCard
          icon={Route}
          label="Endereço"
          value={detail.endereco}
          help={`Lote ${detail.lote} • ${detail.withdrawalMethod}`}
        />
        <StatCard
          icon={detail.status === "Bloqueado" ? Lock : FileSearch}
          label={detail.status === "Bloqueado" ? "Status operacional" : "Movimentos"}
          value={detail.status === "Bloqueado" ? "Bloqueado" : String(detail.movements.length)}
          help={
            detail.status === "Bloqueado"
              ? detail.blockedAt
                ? `Retido desde ${detail.blockedAt}`
                : "Saldo temporariamente fora de circulação."
              : `Entrada registrada em ${detail.createdAt}`
          }
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Resumo do protocolo
          </h2>
          <div className="mt-4 grid gap-4 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            <PanelInfo label="Depositante" value={detail.depositante} />
            <PanelInfo label="SKU" value={detail.sku} />
            <PanelInfo label="Lote" value={detail.lote} />
            <PanelInfo label="Data de entrada" value={detail.createdAt} />
            <PanelInfo
              label="Política automática de retirada"
              value={detail.withdrawalLabel}
              spanTwo
            />
            {detail.status === "Bloqueado" ? (
              <PanelInfo
                label="Motivo do bloqueio"
                value={detail.blockReason || "Bloqueio operacional sem observação adicional."}
                spanTwo
              />
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Origem do saldo
          </h2>
          {detail.source ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <PanelInfo label={detail.source.referenceLabel} value={detail.source.referenceValue} />
              <PanelInfo label="NF-e" value={detail.source.noteNumber} />
              <PanelInfo
                label={detail.source.counterpartLabel}
                value={detail.source.counterpartValue}
              />
              <PanelInfo label="Lançado em" value={detail.source.launchedAt} />
              <PanelInfo label="Registrado por" value={detail.source.launchedBy} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-slate-300">
              Não foi encontrada uma origem formal para este saldo.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          Responsável operacional
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Este bloco mostra quem respondeu pela última ação rastreável do protocolo. No PDF, o
          espaço de assinatura continua disponível apenas para conferência física, aceite ou
          arquivo operacional.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <PanelInfo label="Último responsável rastreado" value={operationalReference} />
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 dark:border-zinc-700">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Assinatura no PDF
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Usada somente quando o protocolo for impresso para conferência, aceite ou arquivo
              físico.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          Linha do tempo de movimentações
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Toda movimentação vinculada a este saldo, com rota, referência, lote, validade e
          usuário.
        </p>

        <div className="mt-5 space-y-4">
          {detail.movements.length ? (
            detail.movements.map((movement) => (
              <div
                key={movement.id}
                className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                    {movement.type}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {movement.reference}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{movement.route}</p>
                    <p className="mt-1">{movement.notes}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Quantidade
                    </p>
                    <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                      {movement.quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Operador
                    </p>
                    <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                      {movement.user}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                  <p>Lote: {movement.lot}</p>
                  <p>Validade: {movement.expiry}</p>
                  <p>Data/hora: {movement.createdAt}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-slate-400">
              Nenhuma movimentação vinculada a este protocolo até o momento.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PanelInfo({
  label,
  value,
  spanTwo = false,
}: {
  label: string;
  value: string;
  spanTwo?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-slate-50 p-4 dark:bg-zinc-950/40 ${spanTwo ? "sm:col-span-2" : ""}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
