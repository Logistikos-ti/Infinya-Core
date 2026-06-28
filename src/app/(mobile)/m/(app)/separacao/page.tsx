import Link from "next/link";
import { ArrowRight, Package2, ScanLine, UserRound } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";

type MobilePickingQueuePageProps = {
  searchParams?: Promise<{
    feedback?: string;
    page?: string;
    perPage?: string;
  }>;
};

const PICKING_CARD_TONES = [
  {
    wrapper:
      "border-sky-400/25 bg-gradient-to-br from-sky-500/16 via-slate-900/92 to-slate-950",
    badge: "border border-sky-300/30 bg-sky-400/15 text-sky-200",
    accent: "bg-sky-300",
    stat: "border-sky-400/15 bg-sky-500/10",
    cta: "text-sky-100",
  },
  {
    wrapper:
      "border-cyan-400/25 bg-gradient-to-br from-cyan-500/14 via-slate-900/92 to-slate-950",
    badge: "border border-cyan-300/30 bg-cyan-400/15 text-cyan-200",
    accent: "bg-cyan-300",
    stat: "border-cyan-400/15 bg-cyan-500/10",
    cta: "text-cyan-100",
  },
  {
    wrapper:
      "border-violet-400/25 bg-gradient-to-br from-violet-500/14 via-slate-900/92 to-slate-950",
    badge: "border border-violet-300/30 bg-violet-400/15 text-violet-200",
    accent: "bg-violet-300",
    stat: "border-violet-400/15 bg-violet-500/10",
    cta: "text-violet-100",
  },
] as const;

export default async function MobilePickingQueuePage({
  searchParams,
}: MobilePickingQueuePageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback?.trim() ?? "";
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = normalizePerPage(params?.perPage);
  const orders = await listShippingPickingOrdersFromDb(user);
  const pendingUnits = orders.reduce((sum, order) => sum + order.totalUnits, 0);
  const totalOrders = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedOrders = orders.slice(startIndex, startIndex + perPage);
  const visibleStart = totalOrders ? startIndex + 1 : 0;
  const visibleEnd = Math.min(startIndex + perPage, totalOrders);

  return (
    <div className="space-y-4">
      {feedback === "inatividade" ? (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Pedido devolvido para a fila por inatividade do operador.
        </section>
      ) : feedback === "incompleto" ? (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Ainda existem itens pendentes. O pedido voltou para a fila para nova separação.
        </section>
      ) : feedback === "concluido" ? (
        <section className="rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Separação concluída com sucesso.
        </section>
      ) : null}

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
          Separação
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Fila de picking</h1>
        <p className="mt-2 text-sm text-slate-300">
          Abra um pedido e conclua a coleta diretamente no app.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Pedidos" value={String(totalOrders)} icon={ScanLine} />
          <MiniStat label="Unidades" value={String(pendingUnits)} icon={Package2} />
        </div>
      </section>

      {paginatedOrders.length ? (
        <section className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <div className="flex flex-col gap-3">
            <span>
              Exibindo {visibleStart}-{visibleEnd} de {totalOrders} pedido(s)
            </span>
            <div className="flex items-center justify-between gap-2">
              <PageLink
                disabled={currentPage <= 1}
                href={`/m/separacao?${buildQueryString({
                  feedback,
                  perPage: String(perPage),
                  page: String(currentPage - 1),
                })}`}
              >
                Anterior
              </PageLink>
              <span className="text-xs font-medium text-slate-400">
                Página {currentPage} de {totalPages}
              </span>
              <PageLink
                disabled={currentPage >= totalPages}
                href={`/m/separacao?${buildQueryString({
                  feedback,
                  perPage: String(perPage),
                  page: String(currentPage + 1),
                })}`}
              >
                Próxima
              </PageLink>
            </div>
            <div className="flex gap-2">
              {[10, 20, 50].map((value) => (
                <Link
                  key={value}
                  href={`/m/separacao?${buildQueryString({
                    feedback,
                    perPage: String(value),
                    page: "1",
                  })}`}
                  className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold ${
                    perPage === value
                      ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
                      : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                >
                  {value}/página
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {paginatedOrders.length ? (
          paginatedOrders.map((order, index) => {
            const tone = PICKING_CARD_TONES[(startIndex + index) % PICKING_CARD_TONES.length];

            return (
              <Link
                key={order.id}
                href={`/m/separacao/${order.id}`}
                className={`block overflow-hidden rounded-[26px] border p-4 shadow-lg backdrop-blur transition active:scale-[0.99] ${tone.wrapper}`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${tone.accent}`} />
                    <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                      Pedido {String(startIndex + index + 1).padStart(2, "0")}
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
                  <InlineChip icon={Package2} text={order.depositante} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <QueueInfo label="Itens" value={`${order.totalItems}`} tone={tone.stat} />
                  <QueueInfo label="Unidades" value={`${order.totalUnits}`} tone={tone.stat} />
                  <QueueInfo label="Concluído" value={`${order.completionPercent}%`} tone={tone.stat} />
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Código interno
                      </p>
                      <p className="truncate text-sm font-medium text-slate-100">{order.code}</p>
                      <p className="mt-1 text-[11px] text-slate-400">Criado em {order.createdAt}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                      Ordem {startIndex + index + 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-300">
                      Toque para abrir o pedido e iniciar a leitura dos itens.
                    </p>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold ${tone.cta}`}
                    >
                      Iniciar
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
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
}: {
  icon: typeof UserRound;
  text: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs text-slate-200">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="truncate">{text}</span>
    </div>
  );
}

function normalizePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePerPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return [10, 20, 50].includes(parsed) ? parsed : 10;
}

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-9 items-center rounded-full border border-white/10 px-3 text-sm font-medium text-slate-500">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/5 px-3 text-sm font-medium text-slate-200"
    >
      {children}
    </Link>
  );
}
