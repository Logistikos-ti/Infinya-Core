import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
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
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Boxes}
          label="Saldo atual"
          value={detail.saldo}
          help={`Disponível ${detail.disponivel} · Reservado ${detail.reservado}`}
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
          help={`Lote ${detail.lote} · ${detail.withdrawalMethod}`}
        />
        <StatCard
          icon={FileSearch}
          label="Movimentos"
          value={String(detail.movements.length)}
          help={`Entrada registrada em ${detail.createdAt}`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Resumo do protocolo</h2>
          <div className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Depositante
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{detail.depositante}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">SKU</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{detail.sku}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lote</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{detail.lote}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Data de entrada
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{detail.createdAt}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Política automática de retirada
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{detail.withdrawalLabel}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Origem do saldo</h2>
          {detail.source ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Pedido de recebimento
                </p>
                <p className="mt-2 font-semibold text-slate-950">{detail.source.receivingCode}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  NF-e
                </p>
                <p className="mt-2 font-semibold text-slate-950">{detail.source.noteNumber}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Fornecedor
                </p>
                <p className="mt-2 font-semibold text-slate-950">{detail.source.supplier}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Lançado em
                </p>
                <p className="mt-2 font-semibold text-slate-950">{detail.source.launchedAt}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Não foi encontrada uma origem formal de recebimento para este saldo.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Linha do tempo de movimentações</h2>
        <p className="mt-1 text-sm text-slate-600">
          Toda movimentação vinculada a este saldo, com rota, referência, lote, validade e usuário.
        </p>

        <div className="mt-5 space-y-4">
          {detail.movements.length ? (
            detail.movements.map((movement) => (
              <div key={movement.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                    {movement.type}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {movement.reference}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 text-sm text-slate-600 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
                  <div>
                    <p className="font-medium text-slate-900">{movement.route}</p>
                    <p className="mt-1">{movement.notes}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Quantidade
                    </p>
                    <p className="mt-1 font-semibold text-slate-950">{movement.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Operador
                    </p>
                    <p className="mt-1 font-semibold text-slate-950">{movement.user}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                  <p>Lote: {movement.lot}</p>
                  <p>Validade: {movement.expiry}</p>
                  <p>Data/hora: {movement.createdAt}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              Nenhuma movimentação vinculada a este protocolo até o momento.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
