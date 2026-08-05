"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { mobileColors, mobileGradient, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";
import { getCarrierBrand } from "@/lib/carrier-branding";
import { getSaoPauloDateStamp } from "@/lib/utils";
import type { RomaneioRecordListItem } from "@/lib/romaneio-records";

type Tab = "abertos" | "finalizados";

const cardStyle = { border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) };

/** "YYYYMM" in America/Sao_Paulo, or null if the date is missing/invalid. */
function monthKey(value: string | null | undefined) {
  const stamp = getSaoPauloDateStamp(value ?? null);
  return stamp ? stamp.slice(0, 6) : null;
}

export function RomaneioListClient({ records }: { records: RomaneioRecordListItem[] }) {
  const [tab, setTab] = useState<Tab>("abertos");

  // Fixed for the lifetime of this page load, not recomputed per render --
  // a page open right at midnight on the 1st doesn't need to reshuffle
  // mid-session, the next visit already reflects the new month.
  const currentMonthKey = useMemo(() => monthKey(new Date().toISOString()), []);

  // "Finalizado" here covers anything that no longer needs action --
  // liberado (already sent out) or cancelado -- so closing a romaneio
  // moves it out of "Abertos" automatically without any manual step.
  // Scoped to the current calendar month: once the month turns over, a
  // romaneio finalizado in a previous month simply stops showing up here
  // (still on the desktop reports, just not cluttering this quick list).
  const openRecords = useMemo(() => records.filter((r) => r.status === "ABERTO"), [records]);
  const finalizedRecords = useMemo(
    () =>
      records.filter((r) => {
        if (r.status === "ABERTO") return false;
        const referenceDate = r.releasedAt ?? r.canceledAt ?? r.updatedAt;
        return monthKey(referenceDate) === currentMonthKey;
      }),
    [records, currentMonthKey],
  );
  const activeRecords = tab === "abertos" ? openRecords : finalizedRecords;

  return (
    <section className="space-y-3 mt-2">
      <div className="flex gap-2 rounded-[16px] p-1" style={{ background: hexAlpha("#94A3B8", 0.06) }}>
        <TabButton active={tab === "abertos"} onClick={() => setTab("abertos")} label="Abertos" count={openRecords.length} />
        <TabButton active={tab === "finalizados"} onClick={() => setTab("finalizados")} label="Finalizados" count={finalizedRecords.length} />
      </div>

      {tab === "finalizados" && (
        <p className="px-1 text-[11.5px]" style={{ color: mobileColors.dim }}>
          Mostrando apenas os finalizados deste mês.
        </p>
      )}

      {activeRecords.length ? (
        activeRecords.map((record) => {
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
                        border: `1px solid ${hexAlpha(statusColor(record.status), 0.25)}`,
                        background: hexAlpha(statusColor(record.status), 0.12),
                        color: statusColor(record.status),
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
                            {order.code}
                          </p>
                          <span className="text-xs font-medium" style={{ color: mobileColors.amber }}>
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

              {record.status === "ABERTO" && (
                <div className="mt-4 flex">
                  <Link
                    href={`/m/romaneio/${record.id}/fechar`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-xs font-extrabold text-white active:scale-[0.98] transition"
                    style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
                  >
                    <Truck className="h-4 w-4" />
                    Fechar Romaneio
                  </Link>
                </div>
              )}
            </article>
          );
        })
      ) : (
        <div
          className="rounded-[24px] px-4 py-8 text-center text-sm"
          style={{ border: `1px dashed ${hexAlpha("#94A3B8", 0.2)}`, color: mobileColors.muted }}
        >
          {tab === "abertos" ? "Nenhum romaneio em aberto no momento." : "Nenhum romaneio finalizado neste mês."}
        </div>
      )}
    </section>
  );
}

function statusColor(status: RomaneioRecordListItem["status"]) {
  if (status === "LIBERADO") return mobileColors.green;
  if (status === "CANCELADO") return mobileColors.red;
  return mobileColors.muted;
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-[13px] font-bold transition"
      style={{
        background: active ? mobileGradient : "transparent",
        color: active ? "#fff" : mobileColors.muted,
        boxShadow: active ? "0 6px 16px rgba(99,102,241,0.35)" : "none",
      }}
    >
      {label}
      <span
        className="rounded-full px-1.5 text-[11px]"
        style={{ background: active ? "rgba(255,255,255,0.22)" : hexAlpha("#94A3B8", 0.15) }}
      >
        {count}
      </span>
    </button>
  );
}
