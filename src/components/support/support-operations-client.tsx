"use client";

import { useEffect, useState } from "react";
import { CircleHelp, MessageCircle, Send, X } from "lucide-react";
import type { Ticket } from "@/components/portal/support-client";

export function SupportOperationsClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/suporte/chamados", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setTickets(payload.tickets ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function changeStatus(status: string) {
    if (!selected) return;
    await fetch(`/api/suporte/chamados/${selected.databaseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await load();
    setSelected((current) => current ? { ...current, status, tone: status === "Resolvido" ? "green" : status === "Em análise" ? "blue" : "amber" } : current);
  }

  async function sendComment() {
    if (!selected || !comment.trim()) return;
    const response = await fetch(`/api/suporte/chamados/${selected.databaseId}/comentarios`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: comment }) });
    const payload = await response.json();
    if (response.ok) {
      setSelected({ ...selected, comments: [...selected.comments, payload.comment] });
      setComment("");
      await load();
    }
  }

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      {[["Abertos", tickets.filter((ticket) => ticket.status === "Aberto").length, "text-amber-600"], ["Em análise", tickets.filter((ticket) => ticket.status === "Em análise").length, "text-blue-600"], ["Resolvidos", tickets.filter((ticket) => ticket.status === "Resolvido").length, "text-emerald-600"]].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]"><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-2 font-display text-3xl font-bold ${color}`}>{value}</p></div>)}
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 font-display text-base font-bold dark:border-white/10"><MessageCircle className="h-4 w-4 text-violet-500" /> Chamados dos depositantes</div>
      {loading ? <div className="p-10 text-center text-sm text-slate-500">Carregando chamados...</div> : tickets.length === 0 ? <div className="p-10 text-center"><CircleHelp className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-500">Nenhum chamado recebido.</p></div> : tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => setSelected(ticket)} className="flex w-full items-center gap-4 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><span className="w-20 shrink-0 text-xs font-bold text-slate-500">{ticket.id}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{ticket.title}</span><span className="block text-xs text-slate-500">{ticket.depositante ?? "Depositante"} · {ticket.category} · {ticket.meta}</span></span><span className={`rounded-full px-3 py-1 text-[11px] font-bold ${ticket.tone === "green" ? "bg-emerald-500/10 text-emerald-600" : ticket.tone === "blue" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"}`}>{ticket.status}</span></button>)}
    </div>
    {selected ? <div className="fixed inset-0 z-50 flex justify-end"><button type="button" aria-label="Fechar" onClick={() => setSelected(null)} className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]" /><aside className="relative flex h-full w-[500px] max-w-[94vw] flex-col border-l border-slate-200 bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[#0c1526]" style={{ animation: "drawerIn .32s cubic-bezier(.3,1,.4,1)" }}><div className="flex items-start justify-between gap-3 border-b border-slate-200 p-6 dark:border-white/10"><div><p className="text-xs font-bold text-slate-500">{selected.id} · {selected.category}</p><h2 className="mt-2 font-display text-xl font-bold">{selected.title}</h2><p className="mt-2 text-xs text-slate-500">{selected.depositante}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Fechar chamado"><X className="h-5 w-5 text-slate-500" /></button></div><div className="flex gap-2 border-b border-slate-200 p-5 dark:border-white/10"><select value={selected.status} onChange={(event) => void changeStatus(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-white/10 dark:bg-white/5"><option>Aberto</option><option>Em análise</option><option>Resolvido</option></select></div><div className="flex-1 space-y-3 overflow-y-auto p-6">{selected.comments.map((item) => <div key={item.id} className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300"><p>{item.text}</p><p className="mt-2 text-[11px] text-slate-400">{item.author ?? "Usuário"}</p></div>)}</div><div className="flex gap-2 border-t border-slate-200 p-5 dark:border-white/10"><input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void sendComment()} placeholder="Escreva um comentário..." className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-white/10 dark:bg-white/5" /><button type="button" onClick={() => void sendComment()} disabled={!comment.trim()} aria-label="Enviar comentário" className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button></div></aside></div> : null}
  </div>;
}
