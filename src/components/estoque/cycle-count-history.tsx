"use client";

import Link from "next/link";
import { ClipboardCheck, ArrowRight, CheckCircle2, Download } from "lucide-react";
import type { CycleCountSummary } from "@/lib/stock-cycle-counts";

export function CycleCountHistory({ items }: { items: CycleCountSummary[] }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
        <ClipboardCheck className="h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-semibold text-slate-950 dark:text-white">Nenhum inventário no histórico</p>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Quando um inventário for concluído, ele aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400">
            <tr>
              <th className="px-6 py-4 font-medium">Título</th>
              <th className="px-6 py-4 font-medium">Depositante / Área</th>
              <th className="px-6 py-4 font-medium">Progresso</th>
              <th className="px-6 py-4 font-medium">Divergentes</th>
              <th className="px-6 py-4 font-medium text-right">Data</th>
              <th className="px-6 py-4 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.titulo}</p>
                    {item.blindCount && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        CEGA
                      </span>
                    )}
                    {item.type === "GERAL" && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        GERAL
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Concluído
                  </p>
                </td>
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-900 dark:text-slate-200">{item.depositante}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.area}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full bg-emerald-500"
                          style={{
                            width: `${Math.min(100, Math.round((item.countedItems / Math.max(1, item.totalItems)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {item.countedItems}/{item.totalItems}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {item.divergentItems > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      {item.divergentItems} divergente{item.divergentItems > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-slate-600 dark:text-slate-300">{item.createdAt}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  {item.type === "GERAL" ? (
                    <a
                      href={`/api/estoque/inventarios-gerais/${item.id}/relatorio`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-full bg-white p-2 text-slate-400 shadow-sm ring-1 ring-inset ring-slate-200 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-900 dark:ring-white/10 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-400"
                      title="Baixar Relatório (CSV)"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  ) : (
                    <Link
                      href={`/estoque/inventarios/${item.id}`}
                      className="inline-flex items-center justify-center rounded-full bg-white p-2 text-slate-400 shadow-sm ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:bg-zinc-900 dark:ring-white/10 dark:hover:bg-zinc-800 dark:hover:text-white"
                      title="Ver Detalhes"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
