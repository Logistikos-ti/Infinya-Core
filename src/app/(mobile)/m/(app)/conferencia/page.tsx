import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { listShippingConferenceOrdersFromDb } from "@/lib/shipping-conference";

type MobileConferenceQueuePageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

const CONFERENCE_CARD_TONES = [
  {
    wrapper:
      "border-amber-400/25 bg-gradient-to-br from-amber-500/16 via-slate-900/92 to-slate-950",
    badge: "bg-amber-400/15 text-amber-200 border border-amber-300/30",
    accent: "bg-amber-300",
    stat: "border-amber-400/15 bg-amber-500/10",
    cta: "text-amber-100",
  },
  {
    wrapper:
      "border-orange-400/25 bg-gradient-to-br from-orange-500/14 via-slate-900/92 to-slate-950",
    badge: "bg-orange-400/15 text-orange-200 border border-orange-300/30",
    accent: "bg-orange-300",
    stat: "border-orange-400/15 bg-orange-500/10",
    cta: "text-orange-100",
  },
  {
    wrapper:
      "border-rose-400/25 bg-gradient-to-br from-rose-500/14 via-slate-900/92 to-slate-950",
    badge: "bg-rose-400/15 text-rose-200 border border-rose-300/30",
    accent: "bg-rose-300",
    stat: "border-rose-400/15 bg-rose-500/10",
    cta: "text-rose-100",
  },
] as const;

export default async function MobileConferenceQueuePage({
  searchParams,
}: MobileConferenceQueuePageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback?.trim() ?? "";
  const orders = await listShippingConferenceOrdersFromDb(user);

  const pendingUnits = orders.reduce((sum, order) => sum + order.pendingUnits, 0);
  const divergenceCount = orders.reduce((sum, order) => sum + order.quantityDivergentItems, 0);

  return (
    <div className="space-y-4">
      {feedback === "inatividade" ? (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Pedido devolvido para a fila por inatividade do operador.
        </section>
      ) : feedback === "incompleto" ? (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Ainda existem itens pendentes. O pedido voltou para a fila para nova conferência.
        </section>
      ) : feedback === "concluido" ? (
        <section className="rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Conferência concluída com sucesso.
        </section>
      ) : null}

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
          orders.map((order, index) => {
            const tone = CONFERENCE_CARD_TONES[index % CONFERENCE_CARD_TONES.length];

            return (
              <Link
                key={order.id}
                href={`/m/conferencia/${order.id}`}
                className={`block overflow-hidden rounded-[26px] border p-4 shadow-lg backdrop-blur transition active:scale-[0.99] ${tone.wrapper}`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${tone.accent}`} />
                    <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                      Pedido {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.badge}`}>
                    {order.statusLabel}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-lg font-semibold text-white">{order.externalNumber}</p>
                  <p className="line-clamp-2 text-sm leading-6 text-slate-200">
                    {order.customer} • {order.destination}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <InlineChip icon={UserRound} text={order.assignedOperatorName ?? "Sem operador"} />
                  <InlineChip icon={ClipboardCheck} text={order.depositante} />
                  {order.quantityDivergentItems > 0 ? (
                    <InlineChip
                      icon={TriangleAlert}
                      text={`${order.quantityDivergentItems} divergência(s)`}
                      danger
                    />
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <QueueInfo label="Itens" value={`${order.totalItems}`} tone={tone.stat} />
                  <QueueInfo label="Unidades" value={`${order.totalUnits}`} tone={tone.stat} />
                  <QueueInfo label="Conferido" value={`${order.completionPercent}%`} tone={tone.stat} />
                  <QueueInfo
                    label="Divergência"
                    value={order.quantityDivergentItems ? String(order.quantityDivergentItems) : "0"}
                    tone={tone.stat}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Código interno
                    </p>
                    <p className="truncate text-sm font-medium text-slate-100">{order.code}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 text-sm font-semibold ${tone.cta}`}>
                    Iniciar
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })
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

function QueueInfo({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl border px-3 py-2 ${tone}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function InlineChip({
  icon: Icon,
  text,
  danger = false,
}: {
  icon: typeof UserRound;
  text: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
        danger
          ? "border-amber-300/25 bg-amber-500/12 text-amber-100"
          : "border-white/10 bg-white/8 text-slate-200"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${danger ? "text-amber-300" : "text-slate-400"}`} />
      <span className="truncate">{text}</span>
    </div>
  );
}
