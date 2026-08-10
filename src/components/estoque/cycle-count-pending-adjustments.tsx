"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronRight, MapPin, Search, TriangleAlert, UserRound } from "lucide-react";
import type { PendingCycleCountAdjustment } from "@/lib/stock-cycle-counts";

type SortMode = "queue" | "largest" | "product";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function numberValue(value: string) {
  return Number(value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "")) || 0;
}

export function CycleCountPendingAdjustments({ items }: { items: PendingCycleCountAdjustment[] }) {
  const [query, setQuery] = useState("");
  const [depositante, setDepositante] = useState("Todos");
  const [sortMode, setSortMode] = useState<SortMode>("queue");
  const depositantes = useMemo(() => ["Todos", ...Array.from(new Set(items.map((item) => item.depositante))).sort()], [items]);
  const filteredItems = useMemo(() => {
    const term = normalized(query.trim());
    const filtered = items.filter((item) => {
      const content = [item.titulo, item.depositante, item.sku, item.productName, item.endereco, item.area].join(" ");
      return (depositante === "Todos" || item.depositante === depositante) && (!term || normalized(content).includes(term));
    });
    if (sortMode === "largest") return [...filtered].sort((a, b) => Math.abs(numberValue(b.divergence)) - Math.abs(numberValue(a.divergence)));
    if (sortMode === "product") return [...filtered].sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR"));
    return filtered;
  }, [depositante, items, query, sortMode]);
  const divergentUnits = items.reduce((total, item) => total + Math.abs(numberValue(item.divergence)), 0);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Summary label="Divergências encontradas" value={String(items.length)} detail="linhas com ajuste automático" tone="amber" />
        <Summary label="Impacto da contagem" value={new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(divergentUnits)} detail="unidades divergentes" tone="violet" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="border-b border-slate-200 p-4 dark:border-zinc-800 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-base font-semibold text-slate-950 dark:text-white">Consulta de divergências</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Os ajustes já foram aplicados automaticamente após a contagem.</p></div>
            <label className="relative block w-full lg:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar SKU, produto ou endereço" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-white" /></label>
          </div>
          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">{depositantes.map((option) => <button key={option} type="button" onClick={() => setDepositante(option)} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${depositante === option ? "border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-400/50 dark:bg-cyan-400/10 dark:text-cyan-200" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300 dark:hover:text-white"}`}>{option}</button>)}</div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"><ArrowUpDown className="h-4 w-4 text-slate-400" /><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"><option value="queue">Ordem da fila</option><option value="largest">Maior divergência</option><option value="product">Produto A-Z</option></select></label>
          </div>
        </div>
        {filteredItems.length === 0 ? <div className="px-6 py-14 text-center"><Search className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 font-semibold text-slate-900 dark:text-white">Nenhuma pendência encontrada</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ajuste a busca ou o filtro de depositante.</p></div> : <div className="divide-y divide-slate-100 dark:divide-zinc-800">{filteredItems.map((item) => <Link key={item.itemId} href={`/estoque/inventarios/${item.cycleCountId}`} className="group block px-4 py-4 transition hover:bg-slate-50 dark:hover:bg-zinc-800/40 sm:px-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"><TriangleAlert className="h-3.5 w-3.5" />Divergência</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">{item.depositante}</span><span className="text-xs text-slate-500 dark:text-slate-400">{item.titulo}</span></div><p className="mt-3 truncate text-sm font-bold text-slate-950 dark:text-white">{item.productName}</p><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold text-slate-600 dark:text-slate-300">SKU {item.sku}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.endereco} · {item.area}</span></div></div><div className="grid grid-cols-2 gap-3 sm:min-w-[310px]"><Metric label="Saldo do sistema" value={item.systemQuantity} /><Metric label="Quantidade contada" value={item.countedQuantity} /></div><div className="flex min-w-[190px] items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300"><UserRound className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.countedBy}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.countedAt}</p></div><ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-500" /></div></div><div className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">Divergência: {item.divergence}</div></Link>)}</div>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/30"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{value}</p></div>; }
function Summary({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "amber" | "violet" }) { const style = tone === "amber" ? "border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200" : "border-violet-200 bg-violet-50/70 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-200"; return <div className={`rounded-2xl border px-5 py-4 ${style}`}><p className="text-sm font-semibold">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-1 text-xs opacity-80">{detail}</p></div>; }
