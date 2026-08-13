"use client";

import { Package, Settings2, X } from "lucide-react";
import { useState } from "react";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import type { StockBalance } from "@/lib/stock";

type StockTone = "rose" | "amber" | "emerald";

const statusClasses: Record<StockTone, string> = {
  rose: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  amber:
    "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  emerald:
    "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const healthClasses: Record<StockTone, string> = {
  rose: "text-rose-600 dark:text-rose-300",
  amber: "text-amber-600 dark:text-amber-300",
  emerald: "text-emerald-600 dark:text-emerald-300",
};

function stockHealth(quantity: number, minimum: number, maximum: number) {
  if (quantity <= 0) return { label: "Sem estoque", tone: "rose" as StockTone };
  if (minimum > 0 && quantity < minimum) {
    return { label: "Abaixo do mínimo", tone: "amber" as StockTone };
  }
  if (maximum > 0 && quantity > maximum) {
    return { label: "Acima do máximo", tone: "amber" as StockTone };
  }
  return { label: "Dentro da faixa ideal", tone: "emerald" as StockTone };
}

function stockBadge(quantity: number, minimum: number) {
  if (quantity <= 0) return { label: "Sem estoque", tone: "rose" as StockTone };
  if (minimum > 0 && quantity <= minimum) {
    return { label: "Atenção", tone: "amber" as StockTone };
  }
  return { label: "Ativo", tone: "emerald" as StockTone };
}

function ProductImage({
  item,
  size = "large",
}: {
  item: StockBalance;
  size?: "large" | "small";
}) {
  const dimension = size === "large" ? "h-16 w-16" : "h-12 w-12";

  return (
    <div
      className={`flex ${dimension} shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 text-white dark:bg-white/5`}
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={`Foto de ${item.productName ?? "produto"}`}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-violet-500">
          <Package className="h-6 w-6" />
        </span>
      )}
    </div>
  );
}

export function ProductStockCard({
  item,
  canManage = true,
}: {
  item: StockBalance;
  canManage?: boolean;
}) {
  const quantity = Number(item.rawQuantidade ?? 0);
  const configuredMaximum = Number(item.maxQuantity ?? 0);
  const configuredMinimum = Number(item.minQuantity ?? 0);
  const initialMaximum =
    configuredMaximum > 0
      ? configuredMaximum
      : Math.max(configuredMinimum * 5, quantity, 100);
  const [minimum, setMinimum] = useState(configuredMinimum);
  const [maximum, setMaximum] = useState(initialMaximum);
  const [open, setOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [draftMinimum, setDraftMinimum] = useState(String(configuredMinimum));
  const [draftMaximum, setDraftMaximum] = useState(String(initialMaximum));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fillPercentage = `${Math.min(
    100,
    Math.round((quantity / Math.max(maximum, 1)) * 100),
  )}%`;
  const draftMinimumNumber = Math.max(Number(draftMinimum) || 0, 0);
  const draftMaxNumber = Math.max(Number(draftMaximum) || 1, 1);
  const draftFillPercentage = `${Math.min(
    100,
    Math.round((quantity / draftMaxNumber) * 100),
  )}%`;
  const badge = stockBadge(quantity, minimum);
  const health = stockHealth(quantity, minimum, maximum);
  const draftHealth = stockHealth(quantity, draftMinimumNumber, draftMaxNumber);

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

      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível salvar os limites.");
      }

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
      <article className="group relative flex min-h-[236px] flex-col rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-500/10 dark:border-white/10 dark:bg-[#101b30]">
        <div className="flex items-start justify-between gap-4">
          <ProductImage item={item} />
          <span
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${statusClasses[badge.tone]}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="mt-4 min-h-[58px]">
          <h3 className="line-clamp-2 text-[15px] font-extrabold leading-5 text-slate-950 dark:text-white">
            {item.productName ?? "Produto"}
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {item.sku || item.internalCode || "Sem código"}
          </p>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Disponível
            </span>
            <strong
              className={`font-display text-2xl ${badge.tone === "rose" ? "text-rose-500" : badge.tone === "amber" ? "text-amber-500" : "text-slate-950 dark:text-white"}`}
            >
              {quantity} un
            </strong>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Min {minimum}</span>
            <span>Máx {maximum}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all"
              style={{ width: fillPercentage }}
            />
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 dark:border-white/10">
          <span className={`text-xs font-bold ${healthClasses[health.tone]}`}>
            {health.label}
          </span>
          {canManage ? (
            <button
              type="button"
              onClick={openSettings}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:-translate-y-0.5 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:bg-violet-500/10 dark:hover:text-white"
              title="Configurar limites"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </article>

      {open ? (
        <div
          className={`fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-200 ${
            drawerVisible ? "opacity-100" : "opacity-0"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Configurar limites de estoque"
        >
          <div
            className={`flex h-full w-full max-w-[430px] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-white/10 dark:bg-[#101b30] ${
              drawerVisible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-6 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-3">
                <ProductImage item={item} size="small" />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-slate-950 dark:text-white">
                    {item.productName ?? "Produto"}
                  </h3>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {item.sku || item.internalCode || "Sem código"} · {quantity}{" "}
                    em estoque
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSettings}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:border-violet-300 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-7">
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
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
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-blue-400 dark:border-white/10 dark:text-white"
                  >
                    -
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
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-blue-400 dark:border-white/10 dark:text-white"
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
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-blue-400 dark:border-white/10 dark:text-white"
                  >
                    -
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
                    className="flex h-12 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-blue-400 dark:border-white/10 dark:text-white"
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
                <p
                  className={`mt-3 text-xs font-bold ${healthClasses[draftHealth.tone]}`}
                >
                  {draftHealth.label}
                </p>
              </div>

              {error ? (
                <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
                  {error}
                </p>
              ) : null}
            </div>

            <footer className="mt-auto flex gap-3 border-t border-slate-200 p-5 dark:border-white/10">
              <button
                type="button"
                onClick={closeSettings}
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="h-12 flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
              >
                {saving ? <MobileButtonSpinner /> : "Salvar limites"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
