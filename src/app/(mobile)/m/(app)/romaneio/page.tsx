import Link from "next/link";
import { FileDown, Truck } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { listRomaneioRecordsFromDb } from "@/lib/romaneio-records";
import { mobileColors, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";
import { getCarrierBrand } from "@/components/romaneio/romaneio-dashboard";

type MobileRomaneioPageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function MobileRomaneioPage({ searchParams }: MobileRomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? "";

  const records = await listRomaneioRecordsFromDb(user);

  const totalOrders = records.reduce((sum, item) => sum + item.orderCount, 0);
  const openCount = records.filter((r) => r.status === "ABERTO").length;
  const cardStyle = { border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Standard Mobile Header */}
      <div style={{ flexShrink: 0, padding: "18px 18px 14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href="/m/inicio"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
            background: hexAlpha("#94A3B8", 0.06),
            color: mobileColors.text,
            cursor: "pointer",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          &#8249;
        </Link>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Romaneio</span>
          <span style={{ fontSize: 12, color: mobileColors.muted }}>Cargas consolidadas</span>
        </div>
        <span
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 800,
            background: hexAlpha("#94A3B8", 0.1),
            color: mobileColors.muted,
            flexShrink: 0,
          }}
        >
          {records.length} criado{records.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="app-scroll space-y-4 px-[18px] pb-[24px]" style={{ flex: 1, overflowY: "auto" }}>
        {feedback === "criado" && (
          <div
            className="rounded-[15px] px-4 py-3 text-sm font-semibold"
            style={{
              background: hexAlpha(mobileColors.green, 0.1),
              border: `1px solid ${hexAlpha(mobileColors.green, 0.2)}`,
              color: mobileColors.green,
            }}
          >
            Romaneio gerado com sucesso!
          </div>
        )}

        {/* 3 Stat Cards */}
        <div className="flex gap-2.5">
          <StatCard value={records.length} label="romaneios" color={mobileColors.violetLight} />
          <StatCard value={openCount} label="em aberto" color={mobileColors.amber} />
          <StatCard value={totalOrders} label="pedidos" color={mobileColors.blueLight} />
        </div>

        {/* Romaneios Criados */}
        <section className="space-y-3 mt-2">
          <div className="flex items-center gap-2 px-1 pb-1" style={{ color: mobileColors.text }}>
            <Truck className="h-4 w-4" style={{ color: mobileColors.violetLight }} />
            <h2 className="text-sm font-semibold" style={headingFont}>
              Romaneios criados ({records.length})
            </h2>
          </div>

          {records.length ? (
            records.map((record) => {
              const brand = getCarrierBrand(record.carrierName);

              return (
                <article key={record.id} className="overflow-hidden rounded-[24px] p-4" style={cardStyle}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-[12px] font-extrabold"
                          style={{ backgroundColor: brand.bg, color: brand.color }}
                        >
                          {brand.init}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                          style={{
                            border: `1px solid ${hexAlpha(mobileColors.violet, 0.2)}`,
                            background: hexAlpha(mobileColors.violet, 0.1),
                            color: mobileColors.violetLight,
                          }}
                        >
                          {record.code}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`,
                            background: hexAlpha("#94A3B8", 0.05),
                            color: mobileColors.muted,
                          }}
                        >
                          {record.statusLabel}
                        </span>
                      </div>

                      <h2 className="mt-3 flex items-center gap-2 text-lg font-semibold" style={{ color: mobileColors.text, ...headingFont }}>
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
                      style={{
                        border: `1px solid ${hexAlpha(mobileColors.violet, 0.2)}`,
                        background: hexAlpha(mobileColors.violet, 0.1),
                        color: mobileColors.violetLight,
                      }}
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
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold" style={{ color: mobileColors.text }}>
                                {order.externalNumber || order.code}
                              </p>
                              <span className="text-xs font-medium text-amber-400">
                                {order.invoiceNumber}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs" style={{ color: mobileColors.muted }}>
                              {order.customer}
                            </p>
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
                    {record.orders.length > 3 && (
                      <p className="text-center text-[11px] pt-1" style={{ color: mobileColors.dim }}>
                        + {record.orders.length - 3} outro(s) pedido(s)
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {record.status === "ABERTO" ? (
                      <Link
                        href={`/m/romaneio/${record.id}/fechar`}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400"
                      >
                        <Truck className="h-4 w-4" />
                        Fechar Romaneio
                      </Link>
                    ) : null}

                    <Link
                      href={`/romaneio/${record.id}`}
                      className="inline-flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold transition"
                      style={{
                        border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`,
                        background: hexAlpha("#94A3B8", 0.05),
                        color: mobileColors.text,
                      }}
                    >
                      Detalhes
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <div
              className="rounded-[24px] px-4 py-8 text-center text-sm"
              style={{ border: `1px dashed ${hexAlpha("#94A3B8", 0.2)}`, color: mobileColors.muted }}
            >
              Nenhum romaneio criado no momento.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div
      className="flex flex-1 flex-col gap-0.5 rounded-[14px] px-[14px] py-[13px]"
      style={{ background: hexAlpha(color, 0.1), border: `1px solid ${hexAlpha(color, 0.22)}` }}
    >
      <span className="text-[22px] font-bold" style={{ color, ...headingFont }}>
        {value}
      </span>
      <span className="text-[11.5px]" style={{ color: mobileColors.muted }}>
        {label}
      </span>
    </div>
  );
}
