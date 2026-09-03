"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPinPlus, Plus, Search, X } from "lucide-react";
import { RECEIVING_DOCK_OPTIONS } from "@/lib/receiving-constants";
import type { ReceivingOrderSummary } from "@/lib/receiving";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};
const groteskStyle: React.CSSProperties = {
  fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
};
// Mesma convenção do NF-e: JetBrains Mono para códigos/protocolos/NF.
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

export type ReceivingTab = "agendados" | "conferencia" | "concluidos";

const TAB_LABELS: Record<ReceivingTab, string> = {
  agendados: "Agendados",
  conferencia: "Em conferência",
  concluidos: "Concluídos",
};

// Rótulo e cor de exibição por status real — independente da aba (ex.: um
// pedido com DIVERGENCIA aparece na aba "Em conferência", mas com seu próprio
// badge vermelho).
function statusDisplay(status: string): { label: string; color: string } {
  switch (status) {
    case "AGUARDANDO":
      return { label: "Agendado", color: "#3B82F6" };
    case "EM_RECEBIMENTO":
      return { label: "Em conferência", color: "#F59E0B" };
    case "DIVERGENCIA":
    case "QUARENTENA_CORRIGIDA":
      return { label: "Divergência", color: "#EF4444" };
    case "RECEBIDO":
      return { label: "Concluído", color: "#10B981" };
    case "RECEBIDO_PARCIAL":
      return { label: "Recebido parcial", color: "#10B981" };
    case "CANCELADO":
      return { label: "Cancelado", color: "#94A3B8" };
    case "RASCUNHO":
      return { label: "Rascunho", color: "#94A3B8" };
    default:
      return { label: status, color: "#94A3B8" };
  }
}

function drawerCta(status: string): string {
  if (status === "AGUARDANDO") return "Iniciar conferência";
  if (status === "EM_RECEBIMENTO") return "Continuar conferência";
  if (status === "DIVERGENCIA" || status === "QUARENTENA_CORRIGIDA") return "Resolver divergência";
  return "Ver detalhes";
}

type Kpis = {
  agendadosHoje: number;
  emConferencia: number;
  comDivergencia: number;
  itensRecebidosMes: number;
};

export function ReceivingView({
  orders,
  depositanteOptions,
  showDepositanteFilter,
  tab,
  tabCounts,
  search,
  depositanteFilter,
  kpis,
  page,
  totalPages,
  totalOrders,
  perPage,
  assignDockAction,
}: {
  orders: ReceivingOrderSummary[];
  depositanteOptions: { id: string; nome: string }[];
  showDepositanteFilter: boolean;
  tab: ReceivingTab;
  tabCounts: Record<ReceivingTab, number>;
  search: string;
  depositanteFilter: string;
  kpis: Kpis;
  page: number;
  totalPages: number;
  totalOrders: number;
  perPage: number;
  assignDockAction: (
    orderId: string,
    doca: string,
  ) => Promise<{ error?: string; success?: boolean }>;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = orders.find((o) => o.id === activeId) ?? null;
  const [dockPopupFor, setDockPopupFor] = useState<string | null>(null);
  const [dockError, setDockError] = useState<string | null>(null);
  const [isAssigningDock, startAssignDock] = useTransition();

  const handleAssignDock = (orderId: string, doca: string) => {
    setDockError(null);
    startAssignDock(async () => {
      const result = await assignDockAction(orderId, doca);
      if (result.error) {
        setDockError(result.error);
        return;
      }
      setDockPopupFor(null);
      router.refresh();
    });
  };

  const preservedQuery = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { tab, depositante: depositanteFilter, q: search, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return params.toString();
  };

  const kpiCards: Array<{ label: string; value: number; color: string }> = [
    { label: "Agendados hoje", value: kpis.agendadosHoje, color: "#3B82F6" },
    { label: "Em conferência", value: kpis.emConferencia, color: "#F59E0B" },
    { label: "Com divergência", value: kpis.comDivergencia, color: "#EF4444" },
    { label: "Itens recebidos (mês)", value: kpis.itensRecebidosMes, color: "" },
  ];

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <style>{`@keyframes recDrawerIn{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}`}</style>

      {/* Cabeçalho (padrão rebranding: título + sino + tema) */}
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <span
          className="rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100"
          style={groteskStyle}
        >
          Recebimento
        </span>
        <div className="flex-1" />
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-3 sm:px-8 lg:pb-12">
        {/* Título + ação */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <p className={`m-0 text-[14.5px] ${tokenTextSub}`}>
            Agendamentos, conferência, endereçamento e histórico.
          </p>
          <Link
            href="/recebimento/novo"
            className="flex h-[42px] items-center gap-2 rounded-[11px] px-5 text-[14px] font-extrabold transition hover:brightness-105"
            style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#FFFFFF" }}
          >
            <Plus className="h-4 w-4" />
            Agendar recebimento
          </Link>
        </div>

        {/* KPIs — mesma altura da Quarentena (rótulo com altura fixa, pra não
            variar o tamanho do card conforme o texto quebra linha ou não) */}
        <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {kpiCards.map((k) => (
            <div
              key={k.label}
              className={`flex flex-col gap-3 rounded-2xl border p-5 ${tokenBorder} ${tokenCardBg}`}
            >
              <span
                className={`flex h-[34px] items-center text-[10px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}
              >
                {k.label}
              </span>
              <span
                className="text-[30px] font-bold"
                style={{ ...groteskStyle, color: k.color || undefined }}
              >
                {k.value.toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
        </div>

        {/* Abas de status — pílula com contador em chip próprio (padrão Infinoos Help) */}
        <div className="mb-3 flex justify-center">
          <div className={`inline-flex flex-wrap items-center gap-1 rounded-full p-1 ${tokenBorder} ${tokenCardBg} border`}>
            {(Object.keys(TAB_LABELS) as ReceivingTab[]).map((key) => {
              const isActive = tab === key;
              return (
                <Link
                  key={key}
                  href={`/recebimento?${preservedQuery({ tab: key, page: "1" })}`}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-3.5 pr-2.5 text-[12.5px] font-semibold transition ${
                    isActive ? "" : `${tokenTextSub} hover:bg-slate-50 dark:hover:bg-white/5`
                  }`}
                  style={
                    isActive
                      ? { background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#FFFFFF" }
                      : undefined
                  }
                >
                  <span>{TAB_LABELS[key]}</span>
                  <span
                    className={`grid h-[19px] min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
                      isActive ? "" : tokenInputBg
                    }`}
                    style={isActive ? { background: "rgba(255,255,255,0.24)", color: "#FFFFFF" } : undefined}
                  >
                    {tabCounts[key]}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Busca + depositante */}
        <form method="get" action="/recebimento" className="mb-3 flex flex-wrap items-center gap-2.5">
          <input type="hidden" name="tab" value={tab} />
          <div
            className={`flex h-[42px] flex-1 items-center gap-2.5 rounded-[11px] border px-4 ${tokenBorder} ${tokenCardBg}`}
            style={{ minWidth: 220 }}
          >
            <Search className={`h-[15px] w-[15px] ${tokenTextSub}`} />
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Buscar NF, fornecedor, depositante..."
              className={`w-full border-none bg-transparent text-[14px] outline-none ${tokenText}`}
            />
          </div>
          {showDepositanteFilter ? (
            <select
              name="depositante"
              defaultValue={depositanteFilter}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={`h-[42px] rounded-[11px] border px-3 text-[13.5px] font-semibold outline-none ${tokenBorder} ${tokenCardBg} ${tokenText}`}
            >
              <option value="">Todos depositantes</option>
              {depositanteOptions.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.nome}
                </option>
              ))}
            </select>
          ) : null}
        </form>

        {/* Tabela */}
        <div className={`overflow-hidden rounded-t-2xl border border-b-0 ${tokenBorder} ${tokenCardBg}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead className={tokenInputBg}>
                <tr>
                  {["ID", "NF", "Fornecedor", "Itens", "Doca", "Previsão", "Status", ""].map((h) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const st = statusDisplay(order.status);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setActiveId(order.id)}
                      className={`cursor-pointer border-t transition hover:bg-[rgba(139,92,246,0.06)] ${tokenBorder} ${
                        activeId === order.id ? "bg-[rgba(139,92,246,0.08)]" : ""
                      }`}
                    >
                      <td className={`whitespace-nowrap px-4 py-3 text-[12px] font-bold ${tokenText} ${MONO}`}>
                        {order.code}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-[12px] ${tokenTextSub} ${MONO}`}>
                        {order.noteNumber !== "-" ? `NF ${order.noteNumber}` : "-"}
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <div className={`truncate text-[13.5px] font-semibold ${tokenText}`}>{order.supplier}</div>
                        <div className={`truncate text-[11.5px] ${tokenTextSub}`}>{order.depositante}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className={`text-[13px] font-bold ${tokenText} ${MONO}`}>
                          {order.volumeCount}
                        </div>
                        <div className={`text-[10.5px] ${tokenTextSub}`}>{order.skuCount} SKUs</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        {order.dock !== "—" ? (
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${MONO}`}
                            style={{ background: "rgba(139,92,246,0.14)", color: "#8B5CF6" }}
                          >
                            {order.dock}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDockError(null);
                              setDockPopupFor(order.id);
                            }}
                            className={`inline-flex items-center gap-1 rounded-lg border border-dashed px-2 py-1 text-[11px] font-bold transition hover:brightness-105 ${tokenBorder} ${tokenTextSub}`}
                          >
                            <MapPinPlus className="h-3 w-3" />
                            Atribuir
                          </button>
                        )}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 text-[12.5px] ${tokenText}`}>{order.eta}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                          style={{ background: `${st.color}1a`, color: st.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                          {st.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right text-[13px] ${tokenTextSub}`}>›</td>
                    </tr>
                  );
                })}
                {!orders.length ? (
                  <tr>
                    <td colSpan={8} className={`py-12 text-center ${tokenTextSub}`}>
                      Nenhum recebimento nesta etapa.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className={`flex flex-wrap items-center gap-3.5 border-t px-5 py-2.5 text-[12px] ${tokenBorder} ${tokenTextSub}`}>
            <span>
              {totalOrders ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, totalOrders)} de {totalOrders}
            </span>
            <div className="flex-1" />
            <Link
              href={`/recebimento?${preservedQuery({ page: String(Math.max(1, page - 1)) })}`}
              aria-disabled={page <= 1}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border ${tokenBorder} ${
                page <= 1 ? "pointer-events-none opacity-40" : "hover:brightness-105"
              }`}
            >
              ‹
            </Link>
            <span>
              {page} / {totalPages}
            </span>
            <Link
              href={`/recebimento?${preservedQuery({ page: String(Math.min(totalPages, page + 1)) })}`}
              aria-disabled={page >= totalPages}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border ${tokenBorder} ${
                page >= totalPages ? "pointer-events-none opacity-40" : "hover:brightness-105"
              }`}
            >
              ›
            </Link>
          </div>
        </div>
      </div>

      {active ? (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-[rgba(3,7,20,0.4)]"
            onClick={() => setActiveId(null)}
          />
          <aside
            className={`absolute inset-y-0 right-0 flex w-[480px] max-w-[92vw] flex-col border-l shadow-[-24px_0_60px_rgba(0,0,0,0.35)] ${tokenBorder} bg-white dark:bg-[#0C1526]`}
            style={{ animation: "recDrawerIn .22s ease-out" }}
          >
            <div className={`border-b px-6 pb-4 pt-[22px] ${tokenBorder}`}>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                {(() => {
                  const st = statusDisplay(active.status);
                  return (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                      style={{ background: `${st.color}1a`, color: st.color }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                      {st.label}
                    </span>
                  );
                })()}
                {active.dock !== "—" ? (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-bold ${MONO}`}
                    style={{ background: "rgba(139,92,246,0.14)", color: "#8B5CF6" }}
                  >
                    Doca {active.dock}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDockError(null);
                      setDockPopupFor(active.id);
                    }}
                    className={`inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11.5px] font-bold transition hover:brightness-105 ${tokenBorder} ${tokenTextSub}`}
                  >
                    <MapPinPlus className="h-3 w-3" />
                    Atribuir doca
                  </button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border transition ${tokenBorder} ${tokenTextSub} hover:border-[#EF4444] hover:text-[#EF4444]`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className={`text-[18px] font-bold ${tokenText} ${MONO}`}>
                {active.code}
              </div>
              <div className={`mt-1 text-[14px] font-semibold ${tokenText}`}>{active.supplier}</div>
              <div className={`mt-0.5 text-[12.5px] ${tokenTextSub}`}>
                {active.noteNumber !== "-" ? `NF ${active.noteNumber} · ` : ""}
                {active.depositante}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {[
                ["Previsão", active.eta],
                ["Chegada real", active.arrivedAt ?? "—"],
                ["Criado em", active.createdAt],
                ["Itens previstos", String(active.volumeCount)],
                ["SKUs", String(active.skuCount)],
                ["Transportadora", active.carrier],
                ["Responsável", active.handledBy],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className={`flex items-center justify-between gap-3 border-b py-2.5 text-[13.5px] ${tokenBorder}`}
                >
                  <span className={tokenTextSub}>{label}</span>
                  <span className={`font-semibold ${tokenText}`}>{value || "—"}</span>
                </div>
              ))}

              <div className="mt-4">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#8B5CF6]">
                  Produtos ({active.products.length} SKUs)
                </div>
                {active.products.length ? (
                  <div className="flex flex-col gap-2">
                    {active.products.map((p, i) => (
                      <div
                        key={`${p.sku}-${i}`}
                        className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 ${tokenBorder} ${tokenInputBg}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-[13px] font-semibold ${tokenText}`}>{p.nome}</div>
                          <div className={`truncate text-[11px] ${tokenTextSub} ${MONO}`}>
                            {p.sku}
                          </div>
                        </div>
                        <div className={`whitespace-nowrap text-[15px] font-extrabold ${tokenText} ${MONO}`}>
                          {p.qty.toLocaleString("pt-BR")}
                        </div>
                        <span className={`text-[11px] ${tokenTextSub}`}>un</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`text-[12.5px] italic ${tokenTextSub}`}>—</div>
                )}
              </div>
            </div>

            <div className={`border-t px-6 py-3.5 ${tokenBorder}`}>
              <Link
                href={`/recebimento/${active.id}`}
                className="flex h-[42px] items-center justify-center rounded-[11px] text-[13.5px] font-extrabold transition hover:brightness-105"
                style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#FFFFFF" }}
              >
                {drawerCta(active.status)}
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      {dockPopupFor ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[rgba(3,7,20,0.5)] backdrop-blur-[2px]"
            onClick={() => (isAssigningDock ? null : setDockPopupFor(null))}
          />
          <div
            className={`relative w-[320px] max-w-[92vw] rounded-2xl border shadow-[0_24px_60px_rgba(0,0,0,0.35)] ${tokenBorder} bg-white dark:bg-[#0C1526]`}
          >
            <div className={`flex items-center justify-between border-b px-5 py-3.5 ${tokenBorder}`}>
              <span className={`text-[14px] font-bold ${tokenText}`}>Atribuir doca</span>
              <button
                type="button"
                onClick={() => setDockPopupFor(null)}
                disabled={isAssigningDock}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${tokenBorder} ${tokenTextSub} hover:border-[#EF4444] hover:text-[#EF4444]`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-2 px-5 py-4">
              {RECEIVING_DOCK_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isAssigningDock}
                  onClick={() => handleAssignDock(dockPopupFor, option)}
                  className={`flex h-[42px] items-center justify-center gap-2 rounded-[11px] border text-[13.5px] font-bold transition hover:brightness-105 disabled:opacity-60 ${tokenBorder} ${tokenInputBg} ${tokenText} ${MONO}`}
                >
                  {isAssigningDock ? <MobileButtonSpinner size={18} /> : option}
                </button>
              ))}
              {dockError ? <p className="text-[12px] font-semibold text-[#EF4444]">{dockError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
