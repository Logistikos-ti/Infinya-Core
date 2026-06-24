import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { requireUserContext } from "@/lib/auth";
import { getMobileWelcomeLabel } from "@/lib/mobile";
import { canAccessModule } from "@/lib/permissions";
import { listReceivingOrdersFromDb } from "@/lib/receiving";
import { listShippingConferenceOrdersFromDb } from "@/lib/shipping-conference";
import { listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";

export default async function MobileHomePage() {
  const user = await requireUserContext();

  const [receivingOrders, pickingOrders, conferenceOrders] = await Promise.all([
    listReceivingOrdersFromDb({
      depositanteId: user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : undefined,
    }),
    listShippingPickingOrdersFromDb(user),
    listShippingConferenceOrdersFromDb(user),
  ]);

  const cards = [
    {
      href: "/m/recebimento",
      title: "Recebimento",
      value: receivingOrders.length,
      help: "Fila inbound do turno",
      detail: receivingOrders[0]?.code ?? "Sem recebimentos em aberto",
      icon: PackageCheck,
      tone: "bg-emerald-500/15 text-emerald-300",
      visible: canAccessModule(user, "recebimento"),
    },
    {
      href: "/m/separacao",
      title: "Separação",
      value: pickingOrders.length,
      help: "Pedidos aguardando coleta",
      detail: pickingOrders[0]?.externalNumber ?? "Sem picking pendente",
      icon: ScanLine,
      tone: "bg-sky-500/15 text-sky-300",
      visible: canAccessModule(user, "expedicao"),
    },
    {
      href: "/m/conferencia",
      title: "Conferência",
      value: conferenceOrders.length,
      help: "Pedidos para validar",
      detail: conferenceOrders[0]?.externalNumber ?? "Sem conferência pendente",
      icon: ClipboardCheck,
      tone: "bg-amber-500/15 text-amber-300",
      visible: canAccessModule(user, "expedicao"),
    },
  ].filter((card) => card.visible);

  const totalPendencias =
    receivingOrders.length + pickingOrders.length + conferenceOrders.length;

  const nextAction =
    (pickingOrders[0] && {
      href: `/m/separacao/${pickingOrders[0].id}`,
      title: "Iniciar separação",
      description: `${pickingOrders[0].externalNumber} • ${pickingOrders[0].customer}`,
      tone: "text-sky-300",
    }) ||
    (conferenceOrders[0] && {
      href: `/m/conferencia/${conferenceOrders[0].id}`,
      title: "Continuar conferência",
      description: `${conferenceOrders[0].externalNumber} • ${conferenceOrders[0].customer}`,
      tone: "text-amber-300",
    }) ||
    (receivingOrders[0] && {
      href: `/m/recebimento/${receivingOrders[0].id}`,
      title: "Abrir recebimento",
      description: `${receivingOrders[0].code} • ${receivingOrders[0].depositante}`,
      tone: "text-emerald-300",
    }) ||
    null;

  const alertItems = [
    pickingOrders.length > 0
      ? `${pickingOrders.length} pedido(s) aguardando separação`
      : null,
    conferenceOrders.some((order) => order.quantityDivergentItems > 0)
      ? `${conferenceOrders.reduce((sum, order) => sum + order.quantityDivergentItems, 0)} divergência(s) em conferência`
      : null,
    receivingOrders.length > 0
      ? `${receivingOrders.length} recebimento(s) aguardando avanço`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-sky-500 via-sky-600 to-slate-950 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
              {getMobileWelcomeLabel(user)}
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Olá, {user.nome.split(" ")[0]}</h1>
            <p className="mt-2 max-w-[22rem] text-sm leading-6 text-slate-100/90">
              Acesse rápido os módulos críticos da operação sem passar pelo painel administrativo.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 px-3 py-2 text-right text-xs text-sky-50 backdrop-blur">
            <p className="font-semibold uppercase tracking-wide">Hoje</p>
            <p className="mt-1">{formatDateLabel(new Date())}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <SummaryChip icon={CalendarDays} label="Pendências" value={String(totalPendencias)} />
          <SummaryChip icon={ScanLine} label="Picking" value={String(pickingOrders.length)} />
          <SummaryChip icon={CheckCircle2} label="Conf." value={String(conferenceOrders.length)} />
        </div>
      </section>

      {nextAction ? (
        <Link
          href={nextAction.href}
          className="block rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur transition hover:bg-white/7"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Próxima ação
          </p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className={`text-base font-semibold ${nextAction.tone}`}>{nextAction.title}</p>
              <p className="mt-1 truncate text-sm text-slate-300">{nextAction.description}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-white">
              Abrir
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      ) : null}

      {alertItems.length ? (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-100">Alertas do turno</p>
              <div className="space-y-1 text-sm text-amber-50/90">
                {alertItems.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Ações rápidas</p>
            <p className="text-xs text-slate-400">Entre no fluxo certo do turno</p>
          </div>
        </div>

        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.href}
              href={card.href}
              className="block rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur transition hover:bg-white/7"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">{card.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{card.help}</p>
                </div>
                <div className={`rounded-2xl p-3 ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-3xl font-semibold text-white">{card.value}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">{card.detail}</p>
                </div>

                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-slate-200">
                  Abrir
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function SummaryChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-3 backdrop-blur">
      <div className="flex items-center gap-2 text-sky-100">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}
