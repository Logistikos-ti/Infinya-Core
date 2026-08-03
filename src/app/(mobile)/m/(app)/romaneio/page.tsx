import Link from "next/link";
import { FileDown, Layers3, Truck, ArrowRight } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import {
  listRomaneioRecordsFromDb,
  listRomaneioSuggestionsFromDb,
} from "@/lib/romaneio-records";
import { mobileColors, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";
import { GerarRomaneioForm } from "./gerar-romaneio-btn";

export default async function MobileRomaneioPage() {
  const user = await requireModuleAccess("romaneio");
  const [records, suggestions] = await Promise.all([
    listRomaneioRecordsFromDb(user),
    listRomaneioSuggestionsFromDb(user),
  ]);

  const totalOrders = records.reduce((sum, item) => sum + item.orderCount, 0);
  const cardStyle = { border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) };

  return (
    <div className="space-y-4 p-[18px]">
      <section
        className="overflow-hidden rounded-[24px] p-5"
        style={{ border: `1px solid ${hexAlpha(mobileColors.violet, 0.25)}`, background: `linear-gradient(140deg, ${hexAlpha(mobileColors.blue, 0.12)}, ${hexAlpha(mobileColors.violet, 0.12)})` }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mobileColors.violetLight }}>
          Romaneio operacional
        </p>
        <h1 className="mt-2 text-2xl font-semibold" style={{ color: mobileColors.text, ...headingFont }}>Cargas consolidadas</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: mobileColors.muted }}>
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
            <article key={record.id} className="overflow-hidden rounded-[24px] p-4" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ border: `1px solid ${hexAlpha(mobileColors.violet, 0.2)}`, background: hexAlpha(mobileColors.violet, 0.1), color: mobileColors.violetLight }}
                    >
                      {record.code}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05), color: mobileColors.muted }}
                    >
                      {record.statusLabel}
                    </span>
                  </div>

                  <h2 className="mt-3 flex items-center gap-2 text-lg font-semibold" style={{ color: mobileColors.text, ...headingFont }}>
                    <Truck className="h-4 w-4" style={{ color: mobileColors.violetLight }} />
                    <span className="truncate">{record.carrierName}</span>
                  </h2>

                  <p className="mt-1 text-sm" style={{ color: mobileColors.muted }}>
                    {record.orderCount} pedidos • {record.totalUnits} un • {record.totalValue}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: mobileColors.dim }}>
                    Motorista: {record.driverName || "Não informado"}
                  </p>
                </div>

                <Link
                  href={`/api/romaneio/${record.id}/pdf`}
                  target="_blank"
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition"
                  style={{ border: `1px solid ${hexAlpha(mobileColors.violet, 0.2)}`, background: hexAlpha(mobileColors.violet, 0.1), color: mobileColors.violetLight }}
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </Link>
              </div>

              <div className="mt-4 space-y-2">
                {record.orders.slice(0, 3).map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl px-3 py-3"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.12)}`, background: hexAlpha("#000000", 0.15) }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: mobileColors.text }}>
                          {order.externalNumber}
                        </p>
                        <p className="mt-1 truncate text-xs" style={{ color: mobileColors.muted }}>{order.customer}</p>
                        <p className="mt-1 truncate text-[11px]" style={{ color: mobileColors.dim }}>
                          {order.depositante} • {order.destination}
                        </p>
                      </div>
                      <div className="text-right text-[11px]" style={{ color: mobileColors.muted }}>
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
                  className="inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold transition"
                  style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05), color: mobileColors.text }}
                >
                  Abrir detalhe no WMS
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div
            className="rounded-[24px] px-4 py-8 text-center text-sm"
            style={{ border: `1px dashed ${hexAlpha("#94A3B8", 0.2)}`, color: mobileColors.muted }}
          >
            Nenhum romaneio criado no momento.
          </div>
        )}
      </section>

      <section className="space-y-3 mt-6">
        <div className="flex items-center gap-2 px-2 pb-1" style={{ color: mobileColors.text }}>
          <Layers3 className="h-4 w-4" style={{ color: mobileColors.violetLight }} />
          <h2 className="text-sm font-semibold" style={headingFont}>Fila sugerida para criação</h2>
        </div>
        
        {suggestions.length ? (
          suggestions.map((suggestion, i) => (
            <article key={i} className="overflow-hidden rounded-[24px] p-4" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ border: `1px solid ${hexAlpha(mobileColors.cyan, 0.2)}`, background: hexAlpha(mobileColors.cyan, 0.1), color: mobileColors.cyan }}
                    >
                      SUGESTÃO
                    </span>
                  </div>

                  <h2 className="mt-3 flex items-center gap-2 text-lg font-semibold" style={{ color: mobileColors.text, ...headingFont }}>
                    <Truck className="h-4 w-4" style={{ color: mobileColors.cyan }} />
                    <span className="truncate">{suggestion.carrierName}</span>
                  </h2>

                  <p className="mt-1 text-sm" style={{ color: mobileColors.muted }}>
                    {suggestion.orders.length} pedidos • {suggestion.totalUnits} un • {suggestion.totalValue}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: mobileColors.dim }}>
                    Destinos: {suggestion.destinations.join(" · ")}
                  </p>
                </div>
              </div>

              <GerarRomaneioForm
                orderIds={suggestion.orders.map((o) => o.id)}
                transportadoraId={suggestion.transportadoraId}
                carrierName={suggestion.carrierName}
              />
            </article>
          ))
        ) : (
          <div
            className="rounded-[24px] px-4 py-8 text-center text-sm"
            style={{ border: `1px dashed ${hexAlpha("#94A3B8", 0.2)}`, color: mobileColors.muted }}
          >
            Sem grupos pendentes para consolidação.
          </div>
        )}
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
    <div className="rounded-2xl px-3 py-3" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05) }}>
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: mobileColors.muted }}>{label}</p>
      <p className="mt-2 text-xl font-semibold" style={{ color: mobileColors.text, ...headingFont }}>{value}</p>
    </div>
  );
}
