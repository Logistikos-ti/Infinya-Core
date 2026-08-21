"use client";

import {
  Barcode,
  Boxes,
  Info,
  Layers3,
  MapPin,
  Package,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
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

function formatQuantity(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function displayValue(value: string | null | undefined, fallback = "Não informado") {
  const normalized = value?.trim();
  return normalized || fallback;
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

function DetailField({
  icon: Icon,
  label,
  value,
  wide = false,
}: {
  icon: typeof Info;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.04] ${wide ? "col-span-2" : ""}`}
    >
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <p className="mt-2 break-words text-sm font-bold text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

export function ProductStockCard({
  item,
}: {
  item: StockBalance;
  canManage?: boolean;
}) {
  const physical = Number(item.rawQuantidade ?? 0);
  const reserved = Number(item.rawReserved ?? 0);
  const available = Number(item.rawAvailable ?? 0);
  const configuredMinimum = Number(item.minQuantity ?? 0);
  const configuredMaximum = Number(item.maxQuantity ?? 0);
  const displayMaximum =
    configuredMaximum > 0
      ? configuredMaximum
      : Math.max(configuredMinimum * 5, available, 100);
  const [open, setOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const fillPercentage = `${Math.min(
    100,
    Math.round((available / Math.max(displayMaximum, 1)) * 100),
  )}%`;
  const badge = stockBadge(available, configuredMinimum);
  const health = stockHealth(
    available,
    configuredMinimum,
    configuredMaximum,
  );

  function openDetails() {
    setOpen(true);
    requestAnimationFrame(() => setDrawerVisible(true));
  }

  function closeDetails() {
    setDrawerVisible(false);
    window.setTimeout(() => setOpen(false), 220);
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
              {formatQuantity(available)} un
            </strong>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Min {formatQuantity(configuredMinimum)}</span>
            <span>Máx {formatQuantity(displayMaximum)}</span>
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
          <button
            type="button"
            onClick={openDetails}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:-translate-y-0.5 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:bg-violet-500/10 dark:hover:text-white"
            title="Ver informações do produto"
            aria-label={`Ver informações de ${item.productName ?? "produto"}`}
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </article>

      {open ? (
        <div
          className={`fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-200 ${
            drawerVisible ? "opacity-100" : "opacity-0"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Informações do produto"
        >
          <div
            className={`flex h-full w-full max-w-[470px] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-white/10 dark:bg-[#101b30] ${
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
                    {item.sku || "Sem SKU"} · {item.withdrawalMethod}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:border-violet-300 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:text-white"
                aria-label="Fechar informações do produto"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <section>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-slate-950 dark:text-white">
                    Posição do estoque
                  </h4>
                  <span
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${statusClasses[badge.tone]}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-slate-200 p-3 dark:border-white/10">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Físico
                    </span>
                    <strong className="mt-1 block text-lg text-slate-950 dark:text-white">
                      {formatQuantity(physical)} un
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <span className="text-[11px] text-amber-700 dark:text-amber-300">
                      Reservado
                    </span>
                    <strong className="mt-1 block text-lg text-amber-600 dark:text-amber-300">
                      {formatQuantity(reserved)} un
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Disponível
                    </span>
                    <strong className="mt-1 block text-lg text-emerald-600 dark:text-emerald-300">
                      {formatQuantity(available)} un
                    </strong>
                  </div>
                </div>
              </section>

              <section className="mt-7">
                <h4 className="text-sm font-extrabold text-slate-950 dark:text-white">
                  Identificação
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <DetailField icon={Barcode} label="SKU" value={displayValue(item.sku, "Sem SKU")} />
                  <DetailField icon={Boxes} label="Depositante" value={displayValue(item.depositante)} wide />
                  <DetailField icon={Layers3} label="Método" value={item.withdrawalMethod} />
                  <DetailField icon={ShieldCheck} label="Status" value={displayValue(item.status)} />
                </div>
              </section>

              <section className="mt-7">
                <h4 className="text-sm font-extrabold text-slate-950 dark:text-white">
                  Armazenagem e rastreabilidade
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <DetailField icon={MapPin} label="Endereço" value={displayValue(item.endereco, "Sem endereço")} wide />
                </div>
              </section>

              <section className="mt-7 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-950 dark:text-white">
                      Limites de estoque
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Mínimo {formatQuantity(configuredMinimum)} · Máximo {formatQuantity(displayMaximum)}
                    </p>
                  </div>
                  <strong className={`text-right text-xs ${healthClasses[health.tone]}`}>
                    {health.label}
                  </strong>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all"
                    style={{ width: fillPercentage }}
                  />
                </div>
              </section>

              {item.blockReason ? (
                <section className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-rose-600 dark:text-rose-300">
                    Motivo do bloqueio
                  </p>
                  <p className="mt-2 text-sm text-rose-700 dark:text-rose-200">
                    {item.blockReason}
                  </p>
                </section>
              ) : null}
            </div>

            <footer className="mt-auto border-t border-slate-200 p-5 dark:border-white/10">
              <button
                type="button"
                onClick={closeDetails}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
