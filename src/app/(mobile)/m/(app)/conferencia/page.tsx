import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardCheck, ShieldCheck } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { listShippingConferenceOrdersFromDb } from "@/lib/shipping-conference";

export default async function MobileConferenceQueuePage() {
  const user = await requireModuleAccess("expedicao");
  const orders = await listShippingConferenceOrdersFromDb(user);

  const pendingUnits = orders.reduce((sum, order) => sum + order.pendingUnits, 0);
  const divergenceCount = orders.reduce((sum, order) => sum + order.quantityDivergentItems, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
          Conferência
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Fila de validação</h1>
        <p className="mt-2 text-sm text-slate-300">
          Abra o pedido, escaneie item a item e confirme antes da expedição.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Pedidos" value={String(orders.length)} icon={ClipboardCheck} />
          <MiniStat label="Pendentes" value={String(pendingUnits)} icon={ShieldCheck} />
        </div>
      </section>

      {divergenceCount > 0 ? (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Atenção na fila</p>
              <p className="mt-1">
                Existem {divergenceCount} divergência(s) de quantidade em pedidos já iniciados.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {orders.length ? (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/m/conferencia/${order.id}`}
              className="block rounded-[24px] border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">{order.externalNumber}</p>
                  <p className="mt-1 truncate text-sm text-slate-300">
                    {order.customer} • {order.destination}
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                  {order.statusLabel}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <QueueInfo label="Itens" value={`${order.totalItems}`} />
                <QueueInfo label="Unidades" value={`${order.totalUnits}`} />
                <QueueInfo label="Conferido" value={`${order.completionPercent}%`} />
                <QueueInfo
                  label="Divergência"
                  value={order.quantityDivergentItems ? String(order.quantityDivergentItems) : "0"}
                />
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
            Nenhum pedido disponível para conferência no momento.
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
  icon: typeof ClipboardCheck;
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
