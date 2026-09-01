"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Paperclip, RotateCcw, Search, Send, X } from "lucide-react";
import type { SupportTicket } from "@/lib/support";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import { HelpEmbed } from "@/components/support/help-embed";
import { useSupportUnreadCounts } from "@/components/support/use-support-notifications";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const monoFont = "font-[family-name:var(--font-jetbrains-mono)]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

type Ticket = SupportTicket;
type Anexo = { url: string; nome: string; tipo: string };

// Dropdown customizado — mesmo padrão do Infinoos Help (pílula, seta que
// gira, painel com check na opção ativa), substitui o <select> nativo.
function PillSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-[42px] min-w-[170px] cursor-pointer items-center justify-between gap-2 rounded-full border px-4 text-[13.5px] font-semibold outline-none transition-colors ${tokenBorder} ${tokenCardBg} ${tokenText}`}
        style={open ? { borderColor: "#5AA7FF", boxShadow: "0 0 0 3px rgba(90,167,255,.15)" } : undefined}
      >
        <span>{current ? current.label : "Selecione..."}</span>
        <ChevronDown
          size={15}
          className={tokenTextSub}
          style={{ transition: "transform .18s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-20 mt-1.5 rounded-xl border py-1.5 ${tokenBorder} ${tokenCardBg}`}
          style={{ boxShadow: "0 16px 36px rgba(3,7,18,.15)" }}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${active ? "" : tokenText}`}
                style={active ? { color: "#5AA7FF", background: "rgba(90,167,255,.1)" } : undefined}
              >
                <span>{o.label}</span>
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STATUS = ["Aberto", "Em análise", "Resolvido"] as const;
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Crítica"] as const;

function statusStyle(status: string) {
  if (status === "Resolvido") return { bg: "rgba(16,185,129,0.1)", fg: "#10B981" };
  if (status === "Em análise") return { bg: "rgba(245,158,11,0.12)", fg: "#F59E0B" };
  return { bg: "rgba(59,130,246,0.1)", fg: "#3B82F6" }; // Aberto
}

function prioStyle(p: string) {
  if (p === "Crítica") return { bg: "rgba(239,68,68,0.1)", fg: "#EF4444" };
  if (p === "Alta") return { bg: "rgba(245,158,11,0.1)", fg: "#F59E0B" };
  if (p === "Baixa") return { bg: "rgba(148,163,184,0.16)", fg: "#94A3B8" };
  return { bg: "rgba(59,130,246,0.1)", fg: "#3B82F6" }; // Normal
}

function formatCriado(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatDur(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h}h ${rest}min` : `${h}h`;
}

export function SupportView() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"depositantes" | "help">("depositantes");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { counts, markRead } = useSupportUnreadCounts();
  const pageSize = 10;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/suporte/chamados?refresh=${Date.now()}`, { cache: "no-store" });
      const payload = await res.json();
      if (res.ok) setTickets((payload.tickets ?? []) as Ticket[]);
    } catch {
      // silencioso — a tela ainda funciona vazia
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const detail = useMemo(
    () => tickets.find((t) => t.databaseId === detailId) ?? null,
    [tickets, detailId],
  );

  const kpis = useMemo(() => {
    const total = tickets.length;
    // "Abertos" = tickets ainda não resolvidos (Aberto + Em análise).
    const abertos = tickets.filter((t) => t.status !== "Resolvido").length;
    const resolvidos = tickets.filter((t) => t.status === "Resolvido").length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const mes = tickets.filter((t) => new Date(t.createdAt).getTime() >= monthStart).length;
    let sum = 0;
    let n = 0;
    for (const t of tickets) {
      const created = new Date(t.createdAt).getTime();
      const firstResp = t.comments.find((c) => c.role && c.role !== "DEPOSITANTE" && c.createdAt);
      if (firstResp?.createdAt) {
        const d = new Date(firstResp.createdAt).getTime() - created;
        if (d > 0) {
          sum += d;
          n += 1;
        }
      }
    }
    const avgMin = n ? Math.round(sum / n / 60000) : 0;
    return {
      abertos,
      taxa: total ? Math.round((resolvidos / total) * 100) : 0,
      mes,
      tempoMedio: n ? formatDur(avgMin) : "—",
    };
  }, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [t.id, t.title, t.autor ?? "", t.depositante ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  function openTicket(t: Ticket) {
    setDetailId(t.databaseId);
    markRead(t.databaseId);
  }

  function patchTicket(databaseId: string, patch: Partial<Pick<Ticket, "status" | "prioridade">>) {
    setTickets((prev) => prev.map((t) => (t.databaseId === databaseId ? { ...t, ...patch } : t)));
    void fetch(`/api/suporte/chamados/${databaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => void load());
  }

  async function addComment(databaseId: string, text: string, anexos: Anexo[]) {
    const res = await fetch(`/api/suporte/chamados/${databaseId}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, anexos }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error ?? "Falha ao enviar.");
    setTickets((prev) =>
      prev.map((t) =>
        t.databaseId === databaseId ? { ...t, comments: [...t.comments, payload.comment] } : t,
      ),
    );
  }

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <div className="flex items-baseline gap-2.5">
          <span
            className={`${FIN_HEADING} rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100`}
          >
            Suporte
          </span>
          <span className={`${monoFont} text-[10px] tracking-[0.08em] ${tokenTextSub}`}>SISTEMA/02</span>
        </div>
        <div className="flex-1" />
        <NotificationBell />
        <ThemeToggle />
      </header>

      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <p className={`text-sm ${tokenTextSub}`}>
          Chamados de depositantes e solicitações ao Infinoos Help.
        </p>

        {tab === "depositantes" ? (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KpiCard label="Tickets abertos" value={String(kpis.abertos)} valueColor={kpis.abertos > 0 ? "#3B82F6" : undefined} />
            <KpiCard label="Tempo médio resposta" value={kpis.tempoMedio} />
            <KpiCard label="Taxa de resolução" value={`${kpis.taxa}%`} valueColor={kpis.taxa >= 50 ? "#10B981" : undefined} />
            <KpiCard label="Tickets no mês" value={String(kpis.mes)} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <div className={`inline-flex shrink-0 items-center gap-1 rounded-full border p-1 ${tokenBorder} ${tokenCardBg}`}>
            {(
              [
                { key: "depositantes", label: "Chamados de depositantes" },
                { key: "help", label: "Infinoos Help" },
              ] as const
            ).map((c) => {
              const active = tab === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setTab(c.key)}
                  className={active ? "inline-flex items-center" : `inline-flex items-center ${tokenTextSub} transition-all hover:bg-slate-50 dark:hover:bg-white/5`}
                  style={{
                    height: "34px",
                    padding: "0 16px",
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none",
                    ...(active ? { background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff" } : {}),
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {tab === "depositantes" ? (
            <>
              <div className={`flex h-[42px] flex-1 min-w-[220px] items-center gap-2 rounded-full border px-4 ${tokenBorder} ${tokenCardBg}`}>
                <Search className={`h-4 w-4 ${tokenTextSub}`} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por assunto, autor, depositante..."
                  className={`flex-1 bg-transparent text-sm outline-none placeholder:text-[#64748B] dark:placeholder:text-[#8695AD] ${tokenText}`}
                />
              </div>
              <PillSelect
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                options={[{ value: "all", label: "Todos os status" }, ...STATUS.map((s) => ({ value: s, label: s }))]}
              />
            </>
          ) : null}
        </div>

        {tab === "depositantes" ? (
          <div className={`overflow-hidden rounded-2xl border ${tokenBorder} ${tokenCardBg}`}>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ minWidth: "860px" }}>
                  <thead>
                    <tr className={`border-b ${tokenBorder} ${tokenInputBg}`}>
                      <Th>ID</Th>
                      <Th>Assunto</Th>
                      <Th>Prioridade</Th>
                      <Th>Status</Th>
                      <Th>Criado</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className={`px-5 py-12 text-center text-sm ${tokenTextSub}`}>
                          Carregando chamados...
                        </td>
                      </tr>
                    ) : paginated.length ? (
                      paginated.map((t) => (
                        <TicketRow key={t.databaseId} t={t} unread={counts[t.databaseId] ?? 0} onClick={() => openTicket(t)} />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className={`px-5 py-12 text-center text-sm ${tokenTextSub}`}>
                          Nenhum chamado encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filtered.length ? (
                <div className={`flex items-center justify-between border-t px-5 py-3 ${tokenBorder}`}>
                  <span className={`text-[12.5px] ${tokenTextSub}`}>
                    {start + 1}–{Math.min(start + pageSize, filtered.length)} de {filtered.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className={`flex h-8 w-8 items-center justify-center rounded-[9px] border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className={`text-[12.5px] font-semibold ${tokenText}`}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className={`flex h-8 w-8 items-center justify-center rounded-[9px] border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
        ) : (
          <div className="flex min-h-[560px] flex-1">
            <HelpEmbed />
          </div>
        )}
      </div>

      {detail ? (
        <TicketDrawer
          ticket={detail}
          onClose={() => setDetailId(null)}
          onChangeStatus={(status) => patchTicket(detail.databaseId, { status })}
          onChangePrioridade={(prioridade) => patchTicket(detail.databaseId, { prioridade })}
          onComment={(text, anexos) => addComment(detail.databaseId, text, anexos)}
        />
      ) : null}
    </div>
  );
}

function TicketRow({ t, unread, onClick }: { t: Ticket; unread: number; onClick: () => void }) {
  const ss = statusStyle(t.status);
  const ps = prioStyle(t.prioridade);
  return (
    <tr onClick={onClick} className={`cursor-pointer border-t transition ${tokenBorder} hover:bg-[rgba(139,92,246,0.08)]`}>
      <td className={`${monoFont} ${tokenTextSub}`} style={{ padding: "12px 16px", fontSize: "12.5px", whiteSpace: "nowrap" }}>
        {t.id}
      </td>
      <td style={{ padding: "12px 16px" }}>
        <div className="flex items-center gap-2">
          {unread > 0 ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#8B5CF6]" title="Novas mensagens" /> : null}
          <div className="min-w-0">
            <div className={`truncate text-[14px] font-bold ${tokenText}`} style={{ maxWidth: "340px" }}>
              {t.title}
            </div>
            <div className={`mt-[1px] truncate text-[12px] ${tokenTextSub}`}>
              {(t.autor ?? "—") + (t.depositante ? ` · ${t.depositante}` : "")}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: "12px 16px" }}>
        <span className="inline-flex" style={{ padding: "3px 9px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 700, background: ps.bg, color: ps.fg, whiteSpace: "nowrap" }}>
          {t.prioridade}
        </span>
      </td>
      <td style={{ padding: "12px 16px" }}>
        <span className="inline-flex items-center" style={{ gap: "6px", padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: ss.bg, color: ss.fg, whiteSpace: "nowrap" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: ss.fg }} />
          {t.status}
        </span>
      </td>
      <td className={tokenTextSub} style={{ padding: "12px 16px", fontSize: "12.5px", whiteSpace: "nowrap" }}>
        {formatCriado(t.createdAt)}
      </td>
      <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "13px" }} className={tokenTextSub}>
        ›
      </td>
    </tr>
  );
}

function roleMeta(role?: string | null) {
  const team = Boolean(role) && role !== "DEPOSITANTE";
  const label =
    role === "OPERADOR"
      ? "Operador"
      : role === "ADMIN"
        ? "Administrador"
        : role === "TI"
          ? "TI"
          : role === "DEPOSITANTE"
            ? "Depositante"
            : team
              ? "Equipe"
              : "Depositante";
  return { team, label };
}

function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function PillMenu({
  value,
  options,
  styleFn,
  dot,
  onChange,
}: {
  value: string;
  options: readonly string[];
  styleFn: (v: string) => { bg: string; fg: string };
  dot?: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const st = styleFn(value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-[5px] rounded-full px-2.5 py-[3px] text-[11px] font-bold transition hover:brightness-95"
        style={{ background: st.bg, color: st.fg, cursor: "pointer" }}
      >
        {dot ? <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: st.fg }} /> : null}
        {value}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-[1]" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 top-[calc(100%+5px)] z-[2] flex min-w-[150px] flex-col gap-0.5 rounded-[10px] border p-1 shadow-[0_12px_30px_rgba(0,0,0,0.25)] ${tokenBorder} ${tokenCardBg}`}>
            {options.map((o) => {
              const os = styleFn(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[12.5px] font-semibold transition hover:bg-[rgba(139,92,246,0.08)] ${o === value ? tokenText : tokenTextSub}`}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: os.fg }} />
                  {o}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function TicketDrawer({
  ticket,
  onClose,
  onChangeStatus,
  onChangePrioridade,
  onComment,
}: {
  ticket: Ticket;
  onClose: () => void;
  onChangeStatus: (status: string) => void;
  onChangePrioridade: (prioridade: string) => void;
  onComment: (text: string, anexos: Anexo[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingAnexos, setPendingAnexos] = useState<Anexo[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [ticket.comments.length]);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await fetch(`/api/suporte/chamados/${ticket.databaseId}/anexos`, { method: "POST", body: form });
      const payload = await res.json();
      if (res.ok && Array.isArray(payload.anexos)) {
        setPendingAnexos((prev) => [...prev, ...(payload.anexos as Anexo[])]);
      }
    } catch {
      // silencioso
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const value = text.trim();
    if ((!value && !pendingAnexos.length) || sending) return;
    setSending(true);
    try {
      await onComment(value, pendingAnexos);
      setText("");
      setPendingAnexos([]);
    } catch {
      // erro silencioso — mantém o texto pro usuário tentar de novo
    } finally {
      setSending(false);
    }
  }

  const quickActions =
    ticket.status === "Resolvido"
      ? [{ key: "reabrir", label: "Reabrir", Icon: RotateCcw, next: "Aberto" }]
      : [
          ...(ticket.status === "Aberto"
            ? [{ key: "analise", label: "Iniciar análise", Icon: Clock, next: "Em análise" }]
            : []),
          { key: "resolver", label: "Marcar resolvido", Icon: CheckCircle2, next: "Resolvido" },
        ];
  const primaryKey =
    ticket.status === "Aberto" ? "analise" : ticket.status === "Em análise" ? "resolver" : "reabrir";

  const subline = [ticket.autor, ticket.depositante, formatCriado(ticket.createdAt)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="fixed inset-0 z-40" style={manropeStyle}>
      <div className="absolute inset-0 bg-[rgba(6,10,20,0.45)] backdrop-blur-[2px]" onClick={onClose} />
      <aside className={`absolute inset-y-0 right-0 flex w-[480px] max-w-[92vw] flex-col border-l bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:bg-[#0C1526] ${tokenBorder}`}>
        <div className={`border-b px-6 pb-3.5 pt-5 ${tokenBorder}`}>
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <span className={`${monoFont} text-[12px] font-semibold ${tokenTextSub}`}>{ticket.id}</span>
            <PillMenu value={ticket.prioridade} options={PRIORIDADES} styleFn={prioStyle} onChange={onChangePrioridade} />
            <PillMenu value={ticket.status} options={STATUS} styleFn={statusStyle} dot onChange={onChangeStatus} />
            <span className={`text-[11px] ${tokenTextSub}`}>SLA: 2h</span>
            <div className="flex-1" />
            <button type="button" title="Fechar" onClick={onClose} className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6]`}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`text-[17px] font-bold leading-[1.3] ${tokenText}`}>{ticket.title}</div>
          <div className={`mt-1 text-[12.5px] ${tokenTextSub}`}>{subline}</div>
        </div>

        <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-3">
          {ticket.comments.length ? (
            <div className="flex flex-col">
              {ticket.comments.map((c) => {
                const rm = roleMeta(c.role);
                return (
                  <div key={c.id} className={`flex items-start gap-2.5 py-2 ${rm.team ? "flex-row-reverse" : "flex-row"}`}>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                      style={
                        rm.team
                          ? { background: "rgba(139,92,246,0.13)", border: "1px solid rgba(139,92,246,0.27)", color: "#8B5CF6" }
                          : { background: "rgba(59,130,246,0.13)", border: "1px solid rgba(59,130,246,0.27)", color: "#3B82F6" }
                      }
                    >
                      {initials(c.author)}
                    </span>
                    <div
                      className="min-w-0 flex-1 px-3.5 py-2.5"
                      style={
                        rm.team
                          ? { background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: "14px 4px 14px 14px" }
                          : { background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.16)", borderRadius: "4px 14px 14px 14px" }
                      }
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`text-[12.5px] font-bold ${tokenText}`}>{c.author ?? "Usuário"}</span>
                        <span
                          className="rounded-full px-1.5 py-[1px] text-[10px] font-bold"
                          style={rm.team ? { background: "rgba(139,92,246,0.1)", color: "#8B5CF6" } : { background: "rgba(59,130,246,0.1)", color: "#3B82F6" }}
                        >
                          {rm.label}
                        </span>
                        <span className={`ml-auto text-[10.5px] ${tokenTextSub}`}>{formatCriado(c.createdAt)}</span>
                      </div>
                      {c.text ? (
                        <div className={`whitespace-pre-wrap break-words text-[13.5px] leading-[1.55] ${tokenText}`}>{c.text}</div>
                      ) : null}
                      <AnexoList anexos={c.anexos} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={`text-[13px] ${tokenTextSub}`}>Sem mensagens ainda.</p>
          )}
        </div>

        <div className={`flex flex-col gap-2.5 border-t px-6 py-3 ${tokenBorder}`}>
          {quickActions.length ? (
            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((a) => {
                const primary = a.key === primaryKey;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => onChangeStatus(a.next)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
                      primary
                        ? "text-white hover:-translate-y-px"
                        : `border ${tokenBorder} ${tokenInputBg} ${tokenTextSub} hover:border-[#8B5CF6]`
                    }`}
                    style={primary ? { background: "linear-gradient(92deg, #3B82F6, #8B5CF6)" } : undefined}
                  >
                    <a.Icon className="h-3.5 w-3.5" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {pendingAnexos.length ? (
            <div className="flex flex-wrap gap-2">
              {pendingAnexos.map((a, i) => (
                <span
                  key={i}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="max-w-[140px] truncate">{a.nome}</span>
                  <button
                    type="button"
                    onClick={() => setPendingAnexos((prev) => prev.filter((_, idx) => idx !== i))}
                    className={`transition hover:text-[#EF4444] ${tokenTextSub}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className={`flex items-center gap-1 rounded-full border-2 py-1 pl-4 pr-1 ${tokenInputBg}`} style={{ borderColor: "rgba(139,92,246,0.35)" }}>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              onChange={onPickFiles}
              className="hidden"
            />
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Responder..."
              className={`flex-1 bg-transparent px-0 py-2 text-[13.5px] outline-none ${tokenText}`}
            />
            <button
              type="button"
              title="Anexar foto ou documento"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-[rgba(139,92,246,0.1)] hover:text-[#8B5CF6] disabled:opacity-50 ${tokenTextSub}`}
            >
              {uploading ? <MobileButtonSpinner size={16} /> : <Paperclip className="h-[18px] w-[18px]" />}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending || (!text.trim() && !pendingAnexos.length)}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-white transition-transform hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0"
              style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
            >
              {sending ? <MobileButtonSpinner size={18} /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function AnexoList({ anexos }: { anexos?: Array<{ url: string; nome: string; tipo: string }> }) {
  if (!anexos?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {anexos.map((a, i) =>
        a.tipo.startsWith("image/") ? (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            title={a.nome}
            className={`block h-24 w-24 overflow-hidden rounded-[10px] border ${tokenBorder}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url} alt={a.nome} className="h-full w-full object-cover" />
          </a>
        ) : (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            title={a.nome}
            className={`flex max-w-[200px] items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[12px] transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{a.nome}</span>
          </a>
        ),
      )}
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

function KpiCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101B30]">
      <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">{label}</span>
      <span className={`${FIN_HEADING} text-[30px] font-bold`} style={valueColor ? { color: valueColor } : undefined}>
        <span className={valueColor ? "" : "text-slate-900 dark:text-zinc-100"}>{value}</span>
      </span>
    </div>
  );
}
