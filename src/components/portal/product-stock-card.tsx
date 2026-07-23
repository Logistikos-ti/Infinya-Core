"use client";

import { Settings2, Package } from "lucide-react";
import { useState } from "react";
import type { StockBalance } from "@/lib/stock";

export function ProductStockCard({ item }: { item: StockBalance }) {
  const quantity = Number(item.rawQuantidade ?? 0);
  const configuredMaximum = Number(item.maxQuantity ?? 0);
  const configuredMinimum = Number(item.minQuantity ?? 0);
  const [minimum, setMinimum] = useState(configuredMinimum);
  const [maximum, setMaximum] = useState(
    configuredMaximum > 0
      ? configuredMaximum
      : Math.max(configuredMinimum * 5, 100),
  );
  const [open, setOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [draftMinimum, setDraftMinimum] = useState(String(minimum));
  const [draftMaximum, setDraftMaximum] = useState(String(maximum));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fillPercentage = `${Math.min(100, Math.round((quantity / Math.max(maximum, 1)) * 100))}%`;
  const draftMaxNumber = Math.max(Number(draftMaximum) || 1, 1);
  const draftFillPercentage = `${Math.min(100, Math.round((quantity / draftMaxNumber) * 100))}%`;
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
    requestAnimationFrame(() => setDrawerVisible(true));
  }

  function closeSettings() {
    setDrawerVisible(false);
    window.setTimeout(() => setOpen(false), 220);
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
      closeSettings();
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

  function adjustDraftMinimum(delta: number) {
    setDraftMinimum(String(Math.max(0, Number(draftMinimum || 0) + delta)));
  }

  function adjustDraftMaximum(delta: number) {
    setDraftMaximum(String(Math.max(1, Number(draftMaximum || 1) + delta)));
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
          className={`fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-200 ${drawerVisible ? "opacity-100" : "opacity-0"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Configurar estoque"
        >
          <div
            className={`flex h-full w-full max-w-[430px] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-white/10 dark:bg-[#101b30] ${drawerVisible ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white ${item.imageUrl ? "bg-white ring-1 ring-slate-200" : "bg-gradient-to-br from-blue-500 to-violet-500"}`}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Package className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
                    {item.productName ?? "Produto"}
                  </h3>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {item.sku || "Sem código"} · {quantity} em estoque
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSettings}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl leading-none text-slate-500 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/30 dark:hover:text-white"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-7">
              <p className="text-sm leading-5 text-slate-500 dark:text-slate-400">
                Defina os limites de estoque. Abaixo do{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  mínimo
                </strong>{" "}
                geramos alerta de reposição; acima do{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  máximo
                </strong>{" "}
                avisamos sobre excesso.
              </p>
              <div className="mt-6">
                <label className="text-xs font-bold text-amber-600">
                  Estoque mínimo
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustDraftMinimum(-1)}
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-800 transition hover:border-blue-400 dark:border-white/10 dark:text-white"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={draftMinimum}
                    onChange={(event) => setDraftMinimum(event.target.value)}
                    className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-base font-bold text-slate-800 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => adjustDraftMinimum(1)}
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-800 transition hover:border-blue-400 dark:border-white/10 dark:text-white"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-5">
                <label className="text-xs font-bold text-emerald-600">
                  Estoque máximo
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustDraftMaximum(-1)}
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-800 transition hover:border-blue-400 dark:border-white/10 dark:text-white"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={draftMaximum}
                    onChange={(event) => setDraftMaximum(event.target.value)}
                    className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-base font-bold text-slate-800 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => adjustDraftMaximum(1)}
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-800 transition hover:border-blue-400 dark:border-white/10 dark:text-white"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>0</span>
                  <strong className="text-slate-800 dark:text-white">
                    Atual: {quantity}
                  </strong>
                  <span>{draftMaxNumber}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: draftFillPercentage }}
                  />
                </div>
                <p className="mt-3 text-xs font-bold text-emerald-600">
                  {quantity <= 0
                    ? "Sem estoque"
                    : quantity < Number(draftMinimum || 0)
                      ? "Abaixo do mínimo"
                      : quantity > draftMaxNumber
                        ? "Acima do máximo"
                        : "Dentro da faixa ideal"}
                </p>
              </div>
              {error ? (
                <p className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600">
                  {error}
                </p>
              ) : null}
            </div>
            <div className="mt-auto flex gap-3 border-t border-slate-200 p-5 dark:border-white/10">
              <button
                type="button"
                onClick={closeSettings}
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="h-12 flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 disabled:opacity-60"
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
