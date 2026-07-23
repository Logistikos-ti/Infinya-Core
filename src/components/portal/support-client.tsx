"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CircleHelp, Loader2, Send, X } from "lucide-react";
import type { SupportTicket } from "@/lib/support";

type TicketTone = "green" | "blue" | "amber";

export type Ticket = SupportTicket;

type Comment = { id: string; text: string; author?: string; role?: string | null; createdAt?: string };

const categories = ["Divergência", "Estoque", "Financeiro", "Outros"];

const initialTickets: Ticket[] = [];

export function SupportClient({ initialTickets = [] }: { initialTickets?: Ticket[] }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [feedback, setFeedback] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  useEffect(() => {
    let active = true;
    fetch("/api/suporte/chamados", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os chamados.");
        if (active && (initialTickets.length === 0 || (payload.tickets ?? []).length > 0)) setTickets(payload.tickets ?? []);
      })
      .catch((error: unknown) => {
        if (active) setFeedback(error instanceof Error ? error.message : "Não foi possível carregar os chamados.");
      })
      .finally(() => active && setLoadingTickets(false));
    return () => { active = false; };
  }, [initialTickets.length]);

  async function submitTicket() {
    if (!subject.trim() || !message.trim()) {
      setFeedback("Preencha o assunto e a mensagem para abrir o chamado.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/suporte/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível abrir o chamado.");
      setTickets((current) => [payload.ticket, ...current]);
      setSubject("");
      setMessage("");
      setFeedback(`Chamado ${payload.ticket.id} aberto com sucesso.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível abrir o chamado.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeTicket() {
    setSelectedId(null);
    setComment("");
  }

  async function sendComment() {
    if (!selectedId || !comment.trim()) return;
    const selectedTicket = tickets.find((ticket) => ticket.id === selectedId);
    if (!selectedTicket) return;
    setSendingComment(true);
    try {
      const response = await fetch(`/api/suporte/chamados/${selectedTicket.databaseId}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: comment }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar o comentário.");
      setTickets((current) => current.map((ticket) => ticket.id === selectedId ? { ...ticket, comments: [...ticket.comments, payload.comment], meta: `agora · ${ticket.comments.length + 1} comentários` } : ticket));
      setComment("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível enviar o comentário.");
    } finally {
      setSendingComment(false);
    }
  }

  return (
    <>
      <style jsx>{`
        @keyframes supportOverlayFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes supportDrawerIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes supportRowIn {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div className="grid min-h-[520px] gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
            <h3 className="font-display text-base font-bold">Abrir chamado</h3>
            <label className="mt-4 block text-xs text-slate-500">
              Assunto
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5"
                placeholder="Ex.: Divergência no pedido #EC-48219"
              />
            </label>
            <span className="mt-4 block text-xs text-slate-500">Categoria</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${category === item ? "border-violet-500 bg-violet-500/10 text-slate-900 dark:text-white" : "border-slate-200 text-slate-600 hover:border-violet-300 dark:border-white/10 dark:text-slate-300"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs text-slate-500">
              Mensagem
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5"
                placeholder="Descreva o ocorrido..."
              />
            </label>
            <button
              type="button"
              onClick={() => void submitTicket()}
              disabled={submitting}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/20 transition enabled:hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Enviando..." : "Enviar chamado"}
            </button>
            {feedback ? (
              <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${feedback.includes("sucesso") ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                {feedback}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CircleHelp className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Tempo de resposta</p>
              <p className="text-xs text-slate-500">Em até 2h úteis</p>
            </div>
          </div>
        </div>

        <div className="min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
          <div className="border-b border-slate-200 px-5 py-4 font-display text-base font-bold dark:border-white/10">
            Meus chamados
          </div>
          <div className="flex flex-col">
            {loadingTickets ? (
              <div className="flex min-h-[420px] items-center justify-center px-6 text-center text-sm text-slate-500">Carregando chamados...</div>
            ) : tickets.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center px-6 text-center">
                <div>
                  <p className="font-display text-sm font-bold">Nenhum chamado aberto</p>
                  <p className="mt-1 text-xs text-slate-500">Os chamados enviados aparecerão aqui.</p>
                </div>
              </div>
            ) : (
              tickets.map((ticket) => (
                <button
                  type="button"
                  key={ticket.id}
                  onClick={() => setSelectedId(ticket.id)}
                  className="flex w-full items-center gap-4 border-b border-slate-100 px-5 py-5 text-left transition hover:bg-slate-50 last:border-0 dark:border-white/10 dark:hover:bg-white/5"
                  style={{ animation: "supportRowIn 0.35s ease both" }}
                >
                  <span className="w-[74px] shrink-0 font-display text-xs font-bold text-slate-500 dark:text-slate-400">
                    {ticket.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{ticket.title}</span>
                    <span className="block text-xs text-slate-500">
                      {ticket.category} · {ticket.meta}
                    </span>
                  </span>
                  <StatusPill ticket={ticket} />
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {selected ? (
        <TicketDrawer
          ticket={selected}
          comment={comment}
          onClose={closeTicket}
          onChangeComment={setComment}
          onSendComment={sendComment}
          sendingComment={sendingComment}
        />
      ) : null}
    </>
  );
}

function StatusPill({ ticket }: { ticket: Ticket }) {
  const style =
    ticket.tone === "green"
      ? "bg-emerald-500/10 text-emerald-600"
      : ticket.tone === "blue"
        ? "bg-blue-500/10 text-blue-600"
        : "bg-amber-500/10 text-amber-600";

  return <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${style}`}>{ticket.status}</span>;
}

function TicketDrawer({
  ticket,
  comment,
  onClose,
  onChangeComment,
  onSendComment,
  sendingComment,
}: {
  ticket: Ticket;
  comment: string;
  onClose: () => void;
  onChangeComment: (value: string) => void;
  onSendComment: () => void;
  sendingComment: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar detalhes do chamado"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[3px]"
        style={{ animation: "supportOverlayFade 0.25s ease both" }}
      />
      <aside
        className="relative flex h-full w-[500px] max-w-[94vw] flex-col border-l border-slate-200 bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[#0c1526]"
        style={{ animation: "supportDrawerIn 0.32s cubic-bezier(.3,1,.4,1) both" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="font-display text-xs font-bold text-slate-500 dark:text-slate-400">
              {ticket.id} · {ticket.category}
            </span>
            <h2 className="font-display text-[19px] font-bold leading-tight">{ticket.title}</h2>
            <div className="pt-1">
              <StatusPill ticket={ticket} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-violet-400 hover:text-violet-600 dark:border-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Comentários</p>
          {ticket.comments.map((item, index) => (
            <div
              key={`${ticket.id}-${index}`}
              className={`max-w-[86%] rounded-xl px-4 py-3 text-sm ${index % 2 === 0 ? "bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300" : "ml-auto bg-violet-500/10 text-slate-700 dark:text-slate-200"}`}
            >
              {item.text}
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0c1526]">
          <input
            value={comment}
            onChange={(event) => onChangeComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSendComment();
            }}
            className="h-[46px] min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5"
            placeholder="Escreva um comentário..."
          />
          <button
            type="button"
            onClick={onSendComment}
            disabled={!comment.trim() || sendingComment}
            aria-label="Enviar comentário"
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </div>
  );
}
