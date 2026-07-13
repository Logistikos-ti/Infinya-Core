import Link from "next/link";
import { ArrowLeft, FileDown, Truck } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { RomaneioDetailForm } from "@/components/romaneio/romaneio-detail-form";
import { requireModuleAccess } from "@/lib/auth";
import {
  getRomaneioRecordDetailFromDb,
  listTransportadoraOptionsFromDb,
} from "@/lib/romaneio-records";
import {
  cancelRomaneioRecordAction,
  releaseRomaneioRecordAction,
  updateRomaneioRecordAction,
} from "../actions";

type RomaneioDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ feedback?: string }>;
};

export default async function RomaneioDetailPage({
  params,
  searchParams,
}: RomaneioDetailPageProps) {
  const user = await requireModuleAccess("romaneio");
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const feedback = query?.feedback?.trim() ?? "";

  const [record, transportadoras] = await Promise.all([
    getRomaneioRecordDetailFromDb(user, id),
    listTransportadoraOptionsFromDb(),
  ]);
  const transportadoraSelectOptions = [
    { value: "", label: "Manter nome livre" },
    ...transportadoras.map((item) => ({
      value: item.id,
      label: item.nome,
    })),
  ];

  if (!record) {
    return (
      <div className="space-y-6">
        <Link
          href="/romaneio"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para romaneio
        </Link>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-slate-400">
          Este romaneio não foi encontrado ou não está disponível para o seu perfil.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/romaneio"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para romaneio
      </Link>

      <ModulePageHeader
        title={`Romaneio ${record.code}`}
        description="Detalhe operacional da carga, com dados de transporte, pedidos vinculados e liberação final."
        badge={record.statusLabel}
      />

      {feedback ? <FeedbackBanner feedback={feedback} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Transportadora" value={record.carrierName} />
        <SummaryCard label="Pedidos" value={String(record.orderCount)} />
        <SummaryCard label="Unidades" value={record.totalUnits} />
        <SummaryCard label="Valor da carga" value={record.totalValue} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Dados da carga
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Complete motorista, documento, veículo e observações antes da saída.
              </p>
            </div>
            <div className="rounded-full bg-sky-50 p-2 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              <Truck className="h-5 w-5" />
            </div>
          </div>

          <RomaneioDetailForm
            romaneioId={record.id}
            carrierName={record.carrierName}
            transportadoraId={record.transportadoraId ?? ""}
            driverName={record.driverName ?? ""}
            driverDocument={record.driverDocument ?? ""}
            vehicleModel={record.vehicleModel ?? ""}
            vehiclePlate={record.vehiclePlate ?? ""}
            notes={record.notes ?? ""}
            transportadoraOptions={transportadoraSelectOptions}
            pdfHref={`/api/romaneio/${record.id}/pdf`}
            saveAction={updateRomaneioRecordAction}
          />
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Pedidos vinculados
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Esta carga reúne {record.orderCount} pedido(s) já prontos para despacho.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {record.isOpen ? (
                  <>
                    <form action={releaseRomaneioRecordAction}>
                      <input type="hidden" name="romaneioId" value={record.id} />
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-600 bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-500"
                      >
                        Liberar carga
                      </button>
                    </form>
                    <form action={cancelRomaneioRecordAction}>
                      <input type="hidden" name="romaneioId" value={record.id} />
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-600 bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-500"
                      >
                        Cancelar
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-zinc-950/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Depositante</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Destino</th>
                    <th className="px-4 py-3 font-medium">Itens</th>
                    <th className="px-4 py-3 font-medium">Unidades</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {record.orders.map((order) => (
                    <tr key={order.id} className="border-t border-slate-100 dark:border-zinc-800">
                      <td className="px-4 py-3 text-slate-900 dark:text-white">
                        <div className="font-medium">{order.externalNumber}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{order.code}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{order.depositante}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{order.customer}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{order.destination}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{order.itemCount}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{order.units}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{order.total}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {order.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function FeedbackBanner({ feedback }: { feedback: string }) {
  const success = ["salvo", "liberado", "cancelado", "criado"].includes(feedback);
  const className = success
    ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";

  const message =
    feedback === "salvo"
      ? "Dados do romaneio atualizados com sucesso."
      : feedback === "liberado"
        ? "Carga liberada com sucesso."
        : feedback === "cancelado"
          ? "Romaneio cancelado e devolvido para a fila."
          : feedback === "criado"
            ? "Romaneio criado com sucesso."
            : "Não foi possível concluir a operação solicitada.";

  return <div className={`rounded-2xl px-4 py-3 text-sm ${className}`}>{message}</div>;
}
