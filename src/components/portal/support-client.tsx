"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CircleHelp, Send } from "lucide-react";

type Ticket = { id: string; title: string; category: string; meta: string; status: string; tone: "green" | "blue" | "amber"; comments: string[] };

const categories = ["Divergência", "Estoque", "Financeiro", "Outros"];

export function SupportClient() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [feedback, setFeedback] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([
    { id: "#CH-2043", title: "Divergência no pedido #EC-48120", category: "Divergência", meta: "há 2 dias · 3 comentários", status: "Resolvido", tone: "green", comments: ["O pedido veio com 1 item a menos que o faturado.", "Recontagem concluída e divergência ajustada."] },
    { id: "#CH-2051", title: "Nota fiscal não emitida — Shopee", category: "Financeiro", meta: "ontem · 2 comentários", status: "Em análise", tone: "blue", comments: ["A NF-e do pedido Shopee não foi emitida."] },
    { id: "#CH-2058", title: "Recontagem de estoque ELT-4821", category: "Estoque", meta: "há 5 h · 1 comentário", status: "Aberto", tone: "amber", comments: ["Solicito recontagem do SKU ELT-4821."] },
  ]);

  const selected = tickets.find((ticket) => ticket.id === selectedId);

  function submitTicket() {
    if (!subject.trim() || !message.trim()) {
      setFeedback("Preencha o assunto e a mensagem para abrir o chamado.");
      return;
    }
    const id = `#CH-${2060 + tickets.length}`;
    setTickets((current) => [{ id, title: subject.trim(), category, meta: "agora · 1 comentário", status: "Aberto", tone: "amber", comments: [message.trim()] }, ...current]);
    setSubject("");
    setMessage("");
    setFeedback(`Chamado ${id} aberto com sucesso.`);
  }

  function sendComment() {
    if (!selectedId || !comment.trim()) return;
    setTickets((current) => current.map((ticket) => ticket.id === selectedId ? { ...ticket, comments: [...ticket.comments, comment.trim()], meta: `agora · ${ticket.comments.length + 1} comentários` } : ticket));
    setComment("");
  }

  return <div className="grid min-h-[520px] gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)]">
    <div className="flex flex-col gap-4">
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <h3 className="font-display text-base font-bold">Abrir chamado</h3>
        <label className="mt-4 block text-xs text-slate-500">Assunto<input value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5" placeholder="Ex.: Divergência no pedido #EC-48219" /></label>
        <span className="mt-4 block text-xs text-slate-500">Categoria</span>
        <div className="mt-2 flex flex-wrap gap-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${category === item ? "border-violet-500 bg-violet-500/10 text-slate-900 dark:text-white" : "border-slate-200 text-slate-600 hover:border-violet-300 dark:border-white/10 dark:text-slate-300"}`}>{item}</button>)}</div>
        <label className="mt-4 block text-xs text-slate-500">Mensagem<textarea value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5" placeholder="Descreva o ocorrido..." /></label>
        <button type="button" onClick={submitTicket} className="mt-4 h-12 w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/20">Enviar chamado</button>
        {feedback ? <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${feedback.includes("sucesso") ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{feedback}</p> : null}
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><CircleHelp className="h-5 w-5" /></span><div><p className="text-sm font-bold">Tempo de resposta</p><p className="text-xs text-slate-500">Em até 2h úteis</p></div></div>
    </div>
    <div className="min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
      {selected ? <div className="flex h-full flex-col"><div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10"><button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0 flex-1"><p className="truncate font-display text-base font-bold">{selected.title}</p><p className="text-xs text-slate-500">{selected.id} · {selected.category}</p></div><StatusPill ticket={selected} /></div><div className="flex-1 space-y-3 overflow-y-auto p-5">{selected.comments.map((item, index) => <div key={`${selected.id}-${index}`} className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${index % 2 === 0 ? "bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300" : "ml-auto bg-violet-500/10 text-slate-700 dark:text-slate-200"}`}>{item}</div>)}</div><div className="flex gap-2 border-t border-slate-200 p-4 dark:border-white/10"><input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendComment()} className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5" placeholder="Escreva uma resposta..." /><button type="button" onClick={sendComment} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white"><Send className="h-4 w-4" /></button></div></div> : <><div className="border-b border-slate-200 px-5 py-4 font-display text-base font-bold dark:border-white/10">Meus chamados</div>{tickets.map((ticket) => <button type="button" key={ticket.id} onClick={() => setSelectedId(ticket.id)} className="flex w-full items-center gap-4 border-b border-slate-100 px-5 py-5 text-left transition hover:bg-slate-50 last:border-0 dark:border-white/10 dark:hover:bg-white/5"><span className="w-16 shrink-0 font-display text-xs font-bold">{ticket.id}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{ticket.title}</span><span className="block text-xs text-slate-500">{ticket.category} · {ticket.meta}</span></span><StatusPill ticket={ticket} /><ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /></button>)}</>}
    </div>
  </div>;
}

function StatusPill({ ticket }: { ticket: Ticket }) {
  const style = ticket.tone === "green" ? "bg-emerald-500/10 text-emerald-600" : ticket.tone === "blue" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600";
  return <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${style}`}>{ticket.status}</span>;
}
