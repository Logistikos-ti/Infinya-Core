"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CircleAlert, FileCode2, PackageCheck, Upload, X } from "lucide-react";
import { createFullShipmentAction, type FullShipmentSubmissionState } from "@/app/(portal)/portal/full-actions";
import type { FullShipmentSummary } from "@/lib/full-orders";

const marketplaces = ["Mercado Livre Full", "Shopee Fulfillment", "Amazon FBA", "Magalu Full", "Outro"];
type DeliveryMode = "COLETA" | "TRANSPORTADORA";
type XmlItem = { key: string; code: string; name: string; quantity: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="h-12 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-60">
      {pending ? "Criando remessa..." : "Enviar remessa Full"}
    </button>
  );
}

export function PortalFullOrdersView({ shipments, depositanteId, canCreate }: { shipments: FullShipmentSummary[]; depositanteId: string; canCreate: boolean }) {
  const [open, setOpen] = useState(false);
  const statusLabel = (status: string) => ({
    DOCUMENTACAO_PENDENTE: "Documentação pendente",
    PRONTA_PREPARACAO: "Pronta para preparação",
    AGUARDANDO_COLETA: "Aguardando coleta",
    COLETADA: "Coletada",
    CANCELADA: "Cancelada",
  }[status] ?? status);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold tracking-[.16em] text-violet-600">FULFILLMENT</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Pedidos Full</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Envios programados para centros de fulfillment, separados da expedição convencional.</p>
        </div>
        {canCreate ? <button onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-px"><PackageCheck className="h-4 w-4" /> Nova remessa Full</button> : null}
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Remessas programadas" value={shipments.filter((item) => item.status !== "COLETADA" && item.status !== "CANCELADA").length} />
        <Stat label="Prontas para preparação" value={shipments.filter((item) => item.status === "PRONTA_PREPARACAO").length} />
        <Stat label="Coletadas" value={shipments.filter((item) => item.status === "COLETADA").length} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[.03]">
        <div className="grid grid-cols-[1.1fr_.9fr_.9fr_1fr_.8fr] gap-3 border-b border-slate-200 px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:border-white/10"><span>Remessa</span><span>Marketplace</span><span>NF-e</span><span>Destino</span><span>Status</span></div>
        {shipments.length ? shipments.map((shipment) => <div key={shipment.id} className="grid grid-cols-[1.1fr_.9fr_.9fr_1fr_.8fr] gap-3 border-b border-slate-100 px-5 py-4 text-sm last:border-0 dark:border-white/5">
          <div><strong>{shipment.code}</strong><p className="mt-1 text-xs text-slate-500">{shipment.itemCount} item(ns) · {shipment.labelCount}/{shipment.itemCount} etiquetas</p></div>
          <span>{shipment.marketplace}</span>
          <span>{shipment.invoiceNumber}</span>
          <span><strong>{shipment.deliveryMode === "TRANSPORTADORA" ? "Transportadora" : "Coleta"}</strong><small className="mt-1 block text-xs text-slate-500">{shipment.deliveryMode === "TRANSPORTADORA" ? shipment.carrier : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(shipment.collectionAt))}</small></span>
          <span className="w-fit self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">{statusLabel(shipment.status)}</span>
        </div>) : <div className="px-5 py-12 text-center text-sm text-slate-500">Nenhuma remessa Full cadastrada.</div>}
      </div>
      {open ? <FullDrawer depositanteId={depositanteId} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[.03]"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-extrabold">{value}</p></div>;
}

function FullDrawer({ depositanteId, onClose }: { depositanteId: string; onClose: () => void }) {
  const [marketplace, setMarketplace] = useState(marketplaces[0]);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("COLETA");
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [items, setItems] = useState<XmlItem[]>([]);
  const [itemLabelCount, setItemLabelCount] = useState(0);
  const [state, action] = useActionState(createFullShipmentAction, { status: "idle" } as FullShipmentSubmissionState);

  useEffect(() => {
    if (state.status !== "success") return;
    const timeout = window.setTimeout(() => { onClose(); window.location.assign("/portal?view=full"); }, 1300);
    return () => window.clearTimeout(timeout);
  }, [onClose, state.status]);

  const minimumLabels = useMemo(() => items.map((item) => item.key), [items]);

  async function readXml(file: File | null) {
    setXmlFile(file);
    setItems([]);
    setItemLabelCount(0);
    if (!file) return;
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const rows = Array.from(doc.querySelectorAll("det")).map((det, index) => {
      const product = det.querySelector("prod");
      const value = (tag: string) => product?.querySelector(tag)?.textContent?.trim() ?? "";
      return { key: `${value("cProd")}-${index}`, code: value("cProd") || `Item ${index + 1}`, name: value("xProd") || `Produto ${index + 1}`, quantity: value("qCom") || "1" };
    }).filter((item) => item.name);
    setItems(rows);
  }

  return <div className="fixed inset-0 z-[90] flex justify-end">
    <button onClick={onClose} aria-label="Fechar" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
    <aside className="relative flex h-full w-full max-w-[620px] flex-col bg-white shadow-2xl dark:bg-[#0c1424]">
      <header className="flex items-start justify-between border-b border-slate-200 px-6 py-6 dark:border-white/10"><div><p className="text-xs font-extrabold tracking-[.14em] text-violet-600">PEDIDO FULL</p><h2 className="mt-1 text-2xl font-bold">Enviar reposição ao CD</h2><p className="mt-1 text-sm text-slate-500">A DANFE é gerada automaticamente a partir da NF-e XML.</p></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/10"><X className="h-5 w-5" /></button></header>
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <input type="hidden" name="depositanteId" value={depositanteId} />
          <input type="hidden" name="marketplace" value={marketplace} />
          <input type="hidden" name="modalidadeEnvio" value={deliveryMode} />
          <section><p className="mb-2 text-xs font-bold text-slate-500">Marketplace</p><div className="flex flex-wrap gap-2">{marketplaces.map((item) => <button type="button" onClick={() => setMarketplace(item)} key={item} className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${item === marketplace ? "border-violet-500 bg-violet-50 text-violet-700 shadow-sm dark:bg-violet-400/10 dark:text-violet-200" : "border-slate-200 text-slate-600 hover:border-violet-300 dark:border-white/10 dark:text-slate-300 dark:hover:border-violet-400/60"}`}>{item}</button>)}</div></section>
          <label className="block cursor-pointer rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-5 dark:bg-violet-500/5"><span className="flex items-center gap-2 font-bold"><FileCode2 className="h-5 w-5 text-violet-600" /> XML da NF-e de saída *</span><span className="mt-1 block text-xs text-slate-500">Itens, NF-e, destinatário e valor são preenchidos pela nota.</span><input onChange={(event) => readXml(event.target.files?.[0] ?? null)} required name="invoiceXml" accept=".xml,application/xml,text/xml" type="file" className="mt-4 block text-xs" />{xmlFile ? <span className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-600"><Check className="h-4 w-4" />{items.length} item(ns) identificado(s)</span> : null}</label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-500">Data prevista<input required name="collectionDate" type="date" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label><label className="text-xs font-bold text-slate-500">Horário previsto<input required name="collectionTime" type="time" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label></div>
          <section className="space-y-3"><div><h3 className="text-sm font-extrabold">Como o pedido será enviado?</h3><p className="mt-1 text-xs text-slate-500">Escolha se o marketplace fará a coleta ou se uma transportadora levará a remessa.</p></div><div className="grid grid-cols-2 gap-3">{([{ value: "COLETA", title: "Coleta", description: "O marketplace coleta no CD." }, { value: "TRANSPORTADORA", title: "Transportadora", description: "Informe quem fará o transporte." }] as const).map((option) => <button type="button" key={option.value} onClick={() => setDeliveryMode(option.value)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-px ${deliveryMode === option.value ? "border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-400/10 dark:text-violet-100" : "border-slate-200 text-slate-700 dark:border-white/10 dark:text-slate-300"}`}><span className="flex items-center justify-between text-sm font-extrabold">{option.title}{deliveryMode === option.value ? <Check className="h-4 w-4 text-violet-600" /> : null}</span><span className="mt-1 block text-xs font-normal text-slate-500">{option.description}</span></button>)}</div>{deliveryMode === "TRANSPORTADORA" ? <label className="block text-xs font-bold text-slate-500">Nome da transportadora<input required name="transportadoraNome" placeholder="Ex.: Correios, Jadlog ou transportadora própria" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label> : null}</section>
          <Attachment field="entryAuthorization" label="Autorização de entrada *" />
          <Attachment field="volumeLabel" label="Etiqueta de volume *" />
          {deliveryMode === "TRANSPORTADORA" ? <Attachment field="carrierLabel" label="Etiqueta da transportadora *" /> : null}
          {minimumLabels.length ? <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[.03]"><div><h3 className="font-bold">Etiquetas dos produtos *</h3><p className="mt-1 text-xs text-slate-500">Envie todas as etiquetas em lote: {items.length} item(ns) identificado(s) exigem exatamente {items.length} arquivo(s). A quantidade do item não multiplica a exigência.</p></div><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-violet-300 bg-white p-4 text-sm font-bold dark:border-violet-400/40 dark:bg-white/5"><Upload className="h-5 w-5 shrink-0 text-violet-600" /><span><span className="block">Selecionar etiquetas dos produtos</span><span className="mt-1 block text-xs font-normal text-slate-500">{itemLabelCount ? `${itemLabelCount} arquivo(s) selecionado(s) de ${items.length}` : `Selecione os ${items.length} arquivo(s) de uma vez.`}</span></span><input name="itemLabels" required multiple type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setItemLabelCount(event.target.files?.length ?? 0)} className="ml-auto max-w-[170px] text-xs" /></label><div className="space-y-1 text-xs text-slate-500">{items.map((item, index) => <div key={item.key} className="flex items-center justify-between gap-3"><span className="truncate">{index + 1}. {item.name}</span><span className="shrink-0">{item.quantity} un</span></div>)}</div></section> : null}
          <label className="block text-xs font-bold text-slate-500">Observações<textarea name="observacoes" className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-white/10"><button onClick={onClose} type="button" className="h-12 rounded-xl border border-slate-200 px-5 text-sm font-bold dark:border-white/10">Cancelar</button><SubmitButton /></footer>
      </form>
      {state.status !== "idle" ? <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/55 p-6"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#101c2e]"><div className={state.status === "success" ? "text-emerald-500" : "text-rose-500"}>{state.status === "success" ? <Check className="h-9 w-9" /> : <CircleAlert className="h-9 w-9" />}</div><h3 className="mt-3 text-lg font-extrabold">{state.status === "success" ? "Remessa Full criada" : "Não foi possível criar"}</h3><p className="mt-2 text-sm text-slate-500">{state.detail}</p>{state.status === "error" ? <button type="button" onClick={() => window.location.reload()} className="mt-5 h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">Fechar</button> : null}</div></div> : null}
    </aside>
  </div>;
}

function Attachment({ field, label }: { field: string; label: string }) {
  const [file, setFile] = useState<File | null>(null);
  const inputId = `full-attachment-${field}`;
  const attached = Boolean(file);

  return (
    <label
      htmlFor={inputId}
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        attached
          ? "border-emerald-400 bg-emerald-50 text-emerald-800 hover:border-emerald-500 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:border-emerald-400"
          : "border-rose-400 bg-rose-50/60 text-rose-800 hover:border-rose-500 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:border-rose-400"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {attached ? <Check className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <Upload className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />}
        <span className="min-w-0">
          <span className="block">{label}</span>
          <span className={`mt-1 block text-xs font-semibold ${attached ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
            {attached ? "Arquivo anexado" : "Anexar arquivo"}
          </span>
        </span>
      </span>
      {file ? <span className="max-w-[180px] truncate text-xs font-medium text-emerald-700 dark:text-emerald-200">{file.name}</span> : null}
      <input
        id={inputId}
        required
        name={field}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="sr-only"
      />
    </label>
  );
}
