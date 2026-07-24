"use client";

import { ArrowRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { ShippingOrderSummary } from "@/lib/shipping";

const filters = [
  { label: "Todos", value: "" },
  { label: "Recebido", value: "Recebido" },
  { label: "Em separação", value: "Em separação" },
  { label: "Expedido", value: "Expedido" },
  { label: "Cancelado", value: "Cancelado" },
] as const;

export function PortalOrdersView({ orders }: { orders: ShippingOrderSummary[] }) {
  const [activeFilter, setActiveFilter] = useState("");
  const visibleOrders = useMemo(
    () => orders.filter((order) => matchesFilter(order, activeFilter)),
    [activeFilter, orders],
  );

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-[27px] font-bold tracking-tight text-slate-950 dark:text-white">
            Meus pedidos
          </h1>
          <p className="m-0 text-[14.5px] text-slate-500 dark:text-slate-400">
            Pedidos enviados ao CD para separação e expedição.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-[11px] bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/20 transition-transform hover:-translate-y-px"
        >
          <Plus className="h-4 w-4" />
          Novo pedido
        </button>
      </div>

      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        {filters.map((filter) => {
          const active = activeFilter === filter.value;
          const count = orders.filter((order) => matchesFilter(order, filter.value)).length;
          return (
            <button
              key={filter.label}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveFilter(filter.value)}
              className={`inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-[9px] border px-3.5 text-[13px] font-bold transition-all ${active ? "border-transparent text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
              style={active ? { background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" } : undefined}
            >
              {filter.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-[11px] leading-none"
                className={active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"}
              >
                {count}
              </span>
            </button>
          );
        })}
        <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400">
          {visibleOrders.length} pedidos
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101b30]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr>
                {["Pedido", "Cliente", "Canal", "Itens", "Criado", "Status", ""].map((label) => (
                  <th
                    key={label || "action"}
                    className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-5 py-[13px] text-[12px] font-bold uppercase tracking-[0.04em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
        {!visibleOrders.length ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum pedido encontrado.
          </div>
        ) : null}
      </div>
    </>
  );
}

function matchesFilter(order: ShippingOrderSummary, filter: string) {
  if (!filter) return true;
  if (filter === "Recebido") return order.status === "NOVO";
  if (filter === "Em separação") {
    return ["EM_SEPARACAO", "SEPARADO", "EM_CONFERENCIA"].includes(order.status);
  }
  if (filter === "Expedido") return order.status === "EXPEDIDO";
  if (filter === "Cancelado") return order.status === "CANCELADO";
  return false;
}

function OrderRow({ order }: { order: ShippingOrderSummary }) {
  return (
    <tr className="cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.04]">
      <td className="px-5 py-[14px] font-display text-sm font-bold">{order.displayNumber || order.id}</td>
      <td className="px-5 py-[14px]">
        <div className="flex flex-col gap-0.5">
          <span className="max-w-[200px] truncate text-sm font-semibold">{order.customer || "Cliente não informado"}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{order.destination || "Destino não informado"}</span>
        </div>
      </td>
      <td className="px-5 py-[14px] text-[13.5px] font-semibold">{order.marketplace || order.channel || "Operação própria"}</td>
      <td className="px-5 py-[14px] font-display text-sm font-semibold">{order.itemCount} item{order.itemCount === 1 ? "" : "s"}</td>
      <td className="px-5 py-[14px] text-[13px] text-slate-500 dark:text-slate-400">{formatDate(order.createdAt)}</td>
      <td className="px-5 py-[14px]"><StatusBadge label={order.statusLabel || order.status} /></td>
      <td className="px-5 py-[14px] text-right text-slate-400"><ArrowRight className="ml-auto h-4 w-4" /></td>
    </tr>
  );
}

function StatusBadge({ label }: { label: string }) {
  const normalized = label.toLocaleLowerCase("pt-BR");
  const color = normalized.includes("cancel")
    ? { bg: "rgba(239,68,68,.12)", text: "#EF4444", dot: "#EF4444" }
    : normalized.includes("exped") || normalized.includes("confer")
      ? { bg: "rgba(16,185,129,.12)", text: "#059669", dot: "#10B981" }
      : normalized.includes("separa")
        ? { bg: "rgba(59,130,246,.12)", text: "#2563EB", dot: "#3B82F6" }
        : { bg: "rgba(245,158,11,.14)", text: "#D97706", dot: "#F59E0B" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold" style={{ background: color.bg, color: color.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color.dot }} />
      {label || "Recebido"}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
