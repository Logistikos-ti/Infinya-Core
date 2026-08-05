"use client";

import { AlertTriangle, ArrowRight, ArrowUpDown, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, LoaderCircle, Package, Plus, Tag, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { repairMojibake } from "@/lib/sales-channels";
import { APP_TIME_ZONE, parseAppDate } from "@/lib/utils";
import type { ShippingOrderDetail, ShippingOrderSummary } from "@/lib/shipping";
import { PortalNewOrderDrawer } from "@/components/portal/portal-new-order-drawer";
import { PortalXmlOrderDrawer } from "@/components/portal/portal-xml-order-drawer";
import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";
import { ShippingAttachmentUploadPanel } from "@/components/shipping/shipping-attachment-upload-panel";
import { ShippingDivergenceDrawer } from "@/components/shipping/shipping-divergence-drawer";

const filters = [
  { label: "Todos", value: "" },
  { label: "Recebido", value: "Recebido" },
  { label: "Em separação", value: "Em separação" },
  { label: "Expedido", value: "Expedido" },
  { label: "Cancelado", value: "Cancelado" },
] as const;

export function PortalOrdersView({ orders, products, depositanteId, depositanteName, selectedOrder, openNewOrder = false, feedback, search = "" }: {
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
  selectedOrder: ShippingOrderDetail | null;
  openNewOrder?: boolean;
  feedback?: string;
  search?: string;
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"orders" | "divergences">("orders");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "created", direction: "desc" });
  const [now, setNow] = useState(() => Date.now());
  const [newOrderOpen, setNewOrderOpen] = useState(openNewOrder);
  const [xmlOrderOpen, setXmlOrderOpen] = useState(false);
  const [treatingDivergenceOrder, setTreatingDivergenceOrder] = useState<ShippingOrderSummary | null>(null);
  const [detailVisible, setDetailVisible] = useState(Boolean(selectedOrder));
  const [openingOrder, setOpeningOrder] = useState(false);

  const divergenceOrders = useMemo(
    () => orders.filter((o) => o.status === "DIVERGENCIA" || o.status === "DIVERGENTE" || o.status === "ERRO" || o.status === "CANCELADO" || Boolean(o.divergenceReporter || o.cancellationReason || o.cancellationReporter)),
    [orders]
  );

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesFilter(order, activeFilter) && matchesSearch(order, search)),
    [activeFilter, orders, search],
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
    setPage(1);
  }, [search]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setDetailVisible(Boolean(selectedOrder));
    if (selectedOrder) setOpeningOrder(false);
  }, [selectedOrder]);

  function openOrder(orderId: string) {
    setOpeningOrder(true);
    router.push(`/portal?view=pedidos&order=${encodeURIComponent(orderId)}`);
  }

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "divergences" ? "orders" : "divergences")}
            className={`inline-flex h-11 items-center gap-2 rounded-[11px] border px-4 text-sm font-extrabold transition hover:-translate-y-px ${
              viewMode === "divergences"
                ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300"
                : "border-amber-200 bg-white text-amber-700 hover:border-amber-400 dark:border-amber-400/30 dark:bg-white/5 dark:text-amber-300"
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Divergências
            {divergenceOrders.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-extrabold text-white">
                {divergenceOrders.length}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setXmlOrderOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-[11px] border border-violet-200 bg-white px-4 text-sm font-extrabold text-violet-700 transition hover:-translate-y-px hover:border-violet-400 dark:border-violet-400/30 dark:bg-white/5 dark:text-violet-300">
            <FileText className="h-4 w-4" /> Importar XML
          </button>
          <button
            type="button"
            onClick={() => setNewOrderOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-[11px] bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/20 transition-transform hover:-translate-y-px"
          >
            <Plus className="h-4 w-4" />
            Novo pedido
          </button>
        </div>
      </div>

      {viewMode === "divergences" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
                  Divergências & pendências
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Pedidos travados aguardando sua tratativa antes da expedição pelo CD.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {divergenceOrders.length} pendência{divergenceOrders.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setViewMode("orders")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                <ChevronLeft className="h-4 w-4" /> Voltar para pedidos
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101b30]">
            {divergenceOrders.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhuma divergência pendente para seus pedidos.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[12px] font-bold uppercase tracking-[0.04em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                      <th className="px-5 py-3.5">Pedido</th>
                      <th className="px-5 py-3.5">Tipo</th>
                      <th className="px-5 py-3.5">Problema / Divergência</th>
                      <th className="px-5 py-3.5">Registrado por</th>
                      <th className="px-5 py-3.5">Tratativa</th>
                      <th className="px-5 py-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divergenceOrders.map((order) => {
                      const isDiv = order.status === "DIVERGENCIA" || order.status === "DIVERGENTE" || Boolean(order.divergenceReporter || order.cancellationReporter || order.cancellationReason);
                      const reason = order.cancellationReason || (isDiv ? "Divergência reportada durante a conferência/separação." : order.status === "ERRO" ? "Falha no processamento do pedido." : "Sem estoque para concluir a separação.");
                      const issueType = order.status === "ERRO" ? "Erro de integração" : isDiv ? "Divergência" : "Cancelado";
                      const issueColor = order.status === "ERRO" ? "#F97316" : isDiv ? "#F59E0B" : "#EF4444";
                      const registeredBy = order.divergenceReporter || order.cancellationReporter || order.createdByName || order.createdBySource || "Sistema";
                      const tratamento = order.tratamentoDivergencia;

                      let tratativaEl;
                      if (tratamento?.acao === "PROSSEGUIR_COM_DIVERGENCIA") {
                        tratativaEl = (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Prosseguir c/ Divergência
                          </span>
                        );
                      } else if (tratamento?.acao === "CANCELAR_DEFINITIVO") {
                        tratativaEl = (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                            <XCircle className="h-3.5 w-3.5" /> Cancelado Definitivo
                          </span>
                        );
                      } else if (tratamento?.acao) {
                        tratativaEl = (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">
                            {tratamento.acao}
                          </span>
                        );
                      } else {
                        tratativaEl = (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                            <Clock className="h-3.5 w-3.5" /> Pendente de tratativa
                          </span>
                        );
                      }

                      return (
                        <tr
                          key={order.id}
                          onClick={() => setTreatingDivergenceOrder(order)}
                          className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.04]"
                        >
                          <td className="whitespace-nowrap px-5 py-3.5 font-display text-sm font-bold text-slate-900 dark:text-white">
                            {order.displayNumber || order.code}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: issueColor }}>
                              <span className="h-2 w-2 rounded-full" style={{ background: issueColor }} />
                              {issueType}
                            </span>
                          </td>
                          <td className="max-w-[280px] px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                            {reason}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                            {registeredBy}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5">
                            {tratativaEl}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTreatingDivergenceOrder(order);
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-3.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
                            >
                              {tratamento ? "Ver tratativa" : "Tratar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
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
                    {["Pedido", "NF-e", "Cliente", "Canal", "Itens", "Criado", "Status", ""].map((label) => (
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
                    <OrderRow
                      key={order.id}
                      order={order}
                      now={now}
                      onOpen={() => openOrder(order.id)}
                      onPrefetch={() => router.prefetch(`/portal?view=pedidos&order=${encodeURIComponent(order.id)}`)}
                    />
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
        </>
      )}

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
      {xmlOrderOpen ? <PortalXmlOrderDrawer depositanteId={depositanteId} depositanteName={depositanteName} onClose={() => setXmlOrderOpen(false)} /> : null}
      {selectedOrder && detailVisible ? <PortalOrderDetailDrawer order={selectedOrder} onClose={() => { setDetailVisible(false); window.history.replaceState({}, "", "/portal?view=pedidos"); }} /> : null}
      
      {/* Slide-over Drawer para Tratamento / Visualização de Divergências pelo Depositante */}
      <ShippingDivergenceDrawer
        order={treatingDivergenceOrder}
        isOpen={Boolean(treatingDivergenceOrder)}
        onClose={() => setTreatingDivergenceOrder(null)}
        readOnly={Boolean(treatingDivergenceOrder?.divergenciaTratada || treatingDivergenceOrder?.tratamentoDivergencia)}
        redirectTo="/portal?view=pedidos"
      />

      {openingOrder ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/20 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-xl dark:border-white/10 dark:bg-[#101b30] dark:text-white">
            <LoaderCircle className="h-5 w-5 animate-spin text-violet-500" /> Abrindo pedido...
          </div>
        </div>
      ) : null}
      {feedbackDetails(feedback) ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-labelledby="order-upload-error-title" className="w-full max-w-[460px] rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-400/30 dark:bg-[#101b30]">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300">!</div>
              <div className="min-w-0">
                <h2 id="order-upload-error-title" className="text-lg font-extrabold text-slate-950 dark:text-white">Não foi possível subir o pedido</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feedbackDetails(feedback)}</p>
              </div>
            </div>
            <button type="button" onClick={() => router.replace("/portal?view=pedidos")} className="mt-6 h-11 w-full rounded-xl bg-slate-950 text-sm font-extrabold text-white transition hover:-translate-y-px hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">Fechar</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function feedbackDetails(feedback?: string) {
  if (feedback === "nf-obrigatoria") return "Anexe o arquivo XML da nota fiscal antes de enviar o pedido.";
  if (feedback === "nf-invalida") return "A XML não é válida ou não contém a estrutura necessária da NF-e, incluindo número da nota.";
  if (feedback === "nf-duplicada") return "Já existe um pedido deste depositante com o mesmo número de NF-e. Confira a nota antes de tentar novamente.";
  if (feedback === "erro") return "O sistema não conseguiu concluir a criação. Verifique os dados do pedido e tente novamente.";
  return null;
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

function matchesSearch(order: ShippingOrderSummary, search: string) {
  const query = repairMojibake(search).trim().toLocaleLowerCase("pt-BR");
  if (!query) return true;

  return [
    order.displayNumber,
    order.code,
    order.externalNumber,
    order.storeNumber,
    order.nfe,
    order.customer,
    order.marketplace,
    order.channel,
  ]
    .filter(Boolean)
    .some((value) => repairMojibake(String(value)).toLocaleLowerCase("pt-BR").includes(query));
}

const PAGE_SIZE = 10;
type SortKey = "order" | "invoice" | "customer" | "channel" | "items" | "created" | "status";

function sortKeyForLabel(label: string): SortKey {
  return ({
    Pedido: "order",
    "NF-e": "invoice",
    Cliente: "customer",
    Canal: "channel",
    Itens: "items",
    Criado: "created",
    Status: "status",
  } as Record<string, SortKey>)[label];
}

function sortLabel(key: SortKey) {
  if (key === "invoice") return "NF-e";
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
      case "invoice": return order.nfe || "";
      case "customer": return order.customer || "";
      case "channel": return repairMojibake(order.marketplace || order.channel || "");
      case "items": return order.itemCount;
      case "status": return repairMojibake(order.statusLabel || order.status || "");
      case "created": return order.createdAtIso ? new Date(order.createdAtIso).getTime() || 0 : 0;
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

function OrderRow({ order, now, onOpen, onPrefetch }: { order: ShippingOrderSummary; now: number; onOpen: () => void; onPrefetch: () => void }) {
  return (
    <tr
      className="cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.04]"
      onClick={onOpen}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Abrir pedido ${order.displayNumber || order.id}`}
    >
      <td className="px-5 py-[14px] font-display text-sm font-bold"><span className="hover:text-violet-600">{order.displayNumber || order.id}</span></td>
      <td className="px-5 py-[14px] font-display text-sm font-semibold text-slate-700 dark:text-slate-200">{order.nfe || "-"}</td>
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
      <td className="px-5 py-[14px] text-[13px] text-slate-500 dark:text-slate-400">{formatCreatedAt(order.createdAtIso, now)}</td>
      <td className="px-5 py-[14px]"><StatusBadge status={order.status} label={repairMojibake(order.statusLabel || order.status)} /></td>
      <td className="px-5 py-[14px] text-right text-slate-400"><ArrowRight className="ml-auto h-4 w-4" /></td>
    </tr>
  );
}

function PortalOrderDetailDrawer({ order, onClose }: { order: ShippingOrderDetail; onClose: () => void }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const hasNfe = order.attachments.some((attachment) => attachment.kind === "XML_NF" && attachment.status === "DISPONIVEL");
  const hasEtiqueta = order.attachments.some((attachment) => attachment.kind === "ETIQUETA" && attachment.status === "DISPONIVEL");
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const progress = order.itemCount ? Math.min(100, Math.round((order.items.reduce((sum, item) => sum + item.separatedQuantityRaw, 0) / Math.max(1, order.unitsRaw)) * 100)) : 0;
  const statusStyle = getOperationalStatusStyle(order.status);
  const statusColor = statusStyle.color;
  const info = [
    ["Canal", order.marketplace || order.channel || "Operação própria"],
    ["Depositante", order.depositante],
    ["Nota fiscal", order.invoice],
    ["Criado", formatCreatedAt(order.createdAtIso, now)],
    ["Data prevista", order.expectedDate],
    ["Transportadora", order.carrierName],
  ];

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Detalhes do pedido">
      <button type="button" aria-label="Fechar detalhes" onClick={onClose} className="absolute inset-0 cursor-default border-0 bg-slate-950/55 backdrop-blur-sm" />
      <aside className="relative flex h-full w-[460px] max-w-[94vw] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f172a]">
        <header className="relative border-b border-slate-200 px-6 pb-5 pt-6 dark:border-white/10">
          <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-violet-200/60 blur-2xl dark:bg-violet-600/20" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.14em] text-slate-500">PEDIDO</p>
              <h2 className="mt-2 font-display text-[26px] font-bold leading-none text-slate-950 dark:text-white">{order.displayNumber}</h2>
              <span className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" style={{ color: statusColor, background: `${statusColor}18` }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} /> {repairMojibake(order.statusLabel)}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <section className="mb-5 flex items-center gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="9" className="text-slate-200 dark:text-white/10" /><circle cx="50" cy="50" r="41" fill="none" stroke={statusColor} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 41}`} strokeDashoffset={`${2 * Math.PI * 41 * (1 - progress / 100)}`} /></svg>
              <span className="relative text-xl font-bold text-slate-950 dark:text-white">{progress}%</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Cliente</p>
              <p className="mt-1 truncate text-[15px] font-bold text-slate-950 dark:text-white">{order.customer}</p>
              <p className="mt-1 text-xs text-slate-500">{order.destination}</p>
              <div className="mt-3 flex gap-5"><span className="text-lg font-bold text-slate-950 dark:text-white">{order.itemCount}<small className="ml-1 text-xs font-medium text-slate-500">itens</small></span><span className="text-lg font-bold text-slate-950 dark:text-white">{order.units}<small className="ml-1 text-xs font-medium text-slate-500">un.</small></span></div>
            </div>
          </section>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <OrderDocumentCard icon={<FileText className="h-5 w-5" />} label="Nota fiscal" available={hasNfe} viewHref={`/api/expedicao/${order.id}/nota-fiscal-preview?disposition=inline`} downloadHref={`/api/expedicao/${order.id}/nota-fiscal-preview?disposition=attachment`} onUpload={() => setUploadOpen(true)} />
            <OrderDocumentCard icon={<Package className="h-5 w-5" />} label="DANFE simplificada" available={hasNfe} allowUpload={false} viewHref={`/api/expedicao/${order.id}/danfe-simplificada?disposition=inline`} downloadHref={`/api/expedicao/${order.id}/danfe-simplificada?disposition=attachment`} onUpload={() => setUploadOpen(true)} />
            <OrderDocumentCard icon={<Tag className="h-5 w-5" />} label="Etiqueta de envio" available={hasEtiqueta} viewHref={`/api/expedicao/${order.id}/anexos/etiqueta?disposition=inline`} downloadHref={`/api/expedicao/${order.id}/anexos/etiqueta?disposition=attachment`} onUpload={() => setUploadOpen(true)} />
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3">{info.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-3 dark:border-white/10"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">{value || "-"}</p></div>)}</div>
          <section>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-950 dark:text-white">Itens do pedido</h3><span className="text-xs text-slate-500">{order.items.reduce((sum, item) => sum + item.separatedQuantityRaw, 0)} de {order.unitsRaw} conferidos</span></div>
            <div className="space-y-2">{order.items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${item.separatedQuantityRaw >= item.quantityRaw ? "bg-emerald-500 text-white" : "border border-slate-300 text-slate-400"}`}>{item.separatedQuantityRaw >= item.quantityRaw ? <CheckCircle2 className="h-4 w-4" /> : <Package className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900 dark:text-white" title={item.name}>{item.name}</p><p className="text-xs text-slate-500">{item.sku}</p></div><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.quantity} un.</span></div>)}</div>
          </section>
        </div>
        <footer className="border-t border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f172a]"><button type="button" onClick={onClose} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-white">Fechar</button></footer>
        {uploadOpen ? <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#101b30]"><div className="mb-4 flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-950 dark:text-white">Anexar documento</h3><p className="mt-1 text-xs text-slate-500">Selecione o XML da NF ou a etiqueta de envio.</p></div><button type="button" onClick={() => setUploadOpen(false)} aria-label="Fechar upload" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 dark:border-white/10"><X className="h-4 w-4" /></button></div><ShippingAttachmentUploadPanel depositanteId={order.depositanteId} pedidoExpedicaoId={order.id} /></div></div> : null}
      </aside>
    </div>
  );
}

function LegacyOrderDocumentCard({ icon, label, available, viewHref, downloadHref, onUpload }: { icon: React.ReactNode; label: string; available: boolean; viewHref: string; downloadHref: string; onUpload: () => void }) {
  const content = <><span className="relative text-slate-500 dark:text-slate-300">{icon}<span className={`absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full text-[10px] text-white ${available ? "bg-emerald-500" : "bg-slate-300"}`}>{available ? "✓" : "–"}</span></span><span className="text-center text-[11px] font-bold leading-tight text-slate-700 dark:text-slate-200">{label}</span></>;
  if (!available) return <button type="button" onClick={onUpload} className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 p-2 text-left opacity-80 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10">{content}<span className="text-[10px] font-bold text-violet-600">Anexar</span></button>;
  return <ShippingAttachmentPreviewDialog label={label} viewHref={viewHref} downloadHref={downloadHref} customTrigger={(openPreview) => <button type="button" onClick={openPreview} className="flex min-h-[92px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 p-2 text-left transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10">{content}<span className="text-[10px] font-bold text-emerald-600">Visualizar</span></button>} />;
}

function OrderDocumentCard({ icon, label, available, allowUpload = true, viewHref, downloadHref, onUpload }: { icon: React.ReactNode; label: string; available: boolean; allowUpload?: boolean; viewHref: string; downloadHref: string; onUpload: () => void }) {
  const marker = available ? "\u2713" : "\u00d7";
  const content = <><span className="relative text-slate-500 dark:text-slate-300">{icon}<span className={`absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full text-[10px] font-black text-white ${available ? "bg-emerald-500" : "bg-rose-500"}`}>{marker}</span></span><span className="text-center text-[11px] font-bold leading-tight text-slate-700 dark:text-slate-200">{label}</span></>;
  if (!available && !allowUpload) return <div className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 p-2 opacity-75 dark:border-white/10">{content}<span className="text-center text-[10px] font-bold text-slate-500">Gerada após a NF</span></div>;
  if (!available) return <button type="button" onClick={onUpload} className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 p-2 text-left transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10">{content}<span className="text-[10px] font-bold text-violet-600">Anexar</span></button>;
  return <ShippingAttachmentPreviewDialog label={label} viewHref={viewHref} downloadHref={downloadHref} customTrigger={(openPreview) => <button type="button" onClick={openPreview} className="flex min-h-[92px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2 text-left transition hover:-translate-y-px hover:border-violet-300 dark:border-emerald-400/30 dark:bg-emerald-400/5">{content}<span className="text-[10px] font-bold text-emerald-600">Visualizar</span></button>} />;
}

function getOperationalStatusStyle(status: string) {
  const colors: Record<string, { background: string; color: string }> = {
    NOVO: { background: "rgba(100,116,139,.15)", color: "#64748B" },
    EM_SEPARACAO: { background: "rgba(59,130,246,.15)", color: "#3B82F6" },
    SEPARADO: { background: "rgba(59,130,246,.15)", color: "#3B82F6" },
    EM_CONFERENCIA: { background: "rgba(139,92,246,.15)", color: "#8B5CF6" },
    CONFERIDO: { background: "rgba(16,185,129,.15)", color: "#10B981" },
    PRONTO_ROMANEIO: { background: "rgba(16,185,129,.15)", color: "#10B981" },
    EXPEDIDO: { background: "rgba(16,185,129,.15)", color: "#10B981" },
    CANCELADO: { background: "rgba(239,68,68,.15)", color: "#EF4444" },
    DIVERGENTE: { background: "rgba(245,158,11,.15)", color: "#F59E0B" },
  };

  return colors[status] ?? colors.NOVO;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const color = getOperationalStatusStyle(status);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold" style={{ background: color.background, color: color.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color.color }} />
      {label || "Novo"}
    </span>
  );
}

function formatCreatedAt(value: string | null, now: number) {
  if (!value) return "-";
  const date = parseAppDate(value);
  if (!date) return value;

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
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(",", " às");
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
