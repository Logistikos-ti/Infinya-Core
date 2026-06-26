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
import { getMobileOperationsSnapshot } from "@/lib/mobile-home";
import { getMobileWelcomeLabel } from "@/lib/mobile";
import { canAccessModule } from "@/lib/permissions";

export default async function MobileHomePage() {
  const user = await requireUserContext();
  const canAccessReceiving = canAccessModule(user, "recebimento");
  const canAccessShipping = canAccessModule(user, "expedicao");

  const snapshot = await getMobileOperationsSnapshot(user, {
    includeReceiving: canAccessReceiving,
    includeShipping: canAccessShipping,
  });

  const cards = [
    {
      href: "/m/recebimento",
      title: "Recebimento",
      value: snapshot.receiving.count,
      help: "Fila inbound do turno",
      detail: snapshot.receiving.first?.code ?? "Sem recebimentos em aberto",
      icon: PackageCheck,
      tone: "bg-emerald-500/15 text-emerald-300",
      visible: canAccessReceiving,
    },
    {
      href: "/m/separacao",
      title: "Separação",
      value: snapshot.picking.count,
      help: "Pedidos aguardando coleta",
      detail: snapshot.picking.first?.externalNumber ?? "Sem picking pendente",
      icon: ScanLine,
      tone: "bg-sky-500/15 text-sky-300",
      visible: canAccessShipping,
    },
    {
      href: "/m/conferencia",
      title: "Conferência",
      value: snapshot.conference.count,
      help: "Pedidos para validar",
      detail: snapshot.conference.first?.externalNumber ?? "Sem conferência pendente",
      icon: ClipboardCheck,
      tone: "bg-amber-500/15 text-amber-300",
      visible: canAccessShipping,
    },
  ].filter((card) => card.visible);

  const totalPendencias =
    snapshot.receiving.count + snapshot.picking.count + snapshot.conference.count;

  const nextAction =
    (snapshot.picking.first && {
      href: `/m/separacao/${snapshot.picking.first.id}`,
      title: "Iniciar separação",
      description: `${snapshot.picking.first.externalNumber} • ${snapshot.picking.first.customer}`,
      tone: "text-sky-300",
    }) ||
    (snapshot.conference.first && {
      href: `/m/conferencia/${snapshot.conference.first.id}`,
      title: "Continuar conferência",
      description: `${snapshot.conference.first.externalNumber} • ${snapshot.conference.first.customer}`,
      tone: "text-amber-300",
    }) ||
    (snapshot.receiving.first && {
      href: `/m/recebimento/${snapshot.receiving.first.id}`,
      title: "Abrir recebimento",
      description: `${snapshot.receiving.first.code} • ${snapshot.receiving.first.depositante}`,
      tone: "text-emerald-300",
    }) ||
    null;

  const alertItems = [
    snapshot.picking.count > 0
      ? `${snapshot.picking.count} pedido(s) aguardando separação`
      : null,
    snapshot.conference.divergentItems > 0
      ? `${snapshot.conference.divergentItems} divergência(s) em conferência`
      : null,
    snapshot.receiving.count > 0
      ? `${snapshot.receiving.count} recebimento(s) aguardando avanço`
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
          <SummaryChip icon={ScanLine} label="Picking" value={String(snapshot.picking.count)} />
          <SummaryChip icon={CheckCircle2} label="Conf." value={String(snapshot.conference.count)} />
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
