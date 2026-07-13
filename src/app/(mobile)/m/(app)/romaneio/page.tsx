import Link from "next/link";
import { FileDown, FileText, Truck } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { listRomaneioGroupsFromDb } from "@/lib/romaneio";

export default async function MobileRomaneioPage() {
  const user = await requireModuleAccess("romaneio");
  const groups = await listRomaneioGroupsFromDb(user);
  const totalOrders = groups.reduce((sum, group) => sum + group.orderCount, 0);
  const totalUnits = groups.reduce((sum, group) => sum + group.totalUnitsRaw, 0);

  return (
    <div className="space-y-4">
      <section className="mobile-hero-card overflow-hidden rounded-[28px] border border-white/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-100/90">
          Romaneio operacional
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Cargas por transportadora</h1>
        <p className="mt-2 text-sm leading-6 text-slate-100/90">
          Consulte os agrupamentos prontos para expedição e emita o romaneio em PDF direto no app.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Transportadoras" value={String(groups.length)} />
          <MiniStat label="Pedidos" value={String(totalOrders)} />
        </div>
        <div className="mt-2">
          <MiniStat label="Unidades totais" value={totalUnits.toLocaleString("pt-BR")} />
        </div>
      </section>

      <section className="space-y-3">
        {groups.length ? (
          groups.map((group) => (
            <article
              key={group.slug}
              className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100">
                      {group.orderCount} pedidos
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                      {group.statuses.join(" • ")}
                    </span>
                  </div>

                  <h2 className="mt-3 flex items-center gap-2 text-lg font-semibold text-white">
                    <Truck className="h-4 w-4 text-violet-300" />
                    <span className="truncate">{group.carrierName}</span>
                  </h2>

                  <p className="mt-1 text-sm text-slate-300">
                    Depositantes: {group.depositantes.join(", ") || "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Cutoff: {group.cutoff} • Valor: {group.totalValue}
                  </p>
                </div>

                <Link
                  href={buildRomaneioPdfHref(group.orders.map((order) => order.id))}
                  target="_blank"
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/15"
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </Link>
              </div>

              <div className="mt-4 space-y-2">
                {group.orders.slice(0, 4).map((order) => (
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
                          {order.destination}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-slate-300">
                        <p>{order.units} un</p>
                        <p className="mt-1">{order.total}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {group.orders.length > 4 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-3 py-2 text-center text-xs text-slate-400">
                    +{group.orders.length - 4} pedido(s) neste romaneio
                  </div>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-slate-300">
            Nenhum agrupamento de romaneio encontrado no momento.
          </div>
        )}
      </section>

      <Link
        href="/romaneio"
        className="mobile-action-card flex items-center justify-between rounded-[24px] px-4 py-4 text-sm text-slate-300 transition hover:-translate-y-0.5"
      >
        <span className="inline-flex items-center gap-2 font-medium text-white">
          <FileText className="h-4 w-4" />
          Abrir romaneio completo no desktop
        </span>
        <span>Web</span>
      </Link>
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

function buildRomaneioPdfHref(ids: string[]) {
  const params = new URLSearchParams();

  for (const id of ids) {
    params.append("ids", id);
  }

  return `/api/romaneio/pdf?${params.toString()}`;
}
