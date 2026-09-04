import Link from "next/link";
import { ChevronLeft, Truck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { RomaneioDetailForm } from "@/components/romaneio/romaneio-detail-form";
import { requireModuleAccess } from "@/lib/auth";
import { ROMANEIO_MONO, ROMANEIO_THEME_CSS } from "@/lib/romaneio-theme";
import {
  getRomaneioRecordDetailFromDb,
  listTransportadoraOptionsFromDb,
} from "@/lib/romaneio-records";
import {
  cancelRomaneioRecordAction,
  updateRomaneioRecordAction,
} from "../actions";

type RomaneioDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ feedback?: string }>;
};

const STATUS_COLOR: Record<string, string> = {
  ABERTO: "#3B82F6",
  LIBERADO: "#10B981",
  CANCELADO: "#8695AD",
};

function BackButton() {
  return (
    <Link
      href="/romaneio"
      title="Voltar para Romaneio"
      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6]"
      style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-input-bg)" }}
    >
      <ChevronLeft className="h-5 w-5 transition-colors group-hover:text-[#8B5CF6]" style={{ color: "var(--romaneio-text)" }} />
    </Link>
  );
}

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
      <div className="romaneio-theme flex h-full flex-col">
        <style>{ROMANEIO_THEME_CSS}</style>
        <header
          className="flex h-[68px] flex-shrink-0 items-center gap-[18px] border-b px-4 sm:px-[28px]"
          style={{ borderColor: "var(--romaneio-border)" }}
        >
          <BackButton />
          <span className="text-[14.5px] font-bold" style={{ color: "var(--romaneio-text)" }}>
            Romaneio
          </span>
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div
            className="rounded-2xl border border-dashed p-10 text-center text-sm"
            style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-card-bg)", color: "var(--romaneio-text-sub)" }}
          >
            Este romaneio não foi encontrado ou não está disponível para o seu perfil.
          </div>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLOR[record.status] ?? "#8695AD";

  return (
    <div className="romaneio-theme flex h-full flex-col">
      <style>{ROMANEIO_THEME_CSS}</style>

      {/* Cabeçalho (padrão rebranding: voltar · protocolo · status · tema) */}
      <header
        className="flex h-[68px] flex-shrink-0 items-center gap-[18px] border-b px-4 sm:px-[28px]"
        style={{ borderColor: "var(--romaneio-border)" }}
      >
        <BackButton />
        <div className="h-5 w-px border-l" style={{ borderColor: "var(--romaneio-border)" }} />
        <div className="flex flex-col min-w-0">
          <span className="text-[12px] font-semibold" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text-sub)" }}>
            {record.code}
          </span>
          <span className="text-[14.5px] font-bold truncate" style={{ color: "var(--romaneio-text)" }}>
            {record.carrierName}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-[7px] px-3 py-[5px] rounded-full text-[12px] font-bold whitespace-nowrap"
          style={{ backgroundColor: `${statusColor}24`, color: statusColor }}
        >
          <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: statusColor }} />
          {record.statusLabel}
        </span>
        <div className="flex-1" />
        <ThemeToggle />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 space-y-6">
        {feedback ? <FeedbackBanner feedback={feedback} /> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Transportadora" value={record.carrierName} />
          <SummaryCard label="Doca" value={record.dock ?? "—"} />
          <SummaryCard label="Pedidos" value={String(record.orderCount)} />
          <SummaryCard label="Unidades" value={record.totalUnits} />
          <SummaryCard label="Valor da carga" value={record.totalValue} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-2xl border p-6 shadow-sm" style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-card-bg)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--romaneio-text)" }}>
                  Dados da carga
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--romaneio-text-sub)" }}>
                  Complete motorista, documento, veículo e observações antes da saída.
                </p>
              </div>
              <div className="rounded-full p-2" style={{ background: "rgba(59,130,246,0.12)", color: "#3B82F6" }}>
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
              dock={record.dock ?? ""}
              expectedPickup={record.expectedPickup ?? ""}
              notes={record.notes ?? ""}
              transportadoraOptions={transportadoraSelectOptions}
              pdfHref={`/api/romaneio/${record.id}/pdf`}
              saveAction={updateRomaneioRecordAction}
            />
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border p-6 shadow-sm" style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-card-bg)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--romaneio-text)" }}>
                    Pedidos vinculados
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--romaneio-text-sub)" }}>
                    Esta carga reúne {record.orderCount} pedido(s) já prontos para despacho.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {record.isOpen ? (
                    <form action={cancelRomaneioRecordAction}>
                      <input type="hidden" name="romaneioId" value={record.id} />
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-600 bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-500"
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--romaneio-border)" }}>
                <table className="min-w-full text-left text-sm">
                  <thead style={{ background: "var(--romaneio-head-bg)", color: "var(--romaneio-text-sub)" }}>
                    <tr>
                      <th className="px-4 py-3 font-medium">Pedido</th>
                      <th className="px-4 py-3 font-medium">Nota Fiscal</th>
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
                      <tr key={order.id} style={{ borderTop: "1px solid var(--romaneio-border)" }}>
                        <td className="px-4 py-3" style={{ color: "var(--romaneio-text)" }}>
                          <div className="font-medium">{order.externalNumber}</div>
                          <div className="text-xs" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text-sub)" }}>
                            {order.code}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--romaneio-text)" }}>
                          {order.invoiceNumber}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--romaneio-text-sub)" }}>
                          {order.depositante}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--romaneio-text-sub)" }}>
                          {order.customer}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--romaneio-text-sub)" }}>
                          {order.destination}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--romaneio-text-sub)" }}>
                          {order.itemCount}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--romaneio-text-sub)" }}>
                          {order.units}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--romaneio-text-sub)" }}>
                          {order.total}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{ background: "var(--romaneio-input-bg)", color: "var(--romaneio-text-sub)" }}
                          >
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
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-5 shadow-sm" style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-card-bg)" }}>
      <p className="text-sm" style={{ color: "var(--romaneio-text-sub)" }}>
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold" style={{ color: "var(--romaneio-text)" }}>
        {value}
      </p>
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
