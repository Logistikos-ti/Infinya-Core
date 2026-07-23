"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, CircleHelp, MessageCircle, Send, X } from "lucide-react";
import type { Ticket } from "@/components/portal/support-client";

const statusOptions = ["Aberto", "Em análise", "Resolvido"] as const;

export function SupportOperationsClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [comment, setComment] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const response = await fetch("/api/suporte/chamados", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setTickets(payload.tickets ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function changeStatus(status: string) {
    if (!selected) return;
    const response = await fetch(`/api/suporte/chamados/${selected.databaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      const tone = status === "Resolvido" ? "green" : status === "Em análise" ? "blue" : "amber";
      setSelected((current) => current ? { ...current, status, tone } : current);
      setTickets((current) => current.map((ticket) => ticket.databaseId === selected.databaseId ? { ...ticket, status, tone } : ticket));
    }
    setStatusOpen(false);
  }

  async function sendComment() {
    if (!selected || !comment.trim()) return;
    const response = await fetch(`/api/suporte/chamados/${selected.databaseId}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: comment }),
    });
    const payload = await response.json();
    if (response.ok) {
      setSelected({ ...selected, comments: [...selected.comments, payload.comment] });
      setComment("");
      await load();
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Abertos", tickets.filter((ticket) => ticket.status === "Aberto").length, "text-amber-600"],
          ["Em análise", tickets.filter((ticket) => ticket.status === "Em análise").length, "text-blue-600"],
          ["Resolvidos", tickets.filter((ticket) => ticket.status === "Resolvido").length, "text-emerald-600"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className={`mt-2 font-display text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 font-display text-base font-bold dark:border-white/10">
          <MessageCircle className="h-4 w-4 text-violet-500" /> Chamados dos depositantes
        </div>
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Carregando chamados...</div> : tickets.length === 0 ? <div className="p-10 text-center"><CircleHelp className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-500">Nenhum chamado recebido.</p></div> : tickets.map((ticket) => (
          <button key={ticket.id} type="button" onClick={() => setSelected(ticket)} className="flex w-full items-center gap-4 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
            <span className="w-20 shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">{ticket.id}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{ticket.title}</span><span className="block text-xs text-slate-500">{ticket.depositante ?? "Depositante"} · {ticket.category} · {ticket.meta}</span></span>
            <StatusPill status={ticket.status} tone={ticket.tone} />
          </button>
        ))}
      </div>

      {selected ? <TicketDrawer selected={selected} comment={comment} statusOpen={statusOpen} onClose={() => { setSelected(null); setStatusOpen(false); }} onToggleStatus={() => setStatusOpen((value) => !value)} onChangeStatus={changeStatus} onChangeComment={setComment} onSendComment={() => void sendComment()} /> : null}
    </div>
  );
}

function TicketDrawer({ selected, comment, statusOpen, onClose, onToggleStatus, onChangeStatus, onChangeComment, onSendComment }: { selected: Ticket; comment: string; statusOpen: boolean; onClose: () => void; onToggleStatus: () => void; onChangeStatus: (status: string) => void; onChangeComment: (value: string) => void; onSendComment: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end"><style jsx>{`@keyframes supportOpsDrawerIn { from { transform: translateX(36px); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes supportOpsFade { from { opacity: 0; } to { opacity: 1; } }`}</style><button type="button" aria-label="Fechar detalhes do chamado" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]" style={{ animation: "supportOpsFade .25s ease both" }} /><aside className="relative flex h-full w-[520px] max-w-[96vw] flex-col border-l border-slate-200 bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[#0c1526]" style={{ animation: "supportOpsDrawerIn .32s cubic-bezier(.3,1,.4,1) both" }}>
    <div className="border-b border-slate-200 bg-gradient-to-br from-blue-50 via-white to-violet-50 px-6 py-6 dark:border-white/10 dark:from-blue-950/40 dark:via-[#0c1526] dark:to-violet-950/30"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-lg bg-slate-900 px-2.5 py-1 font-display text-[11px] font-bold text-white dark:bg-white/10">{selected.id}</span><span className="text-xs font-semibold text-slate-500">{selected.category}</span></div><h2 className="mt-4 font-display text-xl font-bold leading-tight">{selected.title}</h2><p className="mt-2 text-xs text-slate-500">Depositante: <span className="font-semibold text-slate-700 dark:text-slate-300">{selected.depositante ?? "Não informado"}</span></p></div><button type="button" onClick={onClose} aria-label="Fechar chamado" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-white/5"><X className="h-4 w-4" /></button></div><div className="relative mt-5"><button type="button" aria-expanded={statusOpen} onClick={onToggleStatus} className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-3 text-left text-sm font-semibold transition hover:border-violet-300 dark:border-white/10 dark:bg-white/5"><StatusPill status={selected.status} tone={selected.tone} /><ChevronDown className={`h-4 w-4 text-slate-400 transition ${statusOpen ? "rotate-180" : ""}`} /></button>{statusOpen ? <div className="absolute left-0 right-0 top-12 z-10 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#101b30]">{statusOptions.map((status) => { const tone = status === "Resolvido" ? "green" : status === "Em análise" ? "blue" : "amber"; return <button key={status} type="button" onClick={() => onChangeStatus(status)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-white/5"><StatusPill status={status} tone={tone} />{selected.status === status ? <Check className="h-4 w-4 text-violet-500" /> : null}</button>; })}</div> : null}</div></div>
    <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/60 px-6 py-6 dark:bg-black/10"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Histórico da conversa</p>{selected.comments.map((item, index) => <div key={item.id} className={`flex gap-3 ${index % 2 ? "justify-end" : "justify-start"}`}><span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${index % 2 ? "bg-gradient-to-br from-blue-500 to-violet-500" : "bg-slate-700 dark:bg-slate-600"}`}>{(item.author ?? "U").slice(0, 2).toUpperCase()}</span><div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${index % 2 ? "rounded-tr-md bg-gradient-to-br from-blue-500 to-violet-500 text-white" : "rounded-tl-md border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"}`}><p className="text-sm leading-relaxed">{item.text}</p><p className={`mt-2 text-[10px] ${index % 2 ? "text-white/70" : "text-slate-400"}`}>{item.author ?? "Usuário"}</p></div></div>)}</div>
    <div className="border-t border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#0c1526]"><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-400 dark:border-white/10 dark:bg-white/5"><input value={comment} onChange={(event) => onChangeComment(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSendComment()} placeholder="Escreva um comentário..." className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /><button type="button" onClick={onSendComment} disabled={!comment.trim()} aria-label="Enviar comentário" className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button></div></div>
  </aside></div>;
}

function StatusPill({ status, tone }: { status: string; tone: Ticket["tone"] }) {
  const style = tone === "green" ? "bg-emerald-500/10 text-emerald-600" : tone === "blue" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600";
  return <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${style}`}>{status}</span>;
}
