import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  Download,
  FileSearch,
  Route,
} from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireModuleAccess } from "@/lib/auth";
import { getStockTraceabilityDetailFromDb } from "@/lib/stock";

type ProtocoloEstoquePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProtocoloEstoquePage({
  params,
}: ProtocoloEstoquePageProps) {
  await requireModuleAccess("estoque");

  const { id } = await params;
  const detail = await getStockTraceabilityDetailFromDb(id);

  if (!detail) {
    notFound();
  }

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
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Download className="h-4 w-4" />
          Emitir protocolo em PDF
        </Link>
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
          icon={FileSearch}
          label="Movimentos"
          value={String(detail.movements.length)}
          help={`Entrada registrada em ${detail.createdAt}`}
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
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Origem do saldo
          </h2>
          {detail.source ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <PanelInfo label="Pedido de recebimento" value={detail.source.receivingCode} />
              <PanelInfo label="NF-e" value={detail.source.noteNumber} />
              <PanelInfo label="Fornecedor" value={detail.source.supplier} />
              <PanelInfo label="Lançado em" value={detail.source.launchedAt} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-zinc-950/40 dark:text-slate-300">
              Não foi encontrada uma origem formal de recebimento para este saldo.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          Assinatura operacional
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          O PDF do protocolo já sai com campo para assinatura do operador e registro manual de
          data e hora da conferência.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 dark:border-zinc-700">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Assinatura do operador
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 dark:border-zinc-700">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Data e hora da assinatura
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
