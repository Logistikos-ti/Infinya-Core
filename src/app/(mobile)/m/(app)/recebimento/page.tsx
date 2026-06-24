import Link from "next/link";
import { ArrowRight, Boxes, Truck } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { listReceivingOrdersFromDb } from "@/lib/receiving";

export default async function MobileReceivingQueuePage() {
  const user = await requireModuleAccess("recebimento");
  const orders = await listReceivingOrdersFromDb({
    depositanteId: user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : undefined,
  });

  const totalVolumes = orders.reduce((sum, order) => sum + order.volumeCount, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Recebimento
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Agenda inbound</h1>
        <p className="mt-2 text-sm text-slate-300">
          Abra o recebimento, confira os itens e lance a entrada no estoque pelo app.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Pedidos" value={String(orders.length)} icon={Truck} />
          <MiniStat label="Volumes" value={String(totalVolumes)} icon={Boxes} />
        </div>
      </section>

      <section className="space-y-3">
        {orders.length ? (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/m/recebimento/${order.id}`}
              className="block rounded-[24px] border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">{order.code}</p>
                  <p className="mt-1 truncate text-sm text-slate-300">{order.depositante}</p>
                  <p className="mt-1 truncate text-sm text-slate-400">{order.supplier}</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  {order.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <QueueInfo label="Previsão" value={order.eta} />
                <QueueInfo label="Volumes" value={`${order.volumeCount}`} />
                <QueueInfo label="SKUs" value={`${order.skuCount}`} />
                <QueueInfo label="Status" value={order.status} />
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
                <p className="text-xs text-slate-400">Pronto para conferência mobile</p>
                <span className="inline-flex items-center gap-1 font-medium text-white">
                  Abrir
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-slate-300">
            Nenhum recebimento disponível no momento.
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
  icon: typeof Truck;
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
