"use client";

import { ArrowRight, ArrowUpDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { repairMojibake } from "@/lib/sales-channels";
import type { ShippingOrderSummary } from "@/lib/shipping";
import { PortalNewOrderDrawer } from "@/components/portal/portal-new-order-drawer";

const filters = [
  { label: "Todos", value: "" },
  { label: "Recebido", value: "Recebido" },
  { label: "Em separação", value: "Em separação" },
  { label: "Expedido", value: "Expedido" },
  { label: "Cancelado", value: "Cancelado" },
] as const;

export function PortalOrdersView({ orders, products, depositanteId, depositanteName, openNewOrder = false }: {
  orders: ShippingOrderSummary[];
  products: Array<{
    id: string;
    nome: string;
    sku: string | null;
    codigo_interno: string | null;
    codigo_externo: string | null;
    imagem_principal_url: string | null;
    estoque_disponivel: number;
  }>;
  depositanteId: string;
  depositanteName: string;
  openNewOrder?: boolean;
}) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "created", direction: "desc" });
  const [now, setNow] = useState(() => Date.now());
  const [newOrderOpen, setNewOrderOpen] = useState(openNewOrder);
  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesFilter(order, activeFilter)),
    [activeFilter, orders],
  );
  const sortedOrders = useMemo(
    () => [...filteredOrders].sort((left, right) => compareOrders(left, right, sort)),
    [filteredOrders, sort],
  );
  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const pagedOrders = sortedOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function changeFilter(value: string) {
    setActiveFilter(value);
    setPage(1);
  }

  function changeSort(key: SortKey) {
    setPage(1);
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "created" ? "desc" : "asc" });
  }

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
          onClick={() => setNewOrderOpen(true)}
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
              onClick={() => changeFilter(filter.value)}
              className={`inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-[9px] border px-3.5 text-[13px] font-bold transition-all ${active ? "border-transparent text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
              style={active ? { background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" } : undefined}
            >
              {filter.label}
              <span
                className={`text-[11px] leading-none ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"}`}
                style={{
                  minWidth: 22,
                  height: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 6px",
                  borderRadius: 9999,
                  lineHeight: 1,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
        <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400">
          {sortedOrders.length} pedidos · ordenado por {sortLabel(sort.key)} ({sort.direction === "asc" ? "crescente" : "decrescente"})
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
                    {label ? (
                      <button type="button" aria-sort={sort.key === sortKeyForLabel(label) ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} onClick={() => changeSort(sortKeyForLabel(label))} className="inline-flex items-center gap-1.5 transition-colors hover:text-violet-600">
                        {label}
                        <ArrowUpDown className={`h-3.5 w-3.5 ${sort.key === sortKeyForLabel(label) ? "text-violet-500" : "opacity-50"}`} />
                      </button>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order) => (
                <OrderRow key={order.id} order={order} now={now} />
              ))}
            </tbody>
          </table>
        </div>
        {!sortedOrders.length ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum pedido encontrado.
          </div>
        ) : null}
      </div>
      {sortedOrders.length ? (
        <Pagination page={page} totalPages={totalPages} total={sortedOrders.length} onPageChange={setPage} />
      ) : null}
      {newOrderOpen ? (
        <PortalNewOrderDrawer
          depositanteId={depositanteId}
          depositanteName={depositanteName}
          products={products}
          onClose={() => {
            setNewOrderOpen(false);
            if (openNewOrder) router.replace("/portal?view=pedidos");
          }}
        />
      ) : null}
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

const PAGE_SIZE = 10;
type SortKey = "order" | "customer" | "channel" | "items" | "created" | "status";

function sortKeyForLabel(label: string): SortKey {
  return ({
    Pedido: "order",
    Cliente: "customer",
    Canal: "channel",
    Itens: "items",
    Criado: "created",
    Status: "status",
  } as Record<string, SortKey>)[label];
}

function sortLabel(key: SortKey) {
  return ({ order: "pedido", customer: "cliente", channel: "canal", items: "itens", created: "criação", status: "status" } as Record<SortKey, string>)[key];
}

function compareOrders(
  left: ShippingOrderSummary,
  right: ShippingOrderSummary,
  sort: { key: SortKey; direction: "asc" | "desc" },
) {
  const value = (order: ShippingOrderSummary) => {
    switch (sort.key) {
      case "order": return order.displayNumber || order.id;
      case "customer": return order.customer || "";
      case "channel": return repairMojibake(order.marketplace || order.channel || "");
      case "items": return order.itemCount;
      case "status": return repairMojibake(order.statusLabel || order.status || "");
      case "created": return new Date(order.createdAt).getTime() || 0;
    }
  };
  const a = value(left);
  const b = value(right);
  const comparison = typeof a === "number" && typeof b === "number"
    ? a - b
    : String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
  return sort.direction === "asc" ? comparison : -comparison;
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages].filter((item) => item >= 1 && item <= totalPages)));
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[13px] text-slate-500 dark:border-white/10 dark:bg-[#101b30] dark:text-slate-400">
      <span>Mostrando {first}–{last} de {total} pedidos</span>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Página anterior" disabled={page === 1} onClick={() => onPageChange(page - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"><ChevronLeft className="h-4 w-4" /></button>
        {pages.map((item, index) => (
          <span key={item} className="contents">
            {index > 0 && item - pages[index - 1] > 1 ? <span className="px-1">...</span> : null}
            <button type="button" onClick={() => onPageChange(item)} className={`grid h-8 min-w-8 place-items-center rounded-full border px-2 transition ${page === item ? "border-transparent bg-gradient-to-r from-blue-500 to-violet-500 font-bold text-white" : "border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600 dark:border-white/10 dark:text-slate-300"}`}>{item}</button>
          </span>
        ))}
        <button type="button" aria-label="Próxima página" disabled={page === totalPages} onClick={() => onPageChange(page + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function OrderRow({ order, now }: { order: ShippingOrderSummary; now: number }) {
  return (
    <tr className="cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.04]">
      <td className="px-5 py-[14px] font-display text-sm font-bold">{order.displayNumber || order.id}</td>
      <td className="px-5 py-[14px]">
        <div className="flex flex-col gap-0.5">
          <span className="max-w-[200px] truncate text-sm font-semibold">{order.customer || "Cliente não informado"}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{order.destination || "Destino não informado"}</span>
        </div>
      </td>
      <td className="px-5 py-[14px] text-[13.5px] font-semibold">
        {repairMojibake(order.marketplace || order.channel || "Operação própria")}
      </td>
      <td className="px-5 py-[14px] font-display text-sm font-semibold">{order.itemCount} item{order.itemCount === 1 ? "" : "s"}</td>
      <td className="px-5 py-[14px] text-[13px] text-slate-500 dark:text-slate-400">{formatCreatedAt(order.createdAt, now)}</td>
      <td className="px-5 py-[14px]"><StatusBadge label={repairMojibake(order.statusLabel || order.status)} /></td>
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

function formatCreatedAt(value: string | null, now: number) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const elapsedMs = now - date.getTime();
  if (elapsedMs < 0) {
    return `Agendado para ${formatDateTime(date)}`;
  }

  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 1) return "Criado agora";
  if (elapsedMinutes < 60) return `Criado há ${elapsedMinutes} min`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Criado há ${elapsedHours} ${elapsedHours === 1 ? "hora" : "horas"}`;
  if (elapsedHours < 48) return `Ontem às ${formatTime(date)}`;
  return formatDateTime(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(",", " às");
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}
