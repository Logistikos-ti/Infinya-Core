import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  PackageCheck,
  ScanLine,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { requireUserContext } from "@/lib/auth";
import { getMobileOperationsSnapshot } from "@/lib/mobile-home";
import { getMobileWelcomeLabel } from "@/lib/mobile";
import {
  canAccessModule,
  isCatalogAndStockOperatorUser,
  isProductCatalogOnlyUser,
} from "@/lib/permissions";

export default async function MobileHomePage() {
  const user = await requireUserContext();
  const isCatalogOnly = isProductCatalogOnlyUser(user);
  const isCatalogAndStockUser = isCatalogAndStockOperatorUser(user);
  const canAccessStock = canAccessModule(user, "estoque");
  const canAccessReceiving = canAccessModule(user, "recebimento");
  const canAccessShipping = canAccessModule(user, "expedicao");
  const canAccessRomaneio = canAccessModule(user, "romaneio");

  if (isCatalogOnly) {
    return (
      <div className="space-y-4">
        <section className="mobile-hero-card overflow-hidden rounded-[28px] border border-white/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
            Catalogo operacional
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Ola, {user.nome.split(" ")[0]}</h1>
          <p className="mt-2 max-w-[22rem] text-sm leading-6 text-slate-100/90">
            Use este espaco para cadastrar, revisar e ajustar produtos com seguranca pelo celular.
          </p>
        </section>

        <Link
          href="/m/produtos"
          className="mobile-action-card block rounded-[24px] p-4 transition hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-white">Produtos</p>
              <p className="mt-1 text-sm text-slate-300">
                Abrir catalogo, cadastrar novos itens e revisar codigos de barras.
              </p>
            </div>
            <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-300">
              <Settings2 className="h-5 w-5" />
            </div>
          </div>
        </Link>

      </div>
    );
  }

  if (isCatalogAndStockUser) {
    return (
      <div className="space-y-4">
        <section className="mobile-hero-card overflow-hidden rounded-[28px] border border-white/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
            {canAccessShipping ? "Operação de expedição" : "Estoque operacional"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Ola, {user.nome.split(" ")[0]}</h1>
          <p className="mt-2 max-w-[22rem] text-sm leading-6 text-slate-100/90">
            {canAccessStock && canAccessShipping
              ? "Acesse estoque, fila de expedição e cadastro operacional sem depender do painel completo."
              : canAccessShipping
                ? "Entre direto na fila de separação e mantenha também o catálogo operacional atualizado."
                : "Consulte saldos, protocolos e inventario do armazem, alem de manter o catalogo de produtos atualizado."}
          </p>
        </section>

        {canAccessStock ? (
          <Link
            href="/m/estoque"
            className="mobile-action-card block rounded-[24px] p-4 transition hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">Estoque e inventario</p>
                <p className="mt-1 text-sm text-slate-300">
                  Abrir consulta de saldo, protocolos e rastreabilidade do armazem.
                </p>
              </div>
              <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-300">
                <PackageCheck className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ) : null}

        {canAccessShipping ? (
          <Link
            href="/m/separacao"
            className="mobile-action-card block rounded-[24px] p-4 transition hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">Expedição</p>
                <p className="mt-1 text-sm text-slate-300">
                  Abrir fila de separação e seguir o fluxo operacional de saída.
                </p>
              </div>
              <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-300">
                <ScanLine className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ) : null}

        {canAccessRomaneio ? (
          <Link
            href="/m/romaneio"
            className="mobile-action-card block rounded-[24px] p-4 transition hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">Romaneio</p>
                <p className="mt-1 text-sm text-slate-300">
                  Agrupar pedidos por transportadora e emitir o PDF da carga.
                </p>
              </div>
              <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-300">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </Link>
        ) : null}

        <Link
          href="/m/produtos"
          className="mobile-action-card block rounded-[24px] p-4 transition hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-white">Produtos</p>
              <p className="mt-1 text-sm text-slate-300">
                Cadastrar novos itens, revisar codigos de barras e manter o catalogo operacional.
              </p>
            </div>
            <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-300">
              <Settings2 className="h-5 w-5" />
            </div>
          </div>
        </Link>

      </div>
    );
  }

  const snapshot = await getMobileOperationsSnapshot(user, {
    includeReceiving: canAccessReceiving,
    includeShipping: canAccessShipping,
    includeRomaneio: canAccessRomaneio,
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
      title: "Separacao",
      value: snapshot.picking.count,
      help: "Pedidos aguardando coleta",
      detail: snapshot.picking.first?.externalNumber ?? "Sem picking pendente",
      icon: ScanLine,
      tone: "bg-sky-500/15 text-sky-300",
      visible: canAccessShipping,
    },
    {
      href: "/m/conferencia",
      title: "Conferencia",
      value: snapshot.conference.count,
      help: "Pedidos para validar",
      detail: snapshot.conference.first?.externalNumber ?? "Sem conferencia pendente",
      icon: ClipboardCheck,
      tone: "bg-amber-500/15 text-amber-300",
      visible: canAccessShipping,
    },
    {
      href: "/m/romaneio",
      title: "Romaneio",
      value: snapshot.romaneio.count,
      help: "Cargas prontas para emissao",
      detail: snapshot.romaneio.first?.depositante ?? "Sem romaneio pendente",
      icon: FileText,
      tone: "bg-violet-500/15 text-violet-300",
      visible: canAccessRomaneio,
    },
  ].filter((card) => card.visible);

  const totalPendencias =
    snapshot.receiving.count +
    snapshot.picking.count +
    snapshot.conference.count +
    snapshot.romaneio.count;

  const nextAction =
    (snapshot.picking.first && {
      href: `/m/separacao/${snapshot.picking.first.id}`,
      title: "Iniciar separacao",
      description: `${snapshot.picking.first.externalNumber} • ${snapshot.picking.first.customer}`,
      tone: "text-sky-300",
    }) ||
    (snapshot.conference.first && {
      href: `/m/conferencia/${snapshot.conference.first.id}`,
      title: "Continuar conferencia",
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
    snapshot.picking.count > 0 ? `${snapshot.picking.count} pedido(s) aguardando separacao` : null,
    snapshot.conference.divergentItems > 0
      ? `${snapshot.conference.divergentItems} divergencia(s) em conferencia`
      : null,
    snapshot.receiving.count > 0
      ? `${snapshot.receiving.count} recebimento(s) aguardando avanco`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <section className="mobile-hero-card overflow-hidden rounded-[28px] border border-white/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
              {getMobileWelcomeLabel(user)}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Ola, {user.nome.split(" ")[0]}</h1>
            <p className="mt-2 max-w-[22rem] text-sm leading-6 text-slate-100/90">
              Acesse rapido os modulos criticos da operacao sem passar pelo painel administrativo.
            </p>
          </div>

          <div className="mobile-soft-chip rounded-2xl px-3 py-2 text-right text-xs text-sky-50">
            <p className="font-semibold uppercase tracking-wide">Hoje</p>
            <p className="mt-1">{formatDateLabel(new Date())}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <SummaryChip icon={CalendarDays} label="Pendencias" value={String(totalPendencias)} />
          <SummaryChip icon={ScanLine} label="Picking" value={String(snapshot.picking.count)} />
          <SummaryChip icon={CheckCircle2} label="Conf." value={String(snapshot.conference.count)} />
        </div>
      </section>

      {nextAction ? (
        <Link
          href={nextAction.href}
          className="mobile-action-card block rounded-[24px] p-4 transition hover:-translate-y-0.5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Proxima acao
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
            <p className="text-sm font-semibold text-white">Acoes rapidas</p>
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
