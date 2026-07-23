"use client";

import { Settings2, Package } from "lucide-react";
import { useState } from "react";
import type { StockBalance } from "@/lib/stock";

export function ProductStockCard({ item }: { item: StockBalance }) {
  const quantity = Number(item.rawQuantidade ?? 0);
  const [minimum, setMinimum] = useState(Number(item.minQuantity ?? 0));
  const [maximum, setMaximum] = useState(
    Math.max(
      Number(item.maxQuantity ?? 0),
      Number(item.minQuantity ?? 0),
      quantity,
      1,
    ),
  );
  const [open, setOpen] = useState(false);
  const [draftMinimum, setDraftMinimum] = useState(String(minimum));
  const [draftMaximum, setDraftMaximum] = useState(String(maximum));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fillPercentage = `${Math.min(100, Math.round((quantity / Math.max(maximum, 1)) * 100))}%`;
  const stockStatus =
    quantity === 0
      ? { label: "Sem estoque", tone: "rose" }
      : quantity <= minimum
        ? { label: "Atenção", tone: "amber" }
        : { label: "Monitorado", tone: "emerald" };
  const statusClasses = {
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  }[stockStatus.tone];

  function openSettings() {
    setDraftMinimum(String(minimum));
    setDraftMaximum(String(maximum));
    setError("");
    setOpen(true);
  }

  async function saveSettings() {
    const nextMinimum = Number(draftMinimum);
    const nextMaximum = Number(draftMaximum);
    if (
      !Number.isFinite(nextMinimum) ||
      nextMinimum < 0 ||
      !Number.isFinite(nextMaximum) ||
      nextMaximum < nextMinimum ||
      nextMaximum <= 0
    ) {
      setError("O máximo deve ser maior ou igual ao mínimo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/produtos/${item.id}/limites`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minimum: nextMinimum, maximum: nextMaximum }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? "Não foi possível salvar os limites.");
      setMinimum(nextMinimum);
      setMaximum(nextMaximum);
      setOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar os limites.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-[18px] shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white ${item.imageUrl ? "bg-white ring-1 ring-slate-200 dark:bg-white dark:ring-slate-200" : "bg-gradient-to-br from-blue-500 to-violet-500"}`}
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={`Foto de ${item.productName}`}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            ) : (
              <Package className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {item.productName ?? "Produto"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {item.sku || "Sem código"}
            </p>
          </div>
        </div>
        <div className="flex items-end justify-between border-t border-slate-100 pt-3 dark:border-white/10">
          <div>
            <p
              className={`font-display text-[22px] font-bold ${quantity <= minimum ? "text-amber-500" : ""}`}
            >
              {quantity}
            </p>
            <p className="text-[11px] text-slate-500">disponível</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClasses}`}
          >
            {stockStatus.label}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Min {minimum}</span>
              <span>Máx {maximum}</span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                style={{ width: fillPercentage }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-violet-400 hover:text-violet-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
            title="Configurar estoque"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Configurar estoque"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#101b30]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-violet-500">
                  Estoque
                </p>
                <h3 className="mt-1 font-display text-lg font-bold">
                  Configurar limites
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {item.productName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-slate-400"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-slate-500">
                Mínimo
                <input
                  type="number"
                  min="0"
                  value={draftMinimum}
                  onChange={(event) => setDraftMinimum(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                Máximo
                <input
                  type="number"
                  min="1"
                  value={draftMaximum}
                  onChange={(event) => setDraftMaximum(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5"
                />
              </label>
            </div>
            {error ? (
              <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-white/10 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar limites"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
