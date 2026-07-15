"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle, PackageCheck } from "lucide-react";
import { beginPickingWaveAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import type { ShippingPickingOrder } from "@/lib/shipping-picking";
import { cn } from "@/lib/utils";

type ShippingPickingWaveSelectorProps = {
  orders: ShippingPickingOrder[];
};

export function ShippingPickingWaveSelector({
  orders,
}: ShippingPickingWaveSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id)),
    [orders, selectedIds],
  );
  const selectedUnits = selectedOrders.reduce((sum, order) => sum + order.totalUnits, 0);
  const selectedItems = selectedOrders.reduce((sum, order) => sum + order.totalItems, 0);

  function toggleOrder(orderId: string) {
    setSelectedIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-primary-500/20 bg-primary-500/10 px-5 py-4 shadow-sm dark:bg-primary-500/8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-700 dark:text-primary-300">
              Onda de separacao
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">
              Monte a lista antes de liberar a coleta
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
              Clique em <strong>Separar</strong> nos pedidos desejados. Quando terminar a selecao,
              inicie a separacao consolidada da onda.
            </p>
          </div>

          <form action={beginPickingWaveAction} className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200">
              {selectedOrders.length} pedido(s)
            </span>
            <span className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200">
              {selectedItems} item(ns)
            </span>
            <span className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200">
              {selectedUnits} unidade(s)
            </span>
            {selectedIds.map((orderId) => (
              <input key={orderId} type="hidden" name="orderId" value={orderId} />
            ))}
            <button
              type="submit"
              disabled={!selectedIds.length}
              className={cn(
                "inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-bold transition-all",
                selectedIds.length
                  ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20 hover:-translate-y-0.5 hover:bg-primary-600"
                  : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600",
              )}
            >
              Iniciar separacao
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        {orders.map((order) => {
          const isSelectable = order.status === "NOVO";
          const isSelected = selectedIds.includes(order.id);
          const href =
            order.status === "SEPARADO" || order.status === "EM_CONFERENCIA"
              ? `/expedicao/conferencia/${order.id}`
              : `/expedicao/separacao/${order.id}`;

          return (
            <article
              key={order.id}
              className={cn(
                "glass-card group rounded-2xl p-5 transition-all hover:border-primary-500/30",
                isSelected && "border-primary-500/50 ring-2 ring-primary-500/20",
              )}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                        order.status === "NOVO"
                          ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          : order.status === "EM_SEPARACAO"
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : order.status === "SEPARADO"
                              ? "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {order.statusLabel}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {order.depositante}
                    </span>
                  </div>

                  <h2 className="mt-3 text-lg font-bold text-slate-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                    {order.displayNumber}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
                    {order.customer} <span className="px-1 text-slate-300 dark:text-zinc-600">-</span>{" "}
                    {order.destination}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-zinc-500">
                    <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                      Plataforma: {order.externalNumber}
                    </span>
                    <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                      Código técnico: {order.code}
                    </span>
                    <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                      Criado em: {order.createdAt}
                    </span>
                    <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                      {order.totalItems} item(ns)
                    </span>
                    <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                      {order.totalUnits} unidade(s)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {isSelectable ? (
                    <button
                      type="button"
                      onClick={() => toggleOrder(order.id)}
                      className={cn(
                        "inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold transition-all",
                        isSelected
                          ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600"
                          : "border border-primary-500/20 bg-white text-primary-700 hover:-translate-y-0.5 hover:border-primary-500 hover:bg-primary-50 dark:bg-zinc-900 dark:text-primary-300 dark:hover:bg-zinc-800",
                      )}
                    >
                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      {isSelected ? "Selecionado" : "Separar"}
                    </button>
                  ) : (
                    <Link
                      href={href}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-5 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition-all hover:-translate-y-0.5 hover:bg-primary-600"
                    >
                      <PackageCheck className="h-4 w-4" />
                      {order.status === "SEPARADO"
                        ? "Iniciar conferencia"
                        : order.status === "EM_CONFERENCIA"
                          ? "Continuar conferencia"
                          : "Continuar"}
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
