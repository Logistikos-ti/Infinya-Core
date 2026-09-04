"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ChevronDown, CircleAlert, FileCode2, LoaderCircle, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createXmlShippingOrderAction, type ManualShippingOrderSubmissionState } from "@/app/(dashboard)/expedicao/actions";
import { SALES_CHANNEL_OPTIONS, isMarketplaceChannel } from "@/lib/sales-channels";
import { resolveMarketplaceCarrierName } from "@/lib/marketplace-carrier-networks";

function SubmitXmlButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-70">
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Importando XML..." : "Criar pedido pelo XML"}
    </button>
  );
}

export function PortalXmlOrderDrawer({ depositanteId, depositanteName, onClose }: { depositanteId: string; depositanteName: string; onClose: () => void }) {
  const router = useRouter();
  const [channel, setChannel] = useState("VENDA_DIRETA");
  const [channelOpen, setChannelOpen] = useState(false);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [carrier, setCarrier] = useState("Outro");
  const [otherCarrier, setOtherCarrier] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(true);
  const [submission, submitXmlOrder] = useActionState(
    createXmlShippingOrderAction,
    { status: "idle" } as ManualShippingOrderSubmissionState,
  );
  const selectedChannel = SALES_CHANNEL_OPTIONS.find((option) => option.value === channel) ?? SALES_CHANNEL_OPTIONS[0];
  const carrierChipOptions = ["Correios", "Ponto de Coleta", ...(isMarketplaceChannel(channel) ? ["Coleta Marketplace"] : []), "Outro"];
  const resolvedCarrierName =
    carrier === "Outro"
      ? otherCarrier
      : carrier === "Coleta Marketplace"
        ? resolveMarketplaceCarrierName(channel)
        : carrier;

  useEffect(() => {
    if (submission.status !== "idle") setFeedbackOpen(true);
    if (submission.status === "success") router.refresh();
  }, [router, submission.status]);

  const closeFeedback = () => {
    if (submission.status === "success") {
      onClose();
      router.replace("/portal?view=pedidos");
      router.refresh();
      return;
    }
    setFeedbackOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[85] flex justify-end" role="dialog" aria-modal="true" aria-label="Importar pedido via XML">
      <button type="button" aria-label="Fechar importação XML" onClick={onClose} className="absolute inset-0 cursor-default border-0 bg-slate-950/55 backdrop-blur-sm" />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0c1424]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-br from-white to-violet-50 px-6 py-6 dark:border-white/10 dark:from-[#0c1424] dark:to-[#17132b]">
          <div>
            <p className="text-xs font-extrabold tracking-[0.13em] text-slate-500 dark:text-slate-400">NOVO PEDIDO</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Importar XML da NF-e</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">O pedido será criado automaticamente no CD.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><X className="h-5 w-5" /></button>
        </header>

        <form action={submitXmlOrder} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-28 pt-6">
            <input type="hidden" name="depositanteId" value={depositanteId} />
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">Depositante
              <input value={depositanteName} readOnly className="mt-2 h-12 w-full rounded-2xl border border-cyan-400 bg-white px-4 text-sm font-bold text-slate-900 outline-none dark:bg-white/5 dark:text-white" />
            </label>
            <div className="relative text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Canal de venda</span>
              <input type="hidden" name="salesChannelCode" value={channel} />
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={channelOpen}
                onClick={() => setChannelOpen((open) => !open)}
                className="mt-2 flex h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left text-sm font-semibold text-slate-900 outline-none transition hover:border-cyan-400 focus:border-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <span>{selectedChannel.label}</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${channelOpen ? "rotate-180" : ""}`} />
              </button>
              {channelOpen ? (
                <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-[#111b2e]">
                  {SALES_CHANNEL_OPTIONS.map((option) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.value === channel}
                      key={option.value}
                      onClick={() => { setChannel(option.value); setChannelOpen(false); if (carrier === "Coleta Marketplace" && !option.marketplace) setCarrier("Outro"); }}
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition hover:bg-cyan-50 dark:hover:bg-cyan-400/10 ${option.value === channel ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300" : "text-slate-700 dark:text-slate-200"}`}
                    >
                      <span>{option.label}</span>
                      {option.value === channel ? <Check className="h-4 w-4" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <label className={`block cursor-pointer rounded-2xl border border-dashed p-5 text-sm font-bold transition hover:-translate-y-px ${xmlFile ? "border-emerald-400 bg-emerald-50/70 text-slate-800 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-slate-100" : "border-violet-300 bg-violet-50/70 text-slate-800 hover:border-violet-500 dark:border-violet-400/40 dark:bg-violet-500/10 dark:text-slate-100"}`}>
              <span className="flex items-center gap-2"><FileCode2 className={`h-5 w-5 ${xmlFile ? "text-emerald-600" : "text-violet-600"}`} /> XML da NF-e de saída *</span>
              <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Obrigatório. O sistema identifica destinatário, itens, valores e transportadora.</span>
              <span className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold shadow-sm ${xmlFile ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200" : "bg-white text-violet-700 dark:bg-white/10 dark:text-violet-200"}`}>{xmlFile ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}{xmlFile ? "XML selecionado" : "Selecionar XML"}</span>
              <input type="file" name="invoiceXml" required accept=".xml,application/xml,text/xml" onChange={(event) => setXmlFile(event.target.files?.[0] ?? null)} className="sr-only" />
              {xmlFile ? <span className="mt-3 block truncate text-xs font-semibold text-emerald-700 dark:text-emerald-200">{xmlFile.name} · {(xmlFile.size / 1024).toFixed(1)} KB</span> : null}
            </label>
            <section>
              <h3 className="mb-3 text-xs font-bold text-slate-500 dark:text-slate-400">Transportadora física (opcional)</h3>
              {carrier === "Outro" ? <input name="carrierName" value={otherCarrier} onChange={(event) => setOtherCarrier(event.target.value)} placeholder="Digite o nome ou deixe a XML informar" className="mb-3 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-cyan-400 dark:border-white/10 dark:bg-white/5 dark:text-white" /> : <input type="hidden" name="carrierName" value={resolvedCarrierName} />}
              <div className="flex flex-wrap gap-2">{carrierChipOptions.map((value) => <button type="button" key={value} onClick={() => { setCarrier(value); if (value !== "Outro") setOtherCarrier(""); }} className={`rounded-[10px] border px-4 py-2 text-xs font-bold transition hover:-translate-y-px ${carrier === value ? "border-cyan-400 bg-cyan-50 text-slate-900 dark:bg-cyan-400/10 dark:text-white" : "border-slate-200 text-slate-500 dark:border-white/10"}`}>{value}</button>)}</div>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Se ficar em “Outro” sem preencher, a transportadora será aproveitada da própria XML.</p>
              {carrier === "Coleta Marketplace" && <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Vai gravar como <strong>{resolvedCarrierName}</strong>.</p>}
            </section>
            <label className="block cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <span className="flex items-center gap-2"><Upload className="h-5 w-5 text-violet-500" /> Etiqueta de envio (opcional)</span>
              <input type="file" name="shippingLabel" accept=".pdf,.png,.jpg,.jpeg,.zpl,application/pdf,image/png,image/jpeg,text/plain" className="mt-3 block w-full text-xs font-medium" />
            </label>
          </div>
          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 dark:border-white/10 dark:bg-[#0c1424]/95">
            <button type="button" onClick={onClose} className="h-12 rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-900 transition hover:-translate-y-px hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white">Cancelar</button>
            <SubmitXmlButton />
          </footer>
        </form>

        {submission.status !== "idle" && feedbackOpen ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/55 p-5 backdrop-blur-sm">
            <section className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${submission.status === "success" ? "border-emerald-200 bg-white dark:border-emerald-400/30 dark:bg-[#101c2e]" : "border-rose-200 bg-white dark:border-rose-400/30 dark:bg-[#101c2e]"}`}>
              <div className={`grid h-12 w-12 place-items-center rounded-2xl ${submission.status === "success" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300" : "bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300"}`}>
                {submission.status === "success" ? <Check className="h-6 w-6" /> : <CircleAlert className="h-6 w-6" />}
              </div>
              <h3 className="mt-4 text-xl font-extrabold text-slate-950 dark:text-white">
                {submission.status === "success" ? "Pedido importado com sucesso" : "Não foi possível importar o pedido"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {submission.detail || (submission.status === "success" ? "O pedido já está disponível em Meus pedidos." : "Revise o XML e tente novamente.")}
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={closeFeedback} className={`h-11 rounded-xl px-5 text-sm font-extrabold text-white transition hover:-translate-y-px ${submission.status === "success" ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-rose-500 shadow-lg shadow-rose-500/20"}`}>
                  {submission.status === "success" ? "Ver meus pedidos" : "Fechar"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
