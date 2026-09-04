"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Pause,
  Play,
  Plug,
  RefreshCw,
  RotateCcw,
  Unplug,
  X,
} from "lucide-react";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { PillSelect } from "@/components/ui/pill-select";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import {
  disconnectBlingIntegrationAction,
  disconnectMercadoLivreIntegrationAction,
  reprocessBlingIntegrationAction,
  syncBlingIntegrationAction,
  toggleIntegrationPauseAction,
} from "@/app/(dashboard)/configuracoes/integracoes/actions";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const monoFont = "font-[family-name:var(--font-space-grotesk)]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

export type IntegracaoCard = {
  id: string;
  provider: "BLING" | "ML";
  providerNome: string;
  tipo: string;
  badge: string;
  color: string;
  logoUrl: string;
  depositanteId: string;
  depositanteNome: string;
  depositanteCodigo: string;
  depositanteAtivo: boolean;
  connected: boolean;
  paused: boolean;
  status: "ATIVA" | "ERRO" | "DESCONECTADA" | "PAUSADA";
  statusMessage: string | null;
  lastSyncAt: string | null;
  pedidos: number;
  oauthStartUrl: string;
  callbackUrl: string;
  config: Array<{ label: string; value: string; mono?: boolean }>;
  eventos: Array<{ id: string; titulo: string; descricao: string; createdAt: string; type: LogType }>;
};

type LogType = "success" | "error" | "warning";

export type IntegracaoLog = {
  id: string;
  time: string;
  dateIso: string;
  integ: string;
  depositante: string;
  msg: string;
  type: LogType;
};

type ProviderGroup = {
  provider: "BLING" | "ML";
  providerNome: string;
  tipo: string;
  badge: string;
  color: string;
  logoUrl: string;
  total: number;
  connected: number;
  hasError: boolean;
  totalPedidos: number;
  cards: IntegracaoCard[];
};

function LogoBadge({
  url,
  alt,
  size,
  radius,
}: {
  url: string;
  alt: string;
  size: number;
  radius: number;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden border ${tokenBorder}`}
      style={{ width: size, height: size, borderRadius: 9999 }}
    >
      <Image src={url} alt={alt} width={size} height={size} className="h-full w-full object-cover" />
    </span>
  );
}

function statusStyle(status: IntegracaoCard["status"]) {
  switch (status) {
    case "ATIVA":
      return { bg: "rgba(16,185,129,0.1)", fg: "#10B981", label: "Ativa" };
    case "PAUSADA":
      return { bg: "rgba(245,158,11,0.12)", fg: "#F59E0B", label: "Pausada" };
    case "ERRO":
      return { bg: "rgba(239,68,68,0.1)", fg: "#EF4444", label: "Erro" };
    default:
      return { bg: "rgba(148,163,184,0.14)", fg: "#94A3B8", label: "Desconectada" };
  }
}

function logColor(type: LogType) {
  return type === "success" ? "#10B981" : type === "error" ? "#EF4444" : "#F59E0B";
}

type LogPeriod = "all" | "today" | "7d" | "30d" | "month" | "lastmonth" | "custom";

const DAY_MS = 86400000;

function periodBounds(period: LogPeriod, fromStr: string, toStr: string): { from: number | null; to: number | null } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (period) {
    case "today":
      return { from: startOfToday, to: null };
    case "7d":
      return { from: now.getTime() - 7 * DAY_MS, to: null };
    case "30d":
      return { from: now.getTime() - 30 * DAY_MS, to: null };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: null };
    case "lastmonth":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
        to: new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1,
      };
    case "custom":
      return {
        from: fromStr ? new Date(`${fromStr}T00:00:00`).getTime() : null,
        to: toStr ? new Date(`${toStr}T23:59:59`).getTime() : null,
      };
    default:
      return { from: null, to: null };
  }
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function IntegracoesView({
  cards,
  depositantes,
  logs,
  apiInfo,
  feedback,
}: {
  cards: IntegracaoCard[];
  depositantes: Array<{ id: string; nome: string }>;
  logs: IntegracaoLog[];
  apiInfo: {
    appBaseUrl: string;
    blingCallbackUrl: string;
    blingWebhookUrl: string;
    mercadoLivreCallbackUrl: string;
  };
  feedback: { message: string; success: boolean } | null;
}) {
  const [depSel, setDepSel] = useState("all");
  const [detail, setDetail] = useState<IntegracaoCard | null>(null);
  const [providerView, setProviderView] = useState<"BLING" | "ML" | null>(null);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "error" | "success">("all");
  const [logPeriod, setLogPeriod] = useState<LogPeriod>("all");
  const [logFrom, setLogFrom] = useState("");
  const [logTo, setLogTo] = useState("");
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 10;

  // No filtro "Todos" mostramos apenas as integrações disponíveis no sistema
  // (Bling e Mercado Livre) como cards-resumo; ao escolher um depositante,
  // aparecem os cards específicos dele.
  const providerGroups = useMemo<ProviderGroup[]>(() => {
    const order: Array<"BLING" | "ML"> = ["BLING", "ML"];
    return order
      .map((prov) => {
        const group = cards.filter((c) => c.provider === prov);
        if (!group.length) return null;
        const sample = group[0];
        return {
          provider: prov,
          providerNome: sample.providerNome,
          tipo: sample.tipo,
          badge: sample.badge,
          color: sample.color,
          logoUrl: sample.logoUrl,
          total: group.length,
          connected: group.filter((c) => c.connected).length,
          hasError: group.some((c) => c.status === "ERRO"),
          totalPedidos: group.reduce((t, c) => t + c.pedidos, 0),
          cards: group,
        } satisfies ProviderGroup;
      })
      .filter((g): g is ProviderGroup => g !== null);
  }, [cards]);

  const depositanteCards = useMemo(
    () => cards.filter((c) => c.depositanteId === depSel),
    [cards, depSel],
  );

  const filteredLogs = useMemo(() => {
    const { from, to } = periodBounds(logPeriod, logFrom, logTo);
    return logs.filter((l) => {
      if (logFilter !== "all" && l.type !== logFilter) return false;
      if (from != null || to != null) {
        const ts = new Date(l.dateIso).getTime();
        if (Number.isNaN(ts)) return false;
        if (from != null && ts < from) return false;
        if (to != null && ts > to) return false;
      }
      return true;
    });
  }, [logs, logFilter, logPeriod, logFrom, logTo]);

  const logTotalPages = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage));
  const logCurrentPage = Math.min(logPage, logTotalPages);
  const logStart = (logCurrentPage - 1) * logsPerPage;
  const paginatedLogs = filteredLogs.slice(logStart, logStart + logsPerPage);

  function resetLogPage() {
    setLogPage(1);
  }

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <header
        className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b px-4 sm:px-8 ${tokenBorder}`}
      >
        <Link
          href="/configuracoes"
          title="Voltar para Configurações"
          className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
        >
          <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenText}`} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <h1 className={`${FIN_HEADING} truncate text-[18px] font-bold ${tokenText}`}>Integrações</h1>
          <div className={`flex items-center gap-2 text-[12.5px] ${tokenTextSub}`}>
            <Link href="/configuracoes" className="hover:underline">
              Configurações
            </Link>
            <span>›</span>
            <span className={`font-semibold ${tokenText}`}>Integrações</span>
          </div>
        </div>
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div className="flex-1 space-y-[18px] overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className={`text-sm ${tokenTextSub}`}>
            Conexões ativas por depositante — ERPs, marketplaces e APIs.
          </p>
          <button
            type="button"
            onClick={() => setApiModalOpen(true)}
            title="Informações de API"
            className={`flex h-[42px] w-[42px] items-center justify-center rounded-full border transition hover:border-[#8B5CF6] hover:text-[#8B5CF6] dark:hover:border-[#8B5CF6] dark:hover:text-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenTextSub}`}
          >
            <Info className="h-4 w-4" />
          </button>
        </div>

        {feedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${tokenBorder}`}
            style={
              feedback.success
                ? { background: "rgba(16,185,129,0.1)", color: "#047857" }
                : { background: "rgba(245,158,11,0.1)", color: "#B45309" }
            }
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <PillSelect
            value={depSel}
            onChange={(v) => setDepSel(v)}
            options={[
              { value: "all", label: "Todos os depositantes" },
              ...depositantes.map((dep) => ({ value: dep.id, label: dep.nome })),
            ]}
          />
        </div>

        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
        >
          {depSel === "all" ? (
            providerGroups.length ? (
              providerGroups.map((group) => (
                <AggregateCardItem
                  key={group.provider}
                  group={group}
                  onClick={() => setProviderView(group.provider)}
                />
              ))
            ) : (
              <p className={`text-sm ${tokenTextSub}`}>Nenhum depositante cadastrado ainda.</p>
            )
          ) : depositanteCards.length ? (
            depositanteCards.map((card) => (
              <IntegracaoCardItem key={card.id} card={card} onClick={() => setDetail(card)} />
            ))
          ) : (
            <p className={`text-sm ${tokenTextSub}`}>Nenhuma integração para este depositante.</p>
          )}
        </div>

        <div className={`overflow-hidden rounded-2xl border ${tokenBorder} ${tokenCardBg}`}>
          <div className={`flex flex-wrap items-center gap-3 border-b px-5 py-4 ${tokenBorder}`}>
            <span className={`${FIN_HEADING} text-[16px] font-bold ${tokenText}`}>Logs recentes</span>
            <div className="flex-1" />
            <div className={`flex items-center gap-1 rounded-full border p-1 ${tokenBorder} ${tokenInputBg}`}>
              {(
                [
                  { key: "all", label: "Todas" },
                  { key: "error", label: "Só erros" },
                  { key: "success", label: "Só sucesso" },
                ] as const
              ).map((opt) => {
                const active = logFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setLogFilter(opt.key);
                      resetLogPage();
                    }}
                    className={
                      active
                        ? "transition"
                        : "text-[#64748B] transition hover:bg-white dark:text-zinc-400 dark:hover:bg-white/5"
                    }
                    style={{
                      height: "30px",
                      padding: "0 12px",
                      borderRadius: "999px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                      ...(active ? { background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff" } : {}),
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <PillSelect
              value={logPeriod}
              onChange={(v) => {
                setLogPeriod(v as LogPeriod);
                resetLogPage();
              }}
              options={[
                { value: "all", label: "Todo o período" },
                { value: "today", label: "Hoje" },
                { value: "7d", label: "Últimos 7 dias" },
                { value: "30d", label: "Últimos 30 dias" },
                { value: "month", label: "Este mês" },
                { value: "lastmonth", label: "Mês passado" },
                { value: "custom", label: "Período personalizado" },
              ]}
            />
            {logPeriod === "custom" ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={logFrom}
                  max={logTo || undefined}
                  onChange={(e) => {
                    setLogFrom(e.target.value);
                    resetLogPage();
                  }}
                  className={`h-[36px] rounded-full border px-2.5 text-[12.5px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                />
                <span className={`text-[12.5px] ${tokenTextSub}`}>até</span>
                <input
                  type="date"
                  value={logTo}
                  min={logFrom || undefined}
                  onChange={(e) => {
                    setLogTo(e.target.value);
                    resetLogPage();
                  }}
                  className={`h-[36px] rounded-full border px-2.5 text-[12.5px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                />
              </div>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "760px" }}>
              <thead>
                <tr className={`border-b ${tokenBorder} ${tokenInputBg}`}>
                  <Th>Horário</Th>
                  <Th>Integração</Th>
                  <Th>Depositante</Th>
                  <Th>Mensagem</Th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.length ? (
                  paginatedLogs.map((log) => (
                    <tr key={log.id} className={`border-t ${tokenBorder}`}>
                      <td
                        className={`${monoFont} ${tokenTextSub}`}
                        style={{ padding: "10px 16px", fontSize: "12px", whiteSpace: "nowrap" }}
                      >
                        {log.time}
                      </td>
                      <td
                        className={tokenText}
                        style={{ padding: "10px 16px", fontWeight: 600, whiteSpace: "nowrap", fontSize: "13px" }}
                      >
                        {log.integ}
                      </td>
                      <td className={tokenTextSub} style={{ padding: "10px 16px", whiteSpace: "nowrap", fontSize: "13px" }}>
                        {log.depositante}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              width: "7px",
                              height: "7px",
                              borderRadius: "50%",
                              background: logColor(log.type),
                              flexShrink: 0,
                            }}
                          />
                          <span className={`text-[13px] ${tokenText}`}>{log.msg}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className={`px-5 py-10 text-center text-sm ${tokenTextSub}`}>
                      Nenhum log registrado para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredLogs.length ? (
            <div className={`flex items-center justify-between border-t px-5 py-3 ${tokenBorder}`}>
              <span className={`text-[12.5px] ${tokenTextSub}`}>
                {logStart + 1}–{Math.min(logStart + logsPerPage, filteredLogs.length)} de{" "}
                {filteredLogs.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={logCurrentPage <= 1}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className={`text-[12.5px] font-semibold ${tokenText}`}>
                  {logCurrentPage} / {logTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))}
                  disabled={logCurrentPage >= logTotalPages}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {providerView ? (
        <ProviderOverviewDrawer
          group={providerGroups.find((g) => g.provider === providerView) ?? null}
          onSelect={(card) => {
            setProviderView(null);
            setDetail(card);
          }}
          onClose={() => setProviderView(null)}
        />
      ) : null}
      {detail ? <IntegracaoDrawer card={detail} onClose={() => setDetail(null)} /> : null}
      {apiModalOpen ? <ApiInfoModal apiInfo={apiInfo} onClose={() => setApiModalOpen(false)} /> : null}
    </div>
  );
}

function IntegracaoCardItem({ card, onClick }: { card: IntegracaoCard; onClick: () => void }) {
  const st = statusStyle(card.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-[14px] border text-left transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenCardBg}`}
      style={{ padding: "18px 20px" }}
    >
      <div className="flex items-center gap-3">
        <LogoBadge url={card.logoUrl} alt={card.providerNome} size={40} radius={10} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[15px] font-bold ${tokenText}`}>{card.providerNome}</div>
          <div className={`mt-[1px] truncate text-[12px] ${tokenTextSub}`}>
            {card.tipo} · {card.depositanteNome}
          </div>
        </div>
        <span
          className="flex shrink-0 items-center gap-[5px] rounded-full px-2.5 py-[3px] text-[11px] font-bold"
          style={{ background: st.bg, color: st.fg }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: st.fg }} />
          {st.label}
        </span>
      </div>
      <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[12px] ${tokenTextSub}`}>
        <span>Última sync: {card.connected ? relativeTime(card.lastSyncAt) : "—"}</span>
        <span>{card.pedidos} pedidos</span>
      </div>
      {card.status === "ERRO" && card.statusMessage ? (
        <div
          className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold"
          style={{ background: "rgba(239,68,68,0.08)", color: "#DC2626" }}
        >
          ⚠ {card.statusMessage}
        </div>
      ) : null}
    </button>
  );
}

function AggregateCardItem({ group, onClick }: { group: ProviderGroup; onClick: () => void }) {
  const pill = group.hasError
    ? { bg: "rgba(239,68,68,0.1)", fg: "#EF4444", label: "Erro" }
    : group.connected > 0
      ? {
          bg: "rgba(16,185,129,0.1)",
          fg: "#10B981",
          label: `${group.connected} conectada${group.connected > 1 ? "s" : ""}`,
        }
      : { bg: "rgba(148,163,184,0.14)", fg: "#94A3B8", label: "Sem conexão" };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-[14px] border text-left transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenCardBg}`}
      style={{ padding: "18px 20px" }}
    >
      <div className="flex items-center gap-3">
        <LogoBadge url={group.logoUrl} alt={group.providerNome} size={40} radius={10} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[15px] font-bold ${tokenText}`}>{group.providerNome}</div>
          <div className={`mt-[1px] truncate text-[12px] ${tokenTextSub}`}>{group.tipo}</div>
        </div>
        <span
          className="flex shrink-0 items-center gap-[5px] rounded-full px-2.5 py-[3px] text-[11px] font-bold"
          style={{ background: pill.bg, color: pill.fg }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: pill.fg }} />
          {pill.label}
        </span>
      </div>
      <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[12px] ${tokenTextSub}`}>
        <span>
          {group.connected} de {group.total} depositante{group.total > 1 ? "s" : ""}
        </span>
        <span>{group.totalPedidos} pedidos</span>
      </div>
    </button>
  );
}

function ProviderOverviewDrawer({
  group,
  onSelect,
  onClose,
}: {
  group: ProviderGroup | null;
  onSelect: (card: IntegracaoCard) => void;
  onClose: () => void;
}) {
  if (!group) return null;

  return (
    <div className="fixed inset-0 z-40" style={manropeStyle}>
      <div className="absolute inset-0 bg-[rgba(6,10,20,0.45)] backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[440px] max-w-[92vw] flex-col border-l bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:bg-[#0C1424] ${tokenBorder}`}
      >
        <div className={`flex items-center gap-3 border-b px-6 pb-4 pt-[22px] ${tokenBorder}`}>
          <LogoBadge url={group.logoUrl} alt={group.providerNome} size={40} radius={10} />
          <div className="min-w-0 flex-1">
            <div className={`text-[18px] font-bold ${tokenText}`}>{group.providerNome}</div>
            <div className={`text-[12.5px] ${tokenTextSub}`}>
              {group.tipo} · {group.connected} de {group.total} conectado{group.connected === 1 ? "" : "s"}
            </div>
          </div>
          <button
            type="button"
            title="Fechar"
            onClick={onClose}
            className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-3">
          <SectionLabel>Depositantes</SectionLabel>
          <div className="flex flex-col gap-0.5">
            {group.cards.map((card) => {
              const st = statusStyle(card.status);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelect(card)}
                  className="group -mx-3 flex items-center gap-3 rounded-full border border-transparent px-3 py-[11px] text-left transition-all hover:border-[rgba(139,92,246,0.28)] hover:bg-[rgba(139,92,246,0.06)] hover:shadow-[0_2px_10px_rgba(139,92,246,0.08)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[13.5px] font-bold ${tokenText}`}>{card.depositanteNome}</div>
                    <div className={`${monoFont} mt-0.5 truncate text-[11.5px] ${tokenTextSub}`}>
                      {card.depositanteCodigo}
                    </div>
                  </div>
                  <span
                    className="flex shrink-0 items-center gap-[5px] rounded-full px-2.5 py-[3px] text-[11px] font-bold"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: st.fg }} />
                    {st.label}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5 group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenTextSub}`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

function IntegracaoDrawer({ card, onClose }: { card: IntegracaoCard; onClose: () => void }) {
  const st = statusStyle(card.status);

  return (
    <div className="fixed inset-0 z-40" style={manropeStyle}>
      <div className="absolute inset-0 bg-[rgba(6,10,20,0.45)] backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[440px] max-w-[92vw] flex-col border-l bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:bg-[#0C1424] ${tokenBorder}`}
      >
        <div className={`border-b px-6 pb-4 pt-[22px] ${tokenBorder}`}>
          <div className="mb-2.5 flex items-center gap-2">
            <LogoBadge url={card.logoUrl} alt={card.providerNome} size={36} radius={9} />
            <div className="flex-1" />
            <span
              className="flex items-center gap-[5px] rounded-full px-2.5 py-[3px] text-[11px] font-bold"
              style={{ background: st.bg, color: st.fg }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: st.fg }} />
              {st.label}
            </span>
            <button
              type="button"
              title="Fechar"
              onClick={onClose}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`text-[22px] font-bold ${tokenText}`}>{card.providerNome}</div>
          <div className={`mt-0.5 text-[13px] ${tokenTextSub}`}>
            {card.tipo} · {card.depositanteNome} · {card.depositanteCodigo}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-3">
          <SectionLabel>Configuração</SectionLabel>
          {card.config.map((kv) => (
            <div
              key={kv.label}
              className={`flex items-center justify-between gap-3 border-b py-[9px] text-[13.5px] ${tokenBorder}`}
            >
              <span className={tokenTextSub}>{kv.label}</span>
              <span
                className={`text-right font-semibold ${kv.mono ? `${monoFont} text-[12px] break-all` : ""} ${tokenText}`}
              >
                {kv.value}
              </span>
            </div>
          ))}

          {card.status === "ERRO" && card.statusMessage ? (
            <div
              className="mt-3 rounded-[10px] border px-3 py-2.5 text-[12.5px] font-semibold"
              style={{
                background: "rgba(239,68,68,0.08)",
                borderColor: "rgba(239,68,68,0.2)",
                color: "#DC2626",
              }}
            >
              ⚠ {card.statusMessage}
            </div>
          ) : null}

          <div className="mt-5">
            <SectionLabel>Logs recentes</SectionLabel>
            {card.eventos.length ? (
              card.eventos.map((ev) => (
                <div key={ev.id} className={`flex gap-2 border-b py-2 ${tokenBorder}`}>
                  <span
                    className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: logColor(ev.type) }}
                  />
                  <div className="min-w-0">
                    <div className={`text-[12.5px] font-semibold ${tokenText}`}>{ev.titulo}</div>
                    {ev.descricao ? (
                      <div className={`mt-0.5 line-clamp-2 text-[12px] ${tokenTextSub}`}>{ev.descricao}</div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className={`text-[12.5px] italic ${tokenTextSub}`}>Sem logs recentes.</p>
            )}
          </div>
        </div>

        <div className={`border-t px-6 py-3.5 ${tokenBorder}`}>
          {card.connected ? (
            card.provider === "BLING" ? (
              <div className="grid grid-cols-2 gap-2">
                <PauseButton card={card} />
                <ActionButton action={syncBlingIntegrationAction} depositanteId={card.depositanteId} variant="solid" icon={<RefreshCw className="h-4 w-4" />}>
                  Sincronizar
                </ActionButton>
                <ActionButton action={reprocessBlingIntegrationAction} depositanteId={card.depositanteId} variant="neutral" icon={<RotateCcw className="h-4 w-4" />}>
                  Reprocessar
                </ActionButton>
                <GradientLink href={card.oauthStartUrl}>
                  <Plug className="h-4 w-4" />
                  Reconectar
                </GradientLink>
                <div className="col-span-2">
                  <ActionButton action={disconnectBlingIntegrationAction} depositanteId={card.depositanteId} variant="danger" icon={<Unplug className="h-4 w-4" />}>
                    Desconectar
                  </ActionButton>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <PauseButton card={card} />
                <GradientLink href={card.oauthStartUrl}>
                  <Plug className="h-4 w-4" />
                  Reconectar
                </GradientLink>
                <div className="col-span-2">
                  <ActionButton action={disconnectMercadoLivreIntegrationAction} depositanteId={card.depositanteId} variant="danger" icon={<Unplug className="h-4 w-4" />}>
                    Desconectar
                  </ActionButton>
                </div>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <GradientLink href={card.oauthStartUrl}>
                <Plug className="h-4 w-4" />
                Conectar
              </GradientLink>
              <PauseButton card={card} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function GradientLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <>
      <a
        href={href}
        className="integracao-connect-btn flex h-10 items-center justify-center gap-[7px] rounded-full text-[13px] font-extrabold"
        style={{ color: "#FFFFFF" }}
      >
        {children}
      </a>
      <style jsx>{`
        .integracao-connect-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
          background-size: 220% 100%;
          background-position: 0% 50%;
          box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
          transition:
            background-position 0.6s ease,
            transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.3s ease;
        }
        .integracao-connect-btn:hover {
          background-position: 100% 50%;
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
        }
      `}</style>
    </>
  );
}

function PauseButton({ card }: { card: IntegracaoCard }) {
  if (!card.connected) {
    return (
      <button
        type="button"
        disabled
        title="Conecte a integração antes de pausar"
        className={`flex h-10 cursor-not-allowed items-center justify-center gap-[7px] rounded-full border text-[13px] font-bold opacity-50 ${tokenBorder} ${tokenInputBg} ${tokenTextSub}`}
      >
        <Pause className="h-4 w-4" />
        Pausar
      </button>
    );
  }
  return (
    <form action={toggleIntegrationPauseAction}>
      <input type="hidden" name="depositanteId" value={card.depositanteId} />
      <input type="hidden" name="provider" value={card.provider === "BLING" ? "bling" : "ml"} />
      <PauseSubmit paused={card.paused} />
    </form>
  );
}

function PauseSubmit({ paused }: { paused: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 w-full items-center justify-center gap-[7px] rounded-full text-[13px] font-bold transition-all hover:brightness-[1.06] disabled:opacity-70"
      style={paused ? { background: "rgba(16,185,129,0.16)", color: "#10B981" } : { background: "#F59E0B", color: "#422006" }}
    >
      {pending ? (
        <MobileButtonSpinner size={18} />
      ) : paused ? (
        <>
          <Play className="h-4 w-4" />
          Retomar
        </>
      ) : (
        <>
          <Pause className="h-4 w-4" />
          Pausar
        </>
      )}
    </button>
  );
}

function ActionButton({
  action,
  depositanteId,
  variant,
  icon,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  depositanteId: string;
  variant: "solid" | "neutral" | "danger";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="depositanteId" value={depositanteId} />
      <ActionSubmit variant={variant} icon={icon}>
        {children}
      </ActionSubmit>
    </form>
  );
}

function ActionSubmit({
  variant,
  icon,
  children,
}: {
  variant: "solid" | "neutral" | "danger";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  const base =
    "flex h-10 w-full items-center justify-center gap-[7px] rounded-full text-[13px] font-bold transition-all disabled:opacity-70";
  const variantClass =
    variant === "solid"
      ? "integracao-action-solid-btn text-white"
      : variant === "danger"
        ? "border border-[rgba(239,68,68,0.35)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]"
        : `border ${tokenBorder} ${tokenInputBg} ${tokenText} hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`;

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className={`${base} ${variantClass}`}
      >
        {pending ? <MobileButtonSpinner size={18} /> : (
          <>
            {icon}
            {children}
          </>
        )}
      </button>
      <style jsx>{`
        .integracao-action-solid-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
          background-size: 220% 100%;
          background-position: 0% 50%;
          box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
          transition:
            background-position 0.6s ease,
            transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.3s ease;
        }
        .integracao-action-solid-btn:hover:not(:disabled) {
          background-position: 100% 50%;
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
        }
      `}</style>
    </>
  );
}

function ApiInfoModal({
  apiInfo,
  onClose,
}: {
  apiInfo: {
    appBaseUrl: string;
    blingCallbackUrl: string;
    blingWebhookUrl: string;
    mercadoLivreCallbackUrl: string;
  };
  onClose: () => void;
}) {
  const blocks = [
    {
      title: "Bling V3",
      color: "#2563EB",
      urls: [
        { label: "Base da aplicação", value: apiInfo.appBaseUrl },
        { label: "Callback OAuth2", value: apiInfo.blingCallbackUrl },
        { label: "Webhook de pedidos", value: apiInfo.blingWebhookUrl },
      ],
      checklist: [
        "Criar o aplicativo no portal de developers do Bling.",
        "Configurar o callback exatamente como exibido acima.",
        "Liberar o escopo `order` no aplicativo.",
        "Registrar o webhook de pedido de venda apontando para a URL acima.",
        "Conectar o depositante correto nesta tela.",
      ],
      note: null as string | null,
    },
    {
      title: "Mercado Livre",
      color: "#F59E0B",
      urls: [
        { label: "Base da aplicação", value: apiInfo.appBaseUrl },
        { label: "Callback OAuth2", value: apiInfo.mercadoLivreCallbackUrl },
      ],
      checklist: [
        "Criar o aplicativo no Mercado Livre Developers.",
        "Configurar o callback exatamente como exibido acima.",
        "Autorizar a conta correta do seller por depositante.",
        "Informar o `shipment_id` do pedido quando a venda for Mercado Livre.",
        "O WMS passa a buscar etiqueta e rastreamento automaticamente.",
      ],
      note: "Nesta etapa, o foco é a operação de expedição: etiquetas de envio e código de rastreio. Funciona para pedidos integrados e para pedidos cadastrados manualmente, desde que o `shipment_id` esteja informado.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center p-6" style={manropeStyle}>
      <div className="absolute inset-0 bg-[rgba(3,7,20,0.5)] backdrop-blur-[5px]" onClick={onClose} />
      <div
        className={`relative flex max-h-[90vh] w-[560px] max-w-[94vw] flex-col overflow-hidden rounded-[16px] border ${tokenBorder} ${tokenCardBg} shadow-[0_30px_60px_rgba(0,0,0,0.35)]`}
      >
        <div className={`flex items-start justify-between gap-3 border-b px-6 py-5 ${tokenBorder}`}>
          <div className="flex flex-col gap-1">
            <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${tokenTextSub}`}>
              Informações de API
            </span>
            <span className={`${FIN_HEADING} text-[20px] font-bold ${tokenText}`}>
              Configuração das integrações
            </span>
            <span className={`text-[13px] ${tokenTextSub}`}>
              URLs de callback e checklist para conectar cada provedor.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
          {blocks.map((block) => (
            <div key={block.title} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: block.color }} />
                <span className={`${FIN_HEADING} text-[16px] font-bold ${tokenText}`}>{block.title}</span>
              </div>
              {block.urls.map((u) => (
                <div key={u.label} className={`rounded-[10px] border px-4 py-3 ${tokenBorder} ${tokenInputBg}`}>
                  <div
                    className="text-[10.5px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: "#6B7FA3" }}
                  >
                    {u.label}
                  </div>
                  <div className={`${monoFont} mt-1 break-all text-[12.5px] ${tokenText}`}>{u.value}</div>
                </div>
              ))}
              <div className={`rounded-[10px] border px-4 py-3 ${tokenBorder} ${tokenInputBg}`}>
                <div className={`text-[13.5px] font-bold ${tokenText}`}>Checklist</div>
                <ol className={`mt-2 flex list-decimal flex-col gap-1.5 pl-4 text-[12.5px] ${tokenTextSub}`}>
                  {block.checklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              </div>
              {block.note ? (
                <div
                  className="rounded-[10px] border px-4 py-3 text-[12.5px]"
                  style={{
                    background: "rgba(59,130,246,0.08)",
                    borderColor: "rgba(59,130,246,0.2)",
                    color: "#1D4ED8",
                  }}
                >
                  {block.note}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mb-2 mt-1 text-[12px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}>
      {children}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      className={tokenTextSub}
      style={{
        padding: "10px 16px",
        textAlign: "left",
        fontWeight: 700,
        fontSize: "10.5px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}
