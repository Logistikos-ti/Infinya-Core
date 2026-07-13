import Link from "next/link";
import { FileDown, Layers3, Truck } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import {
  listRomaneioRecordsFromDb,
  listRomaneioSuggestionsFromDb,
} from "@/lib/romaneio-records";

export default async function MobileRomaneioPage() {
  const user = await requireModuleAccess("romaneio");
  const [records, suggestions] = await Promise.all([
    listRomaneioRecordsFromDb(user),
    listRomaneioSuggestionsFromDb(user),
  ]);

  const totalOrders = records.reduce((sum, item) => sum + item.orderCount, 0);

  return (
    <div className="space-y-4">
      <section className="mobile-hero-card overflow-hidden rounded-[28px] border border-white/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-100/90">
          Romaneio operacional
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Cargas consolidadas</h1>
        <p className="mt-2 text-sm leading-6 text-slate-100/90">
          Consulte romaneios já criados, revise a carga e emita o PDF direto no app.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Romaneios" value={String(records.length)} />
          <MiniStat label="Pedidos" value={String(totalOrders)} />
        </div>
        <div className="mt-2">
          <MiniStat label="Grupos sugeridos" value={String(suggestions.length)} />
        </div>
      </section>

      <section className="space-y-3">
        {records.length ? (
          records.map((record) => (
            <article
              key={record.id}
              className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100">
                      {record.code}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                      {record.statusLabel}
                    </span>
                  </div>

                  <h2 className="mt-3 flex items-center gap-2 text-lg font-semibold text-white">
                    <Truck className="h-4 w-4 text-violet-300" />
                    <span className="truncate">{record.carrierName}</span>
                  </h2>

                  <p className="mt-1 text-sm text-slate-300">
                    {record.orderCount} pedidos • {record.totalUnits} un • {record.totalValue}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Motorista: {record.driverName || "Não informado"}
                  </p>
                </div>

                <Link
                  href={`/api/romaneio/${record.id}/pdf`}
                  target="_blank"
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/15"
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </Link>
              </div>

              <div className="mt-4 space-y-2">
                {record.orders.slice(0, 3).map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {order.externalNumber}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-300">{order.customer}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-400">
                          {order.depositante} • {order.destination}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-slate-300">
                        <p>{order.units} un</p>
                        <p className="mt-1">{order.total}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/romaneio/${record.id}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  Abrir detalhe no WMS
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-slate-300">
            Nenhum romaneio criado no momento.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
          <div className="flex items-center gap-2 text-white">
            <Layers3 className="h-4 w-4 text-violet-300" />
            <h2 className="text-sm font-semibold">Fila sugerida</h2>
          </div>
          <p className="mt-2 text-xs text-slate-300">
            {suggestions.length
              ? `${suggestions.length} grupo(s) aguardando consolidação no desktop.`
              : "Sem grupos pendentes para consolidação."}
          </p>
        </div>
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
