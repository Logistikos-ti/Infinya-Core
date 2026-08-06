"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import type { ShippingReconciliationRow } from "@/lib/shipping-stock-reconciliation";

type ReconciliationData = { cutoff: string; rows: ShippingReconciliationRow[] };

const statusStyle = {
  PENDENTE: { label: "Pendente", color: "#B45309", bg: "#FEF3C7" },
  JA_BAIXADO: { label: "Já baixado", color: "#047857", bg: "#D1FAE5" },
  REVISAR_MANUAL: { label: "Revisar manual", color: "#B91C1C", bg: "#FEE2E2" },
};

export function ShippingStockReconciliationClient({ initialData }: { initialData: ReconciliationData }) {
  const [data, setData] = useState(initialData);
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const pendingRows = useMemo(() => data.rows.filter((item) => item.situacao === "PENDENTE"), [data.rows]);

  async function refresh() {
    const response = await fetch("/api/estoque/conciliacao-pedidos", { cache: "no-store" });
    const payload = (await response.json()) as ReconciliationData & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar a prévia.");
    setData(payload);
    setSelected([]);
  }

  function applySelected() {
    if (!selected.length || !window.confirm(`Aplicar baixa física retroativa em ${selected.length} pedido(s)?`)) return;
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/estoque/conciliacao-pedidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds: selected }),
        });
        const payload = (await response.json()) as { message?: string; error?: string; results?: Array<{ ok: boolean; message?: string }> };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível aplicar a conciliação.");
        const failed = payload.results?.filter((item) => !item.ok) ?? [];
        setNotice({
          type: failed.length ? "error" : "success",
          text: failed.length ? `${payload.message} ${failed.length} pedido(s) ficaram pendentes por saldo insuficiente.` : payload.message ?? "Conciliação concluída.",
        });
        await refresh();
      } catch (error) {
        setNotice({ type: "error", text: error instanceof Error ? error.message : "Falha ao aplicar a conciliação." });
      }
    });
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className="min-h-full bg-slate-50 px-5 py-7 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/estoque" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950 dark:hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Voltar ao estoque
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Conciliação administrativa</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Baixas posteriores ao inventário</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">Prévia dos pedidos concluídos após a contagem de 05/08. Saídas manuais compatíveis ficam bloqueadas para evitar duplicidade.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => startTransition(() => { refresh().catch((error) => setNotice({ type: "error", text: error.message })); })} disabled={isPending} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900">
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} /> Atualizar
            </button>
            <button type="button" onClick={applySelected} disabled={!selected.length || isPending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45">
              <ShieldCheck className="h-4 w-4" /> Aplicar baixa ({selected.length})
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <Summary label="Pendentes" value={pendingRows.length} tone="amber" />
          <Summary label="Já conciliados" value={data.rows.filter((item) => item.situacao === "JA_BAIXADO").length} tone="emerald" />
          <Summary label="Revisão manual" value={data.rows.filter((item) => item.situacao === "REVISAR_MANUAL").length} tone="rose" />
        </div>

        {notice ? <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"}`}>{notice.text}</div> : null}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800"><AlertTriangle className="h-5 w-5 text-amber-500" /><div><h2 className="font-bold">Prévia antes da baixa</h2><p className="text-xs text-slate-500">Selecione somente pedidos marcados como pendentes.</p></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/50"><tr><th className="w-12 px-5 py-4"><input aria-label="Selecionar pendentes" type="checkbox" checked={pendingRows.length > 0 && selected.length === pendingRows.length} onChange={(event) => setSelected(event.target.checked ? pendingRows.map((item) => item.id) : [])} /></th><th className="px-4 py-4">Pedido</th><th className="px-4 py-4">NF</th><th className="px-4 py-4">Depositante</th><th className="px-4 py-4">Itens</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Resultado</th></tr></thead><tbody>{data.rows.map((row) => { const tag = statusStyle[row.situacao]; const selectable = row.situacao === "PENDENTE"; return <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-5 py-4"><input aria-label={`Selecionar ${row.codigo}`} type="checkbox" disabled={!selectable} checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /></td><td className="px-4 py-4"><p className="font-bold">{row.codigo}</p><p className="text-xs text-slate-500">Externo: {row.pedidoExterno}</p></td><td className="px-4 py-4 font-semibold">{row.notaFiscal}</td><td className="px-4 py-4">{row.depositante}</td><td className="px-4 py-4">{row.itens} item(ns) · {row.unidades} un</td><td className="px-4 py-4">{row.status === "EXPEDIDO" ? "Expedido" : "Pronto para coleta"}</td><td className="px-4 py-4"><span style={{ background: tag.bg, color: tag.color }} className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold">{tag.label}</span><p className="mt-1 max-w-xs text-xs text-slate-500">{row.detalhe}</p></td></tr>; })}</tbody></table></div>
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: "amber" | "emerald" | "rose" }) {
  const palette = { amber: "border-amber-200 bg-amber-50 text-amber-800", emerald: "border-emerald-200 bg-emerald-50 text-emerald-800", rose: "border-rose-200 bg-rose-50 text-rose-800" }[tone];
  return <div className={`rounded-2xl border p-4 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 ${palette}`}><p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>;
}
