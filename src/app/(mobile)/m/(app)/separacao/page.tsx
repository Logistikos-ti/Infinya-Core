import Link from "next/link";
import { ArrowRight, Package2, ScanLine } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";

export default async function MobilePickingQueuePage() {
  const user = await requireModuleAccess("expedicao");
  const orders = await listShippingPickingOrdersFromDb(user);

  const pendingUnits = orders.reduce((sum, order) => sum + order.totalUnits, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
          Separação
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Fila de picking</h1>
        <p className="mt-2 text-sm text-slate-300">
          Abra um pedido, siga a rota sugerida e conclua a coleta no app.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Pedidos" value={String(orders.length)} icon={ScanLine} />
          <MiniStat label="Unidades" value={String(pendingUnits)} icon={Package2} />
        </div>
      </section>

      <section className="space-y-3">
        {orders.length ? (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/m/separacao/${order.id}`}
              className="block rounded-[24px] border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">{order.externalNumber}</p>
                  <p className="mt-1 truncate text-sm text-slate-300">
                    {order.customer} • {order.destination}
                  </p>
                </div>
                <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300">
                  {order.statusLabel}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <QueueInfo label="Itens" value={`${order.totalItems}`} />
                <QueueInfo label="Unidades" value={`${order.totalUnits}`} />
                <QueueInfo label="Paradas" value={`${order.routeStopCount}`} />
                <QueueInfo label="Concluído" value={`${order.completionPercent}%`} />
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
                <div className="space-y-1">
                  <p>Operador: {order.assignedOperatorName ?? "Não atribuído"}</p>
                  <p className="text-xs text-slate-400">Depositante: {order.depositante}</p>
                </div>
                <span className="inline-flex items-center gap-1 font-medium text-white">
                  Iniciar
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-slate-300">
            Nenhum pedido disponível para separação no momento.
          </div>
        )}
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Package2;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center gap-2 text-slate-300">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function QueueInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
