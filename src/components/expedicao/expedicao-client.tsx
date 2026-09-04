
"use client";

import React, { useActionState, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Loader2, 
  PackageSearch,
  AlertTriangle,
  ClipboardList,
  Clock,
  CheckCircle2,
  PackageCheck,
  Box,
  Truck,
  ListChecks,
  Scan,
  FileCheck2,
  Moon,
  Sun,
  Search,
  Check,
  Plus,
  Minus,
  X,
  Upload,
  ChevronLeft,
  ChevronDown,
  List,
  ArrowLeft,
  FileText,
  Receipt,
  Tag,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  XCircle,
  FileSignature,
  PackageX
} from "lucide-react";
import {
  changeShippingOrderStatusAction,
  bulkChangeShippingOrderStatusAction,
  createOperationalManualShippingOrderAction,
  bulkDeleteShippingOrdersAction,
  deleteShippingOrderAction,
  type ManualShippingOrderSubmissionState,
} from "@/app/(dashboard)/expedicao/actions";
import { ShippingDivergenceDrawer } from "@/components/shipping/shipping-divergence-drawer";
import { ShippingAttachmentPreviewDialog } from "@/components/shipping/shipping-attachment-preview-dialog";
import { ShippingFullDocumentsCard } from "@/components/shipping/shipping-full-documents-card";
import { ShippingAttachmentUploadPanel } from "@/components/shipping/shipping-attachment-upload-panel";
import { ShippingReturnInvoiceModal } from "@/components/shipping/shipping-return-invoice-modal";
import { createPortal, useFormStatus } from "react-dom";
import { SALES_CHANNEL_OPTIONS, isMarketplaceChannel } from "@/lib/sales-channels";
import { resolveMarketplaceCarrierName } from "@/lib/marketplace-carrier-networks";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

const initialManualShippingOrderSubmissionState: ManualShippingOrderSubmissionState = { status: "idle" };

function isFromCurrentMonthInSaoPaulo(value: string | null | undefined) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  });

  const currentMonth = formatter.format(new Date());
  return formatter.format(date) === currentMonth;
}

function isFromCurrentYearInSaoPaulo(value: string | null | undefined) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  });

  const currentYear = formatter.format(new Date());
  return formatter.format(date) === currentYear;
}

function xmlPreviewValue(xml: string, tag: string) {
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const node = Array.from(document.getElementsByTagName("*")).find((element) => element.localName === tag);
    if (node?.textContent?.trim()) return node.textContent.trim();
  }
  const match = xml.match(new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([^<]*)</(?:[\\w-]+:)?${tag}>`, "i"));
  if (match?.[1]?.trim()) return match[1].trim();
  const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (tag === "nNF") return text.match(/N[^0-9]{0,6}([0-9]{3,})/i)?.[1] || "-";
  if (tag === "serie") return text.match(/serie[^0-9]{0,4}([0-9]+)/i)?.[1] || "-";
  /*
  if (tag === "nNF") return text.match(/N[ºo°]?\\s*(\\d{3,})/i)?.[1] || "-";
  if (tag === "serie") return text.match(/s[ée]rie\\s*(\\d+)/i)?.[1] || "-";
  if (tag === "xNome") return text.match(/NOME\\s*\\/\\s*RAZ[ÃA]O SOCIAL\\s*:\\s*([^:]+?)(?=ENDERE[ÇC]O|$)/i)?.[1]?.trim() || "-";
  */
  if (tag === "vNF") return text.match(/VALOR TOTAL DA NOTA[^0-9]*([0-9.,]+)/i)?.[1] || text.match(/VALOR TOTAL[^0-9]*([0-9.,]+)/i)?.[1] || "-";
  if (tag === "CNPJ") return text.match(/CNPJ\s*:?\s*([0-9./-]{14,18})/i)?.[1] || "-";
  return "-";
}

function xmlPreviewScopedValue(xml: string, scopeTag: string, tag: string) {
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const scope = Array.from(document.getElementsByTagName("*")).find((element) => element.localName === scopeTag);
    const node = scope ? Array.from(scope.getElementsByTagName("*")).find((element) => element.localName === tag) : null;
    if (node?.textContent?.trim()) return node.textContent.trim();
  }
  return xmlPreviewValue(xml, tag);
}

function escapePreviewHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] ?? character));
}

function buildInvoicePreviewHtml(xml: string) {
  const lineMatches = [...xml.matchAll(/<line[^>]*>([\s\S]*?)<\/line>/gi)];
  const lines = lineMatches
    .map((match) => match[1].replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#039;/gi, "'"))
    .filter((line) => line.trim())
    .map((line) => `<div class="line">${escapePreviewHtml(line)}</div>`)
    .join("");
  const fallback = `<pre class="raw">${escapePreviewHtml(xml)}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff;color:#111827}body{padding:24px;font-family:Arial,sans-serif}.sheet{width:min(100%,920px);margin:0 auto;border:1px solid #111827;background:#fff}.sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:16px 18px;border-bottom:2px solid #111827}.title{font-size:18px;font-weight:800;letter-spacing:.04em}.subtitle{margin-top:4px;font-size:11px;color:#4b5563}.nf-title{text-align:right;font-size:12px;font-weight:800}.nf-title small{display:block;margin-top:4px;font-size:10px;font-weight:400;color:#4b5563}.document{padding:14px 18px}.line{min-height:16px;padding:2px 0;border-bottom:1px solid #d1d5db;font-family:Arial,sans-serif;font-size:11px;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}.line:first-child{font-weight:700}.raw{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}</style></head><body><div class="sheet"><div class="sheet-head"><div><div class="title">NOTA FISCAL ELETRÔNICA</div><div class="subtitle">Documento fiscal original anexado ao pedido</div></div><div class="nf-title">NF-e<small>Documento completo</small></div></div><div class="document">${lines || fallback}</div></div></body></html>`;
}

function getOrderUploadFeedback(feedback?: string) {
  switch (feedback) {
    case "status-atualizado":
      return { title: "Status atualizado", detail: "O status do pedido foi alterado e o registro da mudança foi salvo no histórico operacional." };
    case "divergencia-reaberta-separacao":
      return { title: "Separação reaberta com sucesso", detail: "O pedido foi devolvido para a fila de separação (picking) e está pronto para nova coleta." };
    case "divergencia-retornada":
      return { title: "Pedido retornado", detail: "A divergência foi tratada e o pedido retornou para a fila (Novo) aguardando estoque." };
    case "divergencia-cancelada":
      return { title: "Cancelamento confirmado", detail: "A divergência foi tratada e o pedido foi marcado como cancelado definitivamente." };
    case "nf-obrigatoria":
      return { title: "Anexo obrigat\u00f3rio", detail: "Anexe o arquivo XML da NF-e antes de enviar o pedido ao CD." };
    case "nf-invalida":
      return { title: "NF-e inv\u00e1lida", detail: "O XML n\u00e3o foi reconhecido como uma NF-e v\u00e1lida ou n\u00e3o cont\u00e9m os dados necess\u00e1rios da nota." };
    case "nf-duplicada":
      return { title: "NF-e duplicada", detail: "J\u00e1 existe um pedido deste depositante com o mesmo n\u00famero de NF-e. Confira a nota antes de tentar novamente." };
    case "xml-produtos-nao-mapeados":
      return { title: "Produtos n\u00e3o mapeados", detail: "A NF-e foi lida, mas um ou mais produtos ainda n\u00e3o est\u00e3o vinculados ao cat\u00e1logo do depositante." };
    case "erro":
      return { title: "N\u00e3o foi poss\u00edvel concluir a ação", detail: "O sistema n\u00e3o conseguiu concluir a operação. Tente novamente e, se o problema persistir, contate o suporte." };
    default:
      return null;
  }
}

const manualOrderStatusOptions = [
  ["NOVO", "Novo"],
  ["EM_SEPARACAO", "Em separação"],
  ["SEPARADO", "Aguardando conferência"],
  ["EM_CONFERENCIA", "Em conferência"],
  ["CONFERIDO", "Conferido"],
  ["PRONTO_ROMANEIO", "Pronto para coleta"],
  ["EXPEDIDO", "Expedido"],
  ["CANCELADO", "Cancelado"],
] as const;

function ManualStatusUpdateButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? "Atualizando status" : "Atualizar status"}
      style={{ height: "38px", minWidth: "98px", padding: "0 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: "9px", background: "linear-gradient(90deg, #3B82F6, #8B5CF6)", color: "#fff", fontSize: "12px", fontWeight: 800, cursor: pending ? "wait" : "pointer", whiteSpace: "nowrap", opacity: pending ? 0.82 : 1 }}
    >
      {pending ? <MobileButtonSpinner size={30} color="#FFFFFF" /> : "Atualizar"}
    </button>
  );
}

function ManualOrderStatusControl({
  orderId,
  status,
  text,
  border,
  background,
}: {
  orderId: string;
  status: string;
  text: string;
  border: string;
  background: string;
}) {
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const selectedStatusLabel = manualOrderStatusOptions.find(([value]) => value === selectedStatus)?.[1] ?? "Selecione o status";

  return (
    <form
      action={changeShippingOrderStatusAction}
      onSubmit={(event) => {
        if (!window.confirm("Alterar manualmente o status deste pedido? A mudança ficará registrada no histórico.")) {
          event.preventDefault();
        }
      }}
      style={{ marginBottom: "20px", padding: "14px", borderRadius: "12px", border: `1px solid ${border}`, background }}
    >
      <input type="hidden" name="id" value={orderId} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
        <div>
          <div style={{ color: text, fontSize: "12.5px", fontWeight: 800 }}>Controle administrativo</div>
          <div style={{ color: text, opacity: 0.72, fontSize: "11.5px", marginTop: "2px" }}>Altera o fluxo e registra a ação no histórico.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input type="hidden" name="status" value={selectedStatus} />
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={statusMenuOpen}
            onClick={() => setStatusMenuOpen((open) => !open)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", width: "100%", height: "38px", padding: "0 11px", borderRadius: "10px", border: `1.5px solid ${statusMenuOpen ? "#22D3EE" : border}`, background, color: text, fontSize: "12.5px", fontWeight: 700, cursor: "pointer", outline: "none", boxShadow: statusMenuOpen ? "0 0 0 3px rgba(34,211,238,.13)" : "none", transition: "border-color .16s ease, box-shadow .16s ease" }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedStatusLabel}</span>
            <ChevronDown size={16} color={statusMenuOpen ? "#0891B2" : "#64748B"} style={{ flexShrink: 0, transform: statusMenuOpen ? "rotate(180deg)" : "none", transition: "transform .16s ease" }} />
          </button>
          {statusMenuOpen ? (
            <div role="listbox" style={{ position: "absolute", zIndex: 30, top: "calc(100% + 8px)", left: 0, right: 0, maxHeight: "230px", overflowY: "auto", padding: "7px", borderRadius: "12px", border: `1px solid ${border}`, background, boxShadow: "0 18px 38px rgba(15,23,42,.2)", animation: "popIn .16s ease" }}>
              {manualOrderStatusOptions.map(([value, label]) => {
                const isSelected = value === selectedStatus;
                return (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => { setSelectedStatus(value); setStatusMenuOpen(false); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: "38px", padding: "0 10px", border: 0, borderRadius: "9px", background: isSelected ? "#ECFEFF" : "transparent", color: isSelected ? "#0E7490" : text, fontSize: "12.5px", fontWeight: isSelected ? 800 : 600, textAlign: "left", cursor: "pointer" }}
                  >
                    <span>{label}</span>
                    {isSelected ? <Check size={16} color="#0E7490" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <ManualStatusUpdateButton />
      </div>
    </form>
  );
}

export function ExpedicaoClient({ data }: { data: any }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const canDeleteOrder = data.userRole === "ADMIN" || data.userRole === "TI";
  const canManuallyChangeOrderStatus = data.userRole === "ADMIN" || data.userRole === "TI";

  const [activeTab, setActiveTab] = useState("orders");
  const [uploadModalOpen, setUploadModalOpen] = useState<{ open: boolean; type: "NF" | "ETIQUETA" }>({ open: false, type: "NF" });
  const [activeFilter, setActiveFilter] = useState("aguardando");
  const [currentPage, setCurrentPage] = useState(1);
  type OrderSortKey = "order" | "invoice" | "customer" | "depositante" | "channel" | "items" | "conference" | "sla" | "status";
  const [sort, setSort] = useState<{ key: OrderSortKey; direction: "asc" | "desc" }>({ key: "order", direction: "asc" });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  // Retirada cuja NF-e de devolução está sendo anexada pelo modal.
  const [returnInvoiceOrder, setReturnInvoiceOrder] = useState<any | null>(null);
  const [treatingDivergenceOrder, setTreatingDivergenceOrder] = useState<any | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkStatusMenuOpen, setBulkStatusMenuOpen] = useState(false);
  const [bulkSelectedStatus, setBulkSelectedStatus] = useState("");
  const [hoveredProductIndex, setHoveredProductIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Na aba raiz a busca fica recolhida como lupa e expande ao clicar.
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // O input fica sempre montado (para a largura poder animar), entao o foco ao
  // abrir precisa ser dado na mao -- autoFocus so dispararia na montagem.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderDepositante, setNewOrderDepositante] = useState(data.depositanteOptions?.[0]?.id ?? "");
  const [newOrderDepositanteOpen, setNewOrderDepositanteOpen] = useState(false);
  const [newOrderChannel, setNewOrderChannel] = useState("MERCADO_LIVRE");
  const [newOrderItems, setNewOrderItems] = useState<Array<{ id: string; quantity: number }>>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerQuery, setProductPickerQuery] = useState("");
  const [newOrderCarrier, setNewOrderCarrier] = useState("Outro");
  const [manualOrderResult, submitManualOrder, isSubmittingManualOrder] = useActionState(
    createOperationalManualShippingOrderAction,
    initialManualShippingOrderSubmissionState,
  );
  const [manualOrderErrorDismissed, setManualOrderErrorDismissed] = useState(false);
  const [manualOrderSuccessVisible, setManualOrderSuccessVisible] = useState(false);
  const [newOrderOtherCarrier, setNewOrderOtherCarrier] = useState("");
  const carrierChipOptions = ["Correios", "Ponto de Coleta", ...(isMarketplaceChannel(newOrderChannel) ? ["Coleta Marketplace"] : []), "Outro"];
  const resolvedCarrierName =
    newOrderCarrier === "Outro"
      ? newOrderOtherCarrier || "Outro"
      : newOrderCarrier === "Coleta Marketplace"
        ? resolveMarketplaceCarrierName(newOrderChannel)
        : newOrderCarrier;
  const [newOrderInvoiceFile, setNewOrderInvoiceFile] = useState<File | null>(null);
  const [newOrderLabelFile, setNewOrderLabelFile] = useState<File | null>(null);
  const [newOrderPreview, setNewOrderPreview] = useState<{ kind: "invoice" | "label"; src: string; file?: File } | null>(null);
  const [newOrderPreviewZoom, setNewOrderPreviewZoom] = useState(100);
  const newOrderPreviewFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (manualOrderResult.status !== "success") return;
    setNewOrderOpen(false);
    setManualOrderErrorDismissed(false);
    setManualOrderSuccessVisible(true);
    router.refresh();

    const timeout = window.setTimeout(() => setManualOrderSuccessVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [manualOrderResult.status, router]);

  useRealtimeRefresh([{ table: "pedidos_expedicao" }, { table: "pedidos_expedicao_itens" }]);

  const isOrders = activeTab === "orders";
  const isWaves = activeTab === "waves";
  const isConference = activeTab === "conference";
  const isDivergence = activeTab === "divergence";
  const isPedidosFull = activeTab === "pedidos_full";
  const ordersForOperationalQueue = isPedidosFull
    ? data.orders
    : data.orders.filter(
        (order: any) =>
          order.status !== "EXPEDIDO" ||
          isFromCurrentMonthInSaoPaulo(order.dispatchedAtIso || order.updatedAtIso || order.createdAtIso),
      );

  const setOrders = () => setActiveTab("orders");
  const setDivergence = () => setActiveTab("divergence");

  const t = {
    appBg: isDark ? "#0A1120" : "#F5F7FB",
    sideBg: isDark ? "#0C1424" : "#FFFFFF",
    barBg: isDark ? "#0C1424" : "#FFFFFF",
    border: isDark ? "rgba(148,163,184,0.14)" : "rgba(100,116,139,0.16)",
    cardBg: isDark ? "#101B30" : "#FFFFFF",
    softBg: isDark ? "rgba(148,163,184,0.06)" : "rgba(100,116,139,0.05)",
    inputBg: isDark ? "#101B30" : "#F8FAFC",
    text: isDark ? "#F1F5F9" : "#0F172A",
    textSub: isDark ? "#8695AD" : "#64748B",
    barTrack: isDark ? "rgba(148,163,184,0.16)" : "rgba(100,116,139,0.14)",
    headBg: isDark ? "#0E1728" : "#F8FAFC",
    drawerBg: isDark ? "#0C1526" : "#FFFFFF"
  };
  
  const tog = isDark ? {
    track: '#0E1729', border: 'rgba(96,165,250,0.30)', inset: 'rgba(0,0,0,0.5)',
    knob: '#0B1220', knobX: '0px', knobIcon: '☾', knobIconColor: '#3B82F6',
    trackMoon: 'transparent', trackSun: '#3B4763'
  } : {
    track: '#F4F5F8', border: 'rgba(100,116,139,0.18)', inset: 'rgba(0,0,0,0.06)',
    knob: '#FFFFFF', knobX: '36px', knobIcon: '☀', knobIconColor: '#F6A623',
    trackMoon: '#B4BCC9', trackSun: 'transparent'
  };

  const vt = {
    ordersBg: isOrders ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : "transparent",
    ordersColor: isOrders ? "#FFF" : t.textSub,
    divBg: isDivergence ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : "transparent",
    divColor: isDivergence ? "#FFF" : t.textSub,
    divCountBg: isDivergence ? "#FFF" : "rgba(239, 68, 68, 0.15)",
    divCountColor: "#EF4444"
  };

  const showAdd = true;
  const addBtnLabel = "+ Novo pedido";
  const isDivergencePendingOrder = (o: any) => {
    const hasTratamento = Boolean(o.divergenciaTratada || o.tratamentoDivergencia || o.raw?.divergenciaTratada || o.raw?.tratamentoDivergencia);
    if (hasTratamento) return false;
    return (
      ["DIVERGENCIA", "DIVERGENTE", "ERRO", "EM_DIVERGENCIA", "CANCELADO"].includes(o.status) &&
      (o.status !== "CANCELADO" || Boolean(o.divergenceReporter || o.cancellationReason || o.cancellationReporter))
    );
  };
  const divergenceCount = data.orders.filter(isDivergencePendingOrder).length;
  const availableProducts = (data.productOptions ?? []).filter((produto: any) => produto.depositante_id === newOrderDepositante);
  const selectedItems = newOrderItems.map((item) => ({ ...item, product: availableProducts.find((produto: any) => produto.id === item.id) ?? data.productOptions?.find((produto: any) => produto.id === item.id) })).filter((item) => item.product);
  const totalNewOrderUnits = selectedItems.reduce((total, item) => total + item.quantity, 0);
  const pickerProducts = availableProducts.filter((produto: any) => {
    const query = productPickerQuery.trim().toLowerCase();
    return !query || [produto.nome, produto.sku, produto.codigo_interno, produto.codigo_externo].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
  });

  // Mesma definicao de "conferencia" usada em matchesOperationalFilter/stagesDefs:
  // SEPARADO (aguardando conferencia) + EM_CONFERENCIA (em andamento).
  const emConferenciaAtual = ordersForOperationalQueue.filter(
    (order: any) => order.status === "EM_CONFERENCIA" || order.status === "SEPARADO",
  ).length;

  // Total de pedidos no ano corrente, pela data real do pedido (data_pedido),
  // nao pela data de sincronizacao com o WMS.
  const totalPedidosNoAno = data.orders.filter((order: any) =>
    isFromCurrentYearInSaoPaulo(order.dataPedidoIso || order.createdAtIso),
  ).length;

  const kpis = [
    { label: "Total de pedidos no ano", value: totalPedidosNoAno, delta: "", iconEl: <Box size={20} />, iconBg: "rgba(59,130,246,0.15)", iconColor: "#3B82F6", deltaColor: "" },
    { label: "Em conferência", value: emConferenciaAtual, delta: "", iconEl: <CheckCircle2 size={20} />, iconBg: "rgba(139,92,246,0.15)", iconColor: "#8B5CF6", deltaColor: "" },
    { label: "Aguardando separação", value: data.stats[1]?.value || 0, delta: data.stats[1]?.delta || "", iconEl: <Clock size={20} />, iconBg: "rgba(16,185,129,0.15)", iconColor: "#10B981", deltaColor: "" },
    {
      label: "Expedidos este mês",
      value: data.stats[3]?.value || 0,
      delta: data.stats[3]?.delta || "",
      deltaDirection: data.stats[3]?.deltaDirection || "neutral",
      iconEl: <CheckCircle2 size={20} />,
      iconBg: "rgba(245,158,11,0.15)",
      iconColor: "#F59E0B",
      deltaColor: data.stats[3]?.deltaDirection === "down" ? "#EF4444" : "#10B981",
    }
  ];

  const flowCards = [
    { onClick: () => setActiveTab("pedidos_full"), kicker: "PAINEL", iconEl: <ClipboardList size={20} className="animated-icon" />, iconBg: "rgba(139,92,246,0.15)", accent: "#8B5CF6", title: "Pedidos", desc: "Ir direto para a listagem completa de pedidos, filtros operacionais e acompanhamento da fila.", btnBg: "rgba(139,92,246,0.15)", btnColor: "#8B5CF6", cta: "Ver Pedidos" },
    { 
      onClick: () => router.push("/expedicao/separacao"), 
      kicker: "OPERAÇÃO", iconEl: <ListChecks size={20} className="animated-icon" />, iconBg: "rgba(59,130,246,0.15)", accent: "#3B82F6", title: "Separação", desc: "Abrir a fila de picking, distribuir os pedidos e iniciar a leitura operacional do armazém.", btnBg: "rgba(59,130,246,0.15)", btnColor: "#3B82F6", cta: "Entrar em Separação" 
    },
    { 
      onClick: () => router.push("/expedicao/conferencia"), 
      kicker: "VALIDAÇÃO", iconEl: <Scan size={20} className="animated-icon" />, iconBg: "rgba(168,85,247,0.15)", accent: "#A855F7", title: "Conferência", desc: "Entrar na etapa final, validar item a item e liberar somente pedidos conferidos para expedição.", btnBg: "rgba(168,85,247,0.15)", btnColor: "#A855F7", cta: "Entrar em Conferência" 
    },
    { onClick: () => router.push("/expedicao/conferidos"), kicker: "PÓS-CONFERÊNCIA", iconEl: <FileCheck2 size={20} className="animated-icon" />, iconBg: "rgba(16,185,129,0.15)", accent: "#10B981", title: "Conferidos", desc: "Acompanhar pedidos já conferidos, com ou sem romaneio, antes da etapa final de despacho.", btnBg: "rgba(16,185,129,0.15)", btnColor: "#10B981", cta: "Ver Conferidos" },
  ];

  const matchesOperationalFilter = (order: any, filterId: string) => {
    if (filterId === "todos") return true;
    // Retiradas entram em "Aguardando" junto com os pedidos novos: elas estao
    // paradas esperando o operador anexar a NF-e de devolucao, entao e aqui
    // que ele precisa enxerga-las. Sem isso o pedido so aparecia em "Todos".
    if (filterId === "aguardando") {
      return order.status === "NOVO" || order.status === "AGUARDANDO_NF_DEVOLUCAO";
    }
    if (filterId === "separacao") return order.status === "EM_SEPARACAO";
    if (filterId === "conferencia") return order.status === "EM_CONFERENCIA" || order.status === "SEPARADO";
    if (filterId === "pronto-coleta") return order.status === "PRONTO_ROMANEIO" || order.status === "CONFERIDO";
    if (filterId === "expedido") return order.status === "EXPEDIDO";
    if (filterId === "cancelamento-pendente") return order.status === "EM_CANCELAMENTO";
    if (filterId === "cancelados" || filterId === "cancelado") return order.status === "CANCELADO";
    if (filterId === "atrasados") return order.ageTone === "LATE";
    return false;
  };

  const expedidosNoMesAtual = ordersForOperationalQueue.filter(
    (order: any) =>
      order.status === "EXPEDIDO" &&
      isFromCurrentMonthInSaoPaulo(order.dispatchedAtIso || order.updatedAtIso || order.createdAtIso),
  ).length;

  const tableFiltersDef = [
    { id: "aguardando", label: "Aguardando", count: ordersForOperationalQueue.filter((order: any) => matchesOperationalFilter(order, "aguardando")).length, hasCount: true, isAlert: false },
    { id: "separacao", label: "Em separação", count: ordersForOperationalQueue.filter((order: any) => matchesOperationalFilter(order, "separacao")).length, hasCount: true, isAlert: false },
    { id: "conferencia", label: "Em conferência", count: ordersForOperationalQueue.filter((order: any) => matchesOperationalFilter(order, "conferencia")).length, hasCount: true, isAlert: false },
    { id: "pronto-coleta", label: "Pronto para coleta", count: ordersForOperationalQueue.filter((order: any) => matchesOperationalFilter(order, "pronto-coleta")).length, hasCount: true, isAlert: false },
    { id: "expedido", label: "Expedido", count: expedidosNoMesAtual, hasCount: true, isAlert: false },
    { id: "cancelamento-pendente", label: "Cancelamento em andamento", count: ordersForOperationalQueue.filter((order: any) => matchesOperationalFilter(order, "cancelamento-pendente")).length, hasCount: true, isAlert: true },
    { id: "cancelados", label: "Cancelados", count: data.orders.filter((order: any) => matchesOperationalFilter(order, "cancelados")).length, hasCount: true, isAlert: false },
    { id: "todos", label: "Todos", count: ordersForOperationalQueue.length, hasCount: false, isAlert: false },
  ];

  const filters = tableFiltersDef.map(f => {
    const active = activeFilter === f.id;
    return {
      ...f,
      bg: active ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : "transparent",
      color: active ? "#fff" : t.text,
      border: active ? "transparent" : t.border,
      countBg: active ? "rgba(255,255,255,0.2)" : (f.isAlert && f.count > 0 ? "rgba(239, 68, 68, 0.15)" : (isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9")),
      countColor: active ? "#fff" : (f.isAlert && f.count > 0 ? "#EF4444" : (isDark ? "#94A3B8" : "#64748B")),
      countFw: f.isAlert && f.count > 0 ? "800" : "600",
      action: () => {
        setActiveFilter(f.id);
        setCurrentPage(1);
      }
    };
  });
  
  // Pipeline Stages for Pedidos Full View
  const stagesDefs = [
    { id: 'todos', label: 'Todos', icon: 'List', accent: '#64748B', statusFilter: null },
    { id: 'aguardando', label: 'Aguardando', icon: 'Clock', accent: '#F59E0B', statusFilter: 'NOVO' },
    { id: 'separacao', label: 'Em separação', icon: 'ClipboardList', accent: '#3B82F6', statusFilter: 'EM_SEPARACAO' },
    { id: 'conferencia', label: 'Em conferência', icon: 'Scan', accent: '#8B5CF6', statusFilter: 'EM_CONFERENCIA' },
    { id: 'pronto-coleta', label: 'Pronto para coleta', icon: 'PackageCheck', accent: '#10B981', statusFilter: 'PRONTO_ROMANEIO' },
    { id: 'expedido', label: 'Expedido', icon: 'Truck', accent: '#3B82F6', statusFilter: 'EXPEDIDO' },
    { id: 'cancelamento-pendente', label: 'Cancelamento em andamento', icon: 'PackageX', accent: '#DC2626', statusFilter: 'EM_CANCELAMENTO' },
    { id: 'cancelados', label: 'Cancelados', icon: 'XCircle', accent: '#EF4444', statusFilter: 'CANCELADO' }
  ];
  
  const stages = stagesDefs.map(s => {
    const active = activeFilter === s.id;
    
    // Calculate count with real data
    const count = s.statusFilter ? data.orders.filter((o:any) => {
      // Mesma regra do matchesOperationalFilter: retirada aguardando NF-e de
      // devolucao conta como "Aguardando".
      if (s.id === 'aguardando') return o.status === 'NOVO' || o.status === 'AGUARDANDO_NF_DEVOLUCAO';
      if (s.id === 'conferencia') return o.status === 'EM_CONFERENCIA' || o.status === 'SEPARADO';
      if (s.id === 'pronto-coleta') return o.status === 'PRONTO_ROMANEIO' || o.status === 'CONFERIDO';
      if (s.id === 'expedido') return o.status === 'EXPEDIDO';
      if (s.id === 'cancelados') return o.status === 'CANCELADO';
      return o.status === s.statusFilter;
    }).length : data.orders.length;

    let iconEl;
    if (s.id === 'todos') iconEl = <List size={16} />;
    if (s.id === 'aguardando') iconEl = <Clock size={16} />;
    if (s.id === 'separacao') iconEl = <ClipboardList size={16} />;
    if (s.id === 'conferencia') iconEl = <Scan size={16} />;
    if (s.id === 'pronto-coleta') iconEl = <PackageCheck size={16} />;
    if (s.id === 'expedido') iconEl = <Truck size={16} />;
    if (s.id === 'cancelamento-pendente') iconEl = <PackageX size={16} />;
    if (s.id === 'cancelados') iconEl = <XCircle size={16} />;

    // bg hex with opacity for iconBg
    const getHex2 = (hex: string, alpha: number) => {
      if (!hex) return 'transparent';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    return {
      label: s.label,
      count: count,
      accent: s.accent,
      iconEl,
      border: active ? s.accent : t.border,
      bg: active ? getHex2(s.accent, 0.08) : t.cardBg,
      iconBg: getHex2(s.accent, 0.14),
      countColor: active ? s.accent : t.text,
      labelColor: active ? s.accent : t.textSub,
      pick: () => { setActiveFilter(s.id); setCurrentPage(1); }
    };
  });

  const getStatusStyle = (s: string) => {
    const statusMap: Record<string, { bg: string; color: string }> = {
      "NOVO": { bg: "rgba(100,116,139,0.15)", color: "#64748B" },
      // Retirada travada esperando a NF-e de devolucao: ambar, o mesmo tom de
      // atencao usado em divergencia, para nao se confundir com um pedido novo.
      "AGUARDANDO_NF_DEVOLUCAO": { bg: "rgba(245,158,11,0.15)", color: "#F59E0B" },
      "EM_SEPARACAO": { bg: "rgba(59,130,246,0.15)", color: "#3B82F6" },
      "SEPARADO": { bg: "rgba(59,130,246,0.15)", color: "#3B82F6" },
      "EM_CONFERENCIA": { bg: "rgba(139,92,246,0.15)", color: "#8B5CF6" },
      "CONFERIDO": { bg: "rgba(16,185,129,0.15)", color: "#10B981" },
      "PRONTO_ROMANEIO": { bg: "rgba(16,185,129,0.15)", color: "#10B981" },
      "EXPEDIDO": { bg: "rgba(16,185,129,0.15)", color: "#10B981" },
      // Cancelamento em andamento: vermelho mais escuro que CANCELADO, pra
      // sinalizar "em processo" sem confundir com "já cancelado".
      "EM_CANCELAMENTO": { bg: "rgba(220,38,38,0.14)", color: "#DC2626" },
      // Em divergência: âmbar, o mesmo tom de "atenção/aguardando tratativa".
      "EM_DIVERGENCIA": { bg: "rgba(245,158,11,0.15)", color: "#F59E0B" },
      "CANCELADO": { bg: "rgba(239,68,68,0.15)", color: "#EF4444" },
      "DIVERGENTE": { bg: "rgba(245,158,11,0.15)", color: "#F59E0B" },
      "DIVERGENCIA": { bg: "rgba(245,158,11,0.15)", color: "#F59E0B" }
    };
    const mapped = statusMap[s] || { bg: "rgba(148,163,184,0.15)", color: "#64748B" };
    return { statusBg: mapped.bg, statusColor: mapped.color, statusDot: mapped.color };
  };

  const getCarrierStyle = (name: string) => {
    const n = (name || "").toUpperCase();
    if (n.includes("MERCADO LIVRE") || n.includes("MERCADOLIVRE") || n.includes("MELI") || n.includes("MERCADO ENVIOS") || n.includes("MERCADOENVIOS")) return { color: "#CA8A04", bg: "rgba(253,224,71,0.25)", init: "ME" };
    if (n.includes("SHOPEE")) return { color: "#EA580C", bg: "rgba(249,115,22,0.15)", init: "SH" };
    if (n.includes("AMAZON")) return { color: "#EA580C", bg: "rgba(249,115,22,0.15)", init: "AM" };
    if (n.includes("B2W") || n.includes("AMERICANAS")) return { color: "#E11D48", bg: "rgba(225,29,72,0.15)", init: "B2" };
    if (n.includes("MAGALU") || n.includes("MAGAZINE LUIZA")) return { color: "#2563EB", bg: "rgba(37,99,235,0.15)", init: "MG" };
    if (n.includes("ALIEXPRESS") || n.includes("ALI EXPRESS")) return { color: "#E11D48", bg: "rgba(225,29,72,0.15)", init: "AL" };
    if (n.includes("SHEIN")) return { color: "#000000", bg: "rgba(0,0,0,0.1)", init: "SH" };
    if (n.includes("JADLOG")) return { color: "#475569", bg: "rgba(100,116,139,0.15)", init: "JA" };
    if (n.includes("SITE") || n.includes("ECOMMERCE") || n.includes("LOJA")) return { color: "#059669", bg: "rgba(16,185,129,0.15)", init: "LO" };
    const init = (name || "N/A").slice(0, 2).toUpperCase();
    return { color: "#64748B", bg: "rgba(148,163,184,0.15)", init };
  };

  const filteredDataOrders = ordersForOperationalQueue.filter((order: any) => matchesOperationalFilter(order, activeFilter));

  const searchedOrders = filteredDataOrders.filter((o: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (o.displayNumber || o.code || "").toLowerCase().includes(q) || 
           (o.customer || "").toLowerCase().includes(q) ||
           (o.carrierName || o.channel || o.marketplace || "").toLowerCase().includes(q) ||
           (o.nfe || "").toLowerCase().includes(q);
  });

  const sortValue = (order: any, key: OrderSortKey) => {
    const carrier = order.marketplace && order.marketplace !== "Não" && order.marketplace !== "Marketplace"
      ? order.marketplace
      : (order.channel && order.channel !== "BLING" ? order.channel : (order.carrierName || "N/A"));
    switch (key) {
      case "order": return String(order.displayNumber || order.code || order.id || "");
      case "invoice": return String(order.nfe || "");
      case "customer": return String(order.customer || "");
      case "depositante": return String(order.depositante || "");
      case "channel": return String(carrier || "");
      case "items": return Number(order.itemCount ?? order.vol ?? 0);
      case "conference": {
        if (["EXPEDIDO", "PRONTO_ROMANEIO", "CONFERIDO", "ENTREGUE"].includes(order.status)) return 100;
        if (order.status === "EM_CONFERENCIA") return 50;
        if (["EM_SEPARACAO", "SEPARADO"].includes(order.status)) return 25;
        return Number(order.conf ?? 0);
      }
      // The API exposes the canonical creation timestamp, not ageMinutes/ageHours.
      // Use the exact elapsed time so SLA sorting follows the same age shown in the row.
      case "sla": {
        const createdAt = order.createdAtIso ? new Date(order.createdAtIso).getTime() : Number.NaN;
        return Number.isFinite(createdAt) ? Math.max(0, Date.now() - createdAt) : Number.POSITIVE_INFINITY;
      }
      case "status": return String(order.statusLabel || order.status || "");
    }
  };

  const sortedSearchedOrders = [...searchedOrders].sort((left, right) => {
    const leftValue = sortValue(left, sort.key);
    const rightValue = sortValue(right, sort.key);
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), "pt-BR", { sensitivity: "base", numeric: true });
    return sort.direction === "asc" ? comparison : -comparison;
  });

  const changeSort = (key: OrderSortKey) => {
    setCurrentPage(1);
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "order" ? "asc" : "asc" });
  };

  const sortKeyByColumn: Record<string, OrderSortKey | undefined> = {
    "Pedido": "order",
    "NF-e": "invoice",
    "Cliente": "customer",
    "Depositante": "depositante",
    "Canal": "channel",
    "Itens": "items",
    "Conferência": "conference",
    "SLA": "sla",
    "Status": "status"
  };
  const sortLabelByKey: Record<OrderSortKey, string> = {
    order: "pedido",
    invoice: "NF-e",
    customer: "cliente",
    depositante: "depositante",
    channel: "canal",
    items: "itens",
    conference: "conferência",
    sla: "SLA",
    status: "status"
  };
  const sortSummary = `ordenado por ${sortLabelByKey[sort.key]} (${sort.direction === "asc" ? "crescente" : "decrescente"})`;

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(sortedSearchedOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = sortedSearchedOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const orders = paginatedOrders.map((o: any) => {
    const ss = getStatusStyle(o.status);
    let carrierRaw = o.marketplace && o.marketplace !== "Não" && o.marketplace !== "Marketplace" 
      ? o.marketplace 
      : (o.channel && o.channel !== "BLING" ? o.channel : (o.carrierName || "N/A"));
    const cs = getCarrierStyle(carrierRaw);
    
    const isExpedido = ["EXPEDIDO", "ENTREGUE"].includes(o.status);
    const isReadyOrConferido = ["PRONTO_ROMANEIO", "CONFERIDO"].includes(o.status);
    const isConf = o.status === "EM_CONFERENCIA";
    const isSep = ["EM_SEPARACAO", "SEPARADO"].includes(o.status);
    let confRaw = isExpedido ? 100 : (isReadyOrConferido ? 100 : (isConf ? 50 : (isSep ? 25 : 0)));
    if (!isExpedido && !isReadyOrConferido && o.conf !== undefined) confRaw = o.conf;
    
    const isFull = confRaw === 100 || isExpedido;
    const confFill = isFull ? 'linear-gradient(90deg,#10B981,#34D399)' : (confRaw > 0 ? '#3B82F6' : t.barTrack);

    return {
      code: o.displayNumber || o.code || o.id.slice(0, 8),
      customer: o.customer || "Sem cliente",
      city: o.destination || "-",
      owner: o.depositante || "-",
      carrier: carrierRaw,
      carrierInit: cs.init,
      carrierColor: cs.color,
      carrierBg: cs.bg,
      raw: o,
      itemsLabel: `${o.itemCount || o.vol || 0} ${(o.itemCount === 1 || o.vol === 1 ? 'item' : 'itens')}`,
      sla: o.ageLabel || o.sla || "-",
      slaColor: o.ageTone === "LATE" || o.late ? "#EF4444" : (o.ageTone === "WARNING" ? "#F59E0B" : t.text),
      confN: isExpedido ? 100 : confRaw,
      conf: (isExpedido ? 100 : confRaw) + "%",
      confW: (isExpedido ? 100 : confRaw) + "%",
      confFill: confFill,
      statusLabel: o.statusLabel || o.status,
      statusColor: ss.statusColor,
      statusBg: ss.statusBg,
      statusDot: ss.statusDot,
      avatar: o.customer?.[0]?.toUpperCase() || "C",
      id: o.id,
      open: () => {}
    };
  });
  
  const waves: any[] = [];
  const selectedVisibleOrderIds = orders.filter((order: any) => selectedOrderIds.includes(order.id)).map((order: any) => order.id);
  const allVisibleOrdersSelected = orders.length > 0 && selectedVisibleOrderIds.length === orders.length;
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((current) => current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]);
  };
  const toggleVisibleOrderSelection = () => {
    setSelectedOrderIds((current) => {
      const visibleIds = orders.map((order: any) => order.id);
      return allVisibleOrdersSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])];
    });
  };
  const conferenceOrders: any[] = [];
  const scanIcon = <PackageSearch size={20} />;
  const alertIcon = <AlertTriangle size={20} />;
  const divergences = data.orders.filter(isDivergencePendingOrder);
  const ordersCount = searchedOrders.length;
  const columns = canDeleteOrder
    ? ["__select__", "Pedido", "NF-e", "Cliente", "Depositante", "Canal", "Itens", "Conferência", "SLA", "Status", ""]
    : ["Pedido", "NF-e", "Cliente", "Depositante", "Canal", "Itens", "Conferência", "SLA", "Status", ""];
  const divColumns = ["Pedido", "Tipo", "Problema / Divergência", "Depositante", "Registrado por", "Tratativa", ""];
  const inlineOrderUploadFeedback = manualOrderResult.status === "error" && !manualOrderErrorDismissed
    ? {
        title: "N\u00e3o foi poss\u00edvel subir o pedido",
        detail: manualOrderResult.detail || getOrderUploadFeedback(manualOrderResult.feedback)?.detail || "Confira os dados informados e tente novamente.",
        isInline: true,
      }
    : null;
  const feedbackFromRedirect = getOrderUploadFeedback(data.feedback);
  const orderUploadFeedback = inlineOrderUploadFeedback ?? (feedbackFromRedirect ? { ...feedbackFromRedirect, isInline: false } : null);

  return (
    <div className="w-full relative opacity-95">
      {manualOrderSuccessVisible ? (
        <div role="status" aria-live="polite" style={{ position: "fixed", top: 22, right: 22, zIndex: 130, width: "min(390px, calc(100vw - 32px))", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, border: `1px solid ${isDark ? "rgba(52,211,153,.35)" : "#A7F3D0"}`, background: isDark ? "#102A23" : "#ECFDF5", color: isDark ? "#D1FAE5" : "#065F46", boxShadow: "0 16px 36px rgba(15,23,42,.18)", animation: "popIn .2s ease" }}>
          <span style={{ width: 34, height: 34, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 10, background: isDark ? "rgba(16,185,129,.2)" : "#D1FAE5", color: "#059669" }}><CheckCircle2 size={19} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ display: "block", fontSize: 14, fontWeight: 800 }}>Pedido adicionado com sucesso</strong>
            <span style={{ display: "block", marginTop: 2, fontSize: 12, opacity: .82 }}>O pedido já está disponível na fila de expedição.</span>
          </div>
          <button type="button" aria-label="Fechar confirmação" onClick={() => setManualOrderSuccessVisible(false)} style={{ width: 28, height: 28, display: "grid", placeItems: "center", border: 0, borderRadius: 8, background: "transparent", color: "inherit", cursor: "pointer" }}><X size={17} /></button>
        </div>
      ) : null}
      {orderUploadFeedback ? (
        <div role="dialog" aria-modal="true" aria-labelledby="order-upload-feedback-title" style={{ position: "fixed", inset: 0, zIndex: 120, display: "grid", placeItems: "center", padding: 20, background: "rgba(15, 23, 42, .62)", backdropFilter: "blur(4px)", animation: "overlayFade .18s ease" }}>
          <div style={{ width: "min(520px, 100%)", borderRadius: 20, border: `1px solid ${isDark ? "rgba(248,113,113,.35)" : "#FECDD3"}`, background: isDark ? "#111827" : "#FFFFFF", boxShadow: "0 24px 80px rgba(15,23,42,.32)", overflow: "hidden", animation: "popIn .2s ease" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "24px 24px 18px" }}>
              <span style={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 14, background: isDark ? "rgba(248,113,113,.14)" : "#FFF1F2", color: "#E11D48" }}><AlertTriangle size={22} /></span>
              <div style={{ minWidth: 0 }}>
                <h2 id="order-upload-feedback-title" style={{ margin: 0, color: isDark ? "#F8FAFC" : "#0F172A", fontSize: 18, fontWeight: 800 }}>{orderUploadFeedback.title}</h2>
                <p style={{ margin: "9px 0 0", color: isDark ? "#CBD5E1" : "#475569", fontSize: 14, lineHeight: 1.55 }}>{orderUploadFeedback.detail}</p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 24px 20px", borderTop: `1px solid ${isDark ? "#273449" : "#E2E8F0"}` }}>
              <button type="button" onClick={() => {
                if (orderUploadFeedback.isInline) {
                  setManualOrderErrorDismissed(true);
                  return;
                }
                router.replace("/expedicao");
              }} style={{ height: 42, padding: "0 20px", border: 0, borderRadius: 11, background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 18px rgba(99,102,241,.25)" }}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}
      <style>{`
        @keyframes icon-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .animated-icon {
          animation: icon-pulse 2s ease-in-out infinite;
        }
        .flow-card {
          text-decoration: none;
          position: relative;
          padding: 22px;
          border-radius: 16px;
          background: var(--card-bg);
          display: flex;
          flex-direction: column;
          gap: 16px;
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .flow-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: var(--border);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          transition: background 0.18s ease;
        }
        .flow-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow);
        }
        .flow-card:hover::before {
          background: linear-gradient(135deg, var(--accent), transparent);
        }
        .new-order-trigger {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .new-order-trigger:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 26px rgba(99,102,241,0.38) !important;
        }
      `}</style>

      {/* ----------------- EXPEDIÇÃO DASHBOARD VIEW ----------------- */}
      {!isPedidosFull && (
        <>
          {/* title row */}
          <div style={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "20px", flexWrap: "wrap", marginBottom: "24px"}}>
            <div style={{display: "flex", flexDirection: "column", gap: "6px"}}>
              <div style={{display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: `${t.textSub }`}}><span>Operação</span><span>›</span><span style={{color: `${t.text }`, fontWeight: "600"}}>Expedição</span></div>
              <h1 style={{margin: "0", fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: "700"}}>Expedição</h1>
              <p style={{margin: "0", fontSize: "14.5px", color: `${t.textSub }`}}>Conferência de saída, carregamento por doca e despacho de pedidos.</p>
            </div>
            <div style={{display: "flex", gap: "10px", alignItems: "center"}}>
              <div style={{display: "flex", padding: "4px", gap: "4px", borderRadius: "12px", border: `1px solid ${t.border }`, background: `${t.inputBg }`, flexWrap: "wrap"}}>
                <button onClick={setOrders} style={{height: "36px", padding: "0 15px", border: "none", borderRadius: "9px", fontFamily: "'Manrope', sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", background: `${vt.ordersBg }`, color: `${vt.ordersColor }`, transition: "all 0.2s ease"}}>☰ Pedidos</button>
                <button onClick={setDivergence} style={{height: "36px", padding: "0 15px", border: "none", borderRadius: "9px", fontFamily: "'Manrope', sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", background: `${vt.divBg }`, color: `${vt.divColor }`, transition: "all 0.2s ease"}}>⚠ Divergências<span style={{padding: "1px 7px", borderRadius: "999px", fontSize: "11px", background: `${vt.divCountBg }`, color: `${vt.divCountColor }`}}>{divergenceCount }</span></button>
              </div>
              { showAdd  && (
                <button className="new-order-trigger" onClick={() => setNewOrderOpen(true)} style={{height: "44px", padding: "0 20px", border: "none", borderRadius: "11px", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99,102,241,0.32)", display: "flex", alignItems: "center", gap: "8px"}} >{addBtnLabel }</button>
              )}
            </div>
          </div>

          {/* KPI cards */}
          <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px"}}>
            {kpis?.map((k: any, i: number) => <React.Fragment key={i}>
              <div style={{padding: "20px", borderRadius: "16px", border: `1px solid ${t.border }`, background: `${t.cardBg }`, display: "flex", flexDirection: "column", gap: "12px"}}>
                <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                  <span style={{fontSize: "13px", fontWeight: "600", color: `${t.textSub }`}}>{k.label }</span>
                  <span style={{width: "34px", height: "34px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: `${k.iconBg }`, color: `${k.iconColor }`}}>{k.iconEl }</span>
                </div>
                <div style={{display: "flex", alignItems: "baseline", gap: "8px"}}>
                  <span style={{fontFamily: "'Space Grotesk', sans-serif", fontSize: "30px", fontWeight: "700"}}>{k.value }</span>
                  { k.delta ? <span style={{display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "13px", fontWeight: "700", color: `${k.deltaColor }`}}>{k.deltaDirection === "down" ? <ArrowDown size={14} strokeWidth={2.6} /> : <ArrowUp size={14} strokeWidth={2.6} />}{k.delta }</span> : null }
                </div>
              </div>
            </React.Fragment>)}
          </div>

          {/* FLUXO DE TRABALHO */}
          { isOrders && (
            <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px"}}>
              {flowCards?.map((c: any, i: number) => <React.Fragment key={i}>
                <a onClick={c.onClick} className="flow-card" style={{ "--accent": c.accent, "--card-bg": t.cardBg, "--border": t.border, "--shadow": isDark ? "0 16px 32px rgba(0,0,0,0.2)" : "0 16px 32px rgba(0,0,0,0.06)" } as React.CSSProperties} >
                  <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between"}}>
                    <span style={{fontSize: "11px", fontWeight: "800", letterSpacing: "0.12em", color: `${c.accent }`}}>{c.kicker }</span>
                    <span style={{width: "40px", height: "40px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: `${c.iconBg }`, color: `${c.accent }`}}>{c.iconEl }</span>
                  </div>
                  <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
                    <span style={{fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: "700"}}>{c.title }</span>
                    <span style={{fontSize: "12.5px", lineHeight: "1.5", color: `${t.textSub }`}}>{c.desc }</span>
                  </div>
                  <span style={{alignSelf: "flex-start", marginTop: "2px", padding: "8px 15px", borderRadius: "10px", fontSize: "13px", fontWeight: "700", background: `${c.btnBg }`, color: `${c.btnColor }`}}>{c.cta }</span>
                </a>
              </React.Fragment>)}
            </div>
          )}

          {/* ORDERS TABLE DASHBOARD */}
          { isOrders && (
            <div style={{borderRadius: "16px", border: `1px solid ${t.border }`, background: `${t.cardBg }`, overflow: "hidden"}}>
              {/* Linha sem wrap: os chips ficam num container proprio que
                  absorve o espaco livre. Sem isso, ao expandir, a busca
                  (ultimo item) nao cabia e pulava para uma segunda linha,
                  indo parar na esquerda.
                  Os chips rolam na horizontal em vez de quebrar: se
                  quebrassem, abrir a busca aumentaria a altura da linha e a
                  animacao ficaria aos pulos. Assim a altura e constante. */}
              <div style={{display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px", borderBottom: `1px solid ${t.border }`, flexWrap: "nowrap"}}>
                <div className="filter-chips-scroll" style={{display: "flex", alignItems: "center", gap: "10px", flexWrap: "nowrap", flex: "1 1 auto", minWidth: 0, overflowX: "auto", overflowY: "hidden", paddingBottom: "2px"}}>
                  {filters?.map((f: any, i: number) => <React.Fragment key={i}>
                    <button onClick={f.action} style={{height: "36px", padding: "0 15px", borderRadius: "9px", fontFamily: "'Manrope', sans-serif", fontSize: "13px", fontWeight: "700", cursor: "pointer", border: `1px solid ${f.border }`, background: `${f.bg }`, color: `${f.color }`, transition: "all 0.18s ease", display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap"}}>{f.label }{ f.hasCount && (<span style={{padding: "1px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: `${f.countFw || "600"}`, background: `${f.countBg }`, color: `${f.countColor }`}}>{f.count }</span>)}</button>
                  </React.Fragment>)}
                </div>
                {canDeleteOrder && selectedOrderIds.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <form action={bulkChangeShippingOrderStatusAction} onSubmit={(event) => {
                      if (!window.confirm(`Alterar o status de ${selectedOrderIds.length} pedido(s) selecionado(s)?`)) {
                        event.preventDefault();
                      }
                    }} style={{ display: "flex", gap: "6px" }}>
                      <input type="hidden" name="ids" value={JSON.stringify(selectedOrderIds)} />
                      <input type="hidden" name="status" value={bulkSelectedStatus} />

                      <div style={{ position: "relative", width: "190px" }}>
                        <button
                          type="button"
                          aria-haspopup="listbox"
                          aria-expanded={bulkStatusMenuOpen}
                          onClick={() => setBulkStatusMenuOpen((open) => !open)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", width: "100%", height: "36px", padding: "0 11px", borderRadius: "9px", border: `1.5px solid ${bulkStatusMenuOpen ? "#3B82F6" : t.border}`, background: t.inputBg, color: t.text, fontSize: "12.5px", fontWeight: 700, cursor: "pointer", outline: "none", boxShadow: bulkStatusMenuOpen ? "0 0 0 3px rgba(59,130,246,.13)" : "none", transition: "border-color .16s ease, box-shadow .16s ease" }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {bulkSelectedStatus ? manualOrderStatusOptions.find(([v]) => v === bulkSelectedStatus)?.[1] : "Alterar status para..."}
                          </span>
                          <ChevronDown size={15} color={bulkStatusMenuOpen ? "#3B82F6" : t.textSub} style={{ flexShrink: 0, transform: bulkStatusMenuOpen ? "rotate(180deg)" : "none", transition: "transform .16s ease" }} />
                        </button>
                        {bulkStatusMenuOpen ? (
                          <div role="listbox" style={{ position: "absolute", zIndex: 30, top: "calc(100% + 6px)", left: 0, right: 0, maxHeight: "230px", overflowY: "auto", padding: "6px", borderRadius: "10px", border: `1px solid ${t.border}`, background: t.cardBg, boxShadow: isDark ? "0 16px 32px rgba(0,0,0,0.2)" : "0 16px 32px rgba(0,0,0,0.08)", animation: "popIn .16s ease" }}>
                            {manualOrderStatusOptions.map(([value, label]) => {
                              const isSelected = value === bulkSelectedStatus;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => { setBulkSelectedStatus(value); setBulkStatusMenuOpen(false); }}
                                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: "34px", padding: "0 9px", border: 0, borderRadius: "7px", background: isSelected ? (isDark ? "rgba(59,130,246,.12)" : "#EFF6FF") : "transparent", color: isSelected ? "#2563EB" : t.text, fontSize: "12.5px", fontWeight: isSelected ? 800 : 600, textAlign: "left", cursor: "pointer" }}
                                >
                                  <span>{label}</span>
                                  {isSelected ? <Check size={15} color="#2563EB" /> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      <button type="submit" disabled={!bulkSelectedStatus} style={{ opacity: bulkSelectedStatus ? 1 : 0.5, height: "36px", padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: "9px", background: "linear-gradient(90deg, #3B82F6, #8B5CF6)", color: "#fff", fontSize: "12.5px", fontWeight: 800, cursor: bulkSelectedStatus ? "pointer" : "default", whiteSpace: "nowrap" }}>
                        Aplicar
                      </button>
                    </form>
                    <form action={bulkDeleteShippingOrdersAction} onSubmit={(event) => {
                      if (!window.confirm(`Excluir ${selectedOrderIds.length} pedido(s) selecionado(s)? Documentos, itens e vínculos operacionais também serão removidos. Esta ação não pode ser desfeita.`)) event.preventDefault();
                    }}>
                      <input type="hidden" name="ids" value={JSON.stringify(selectedOrderIds)} />
                      <button type="submit" title={`Excluir ${selectedOrderIds.length} pedido(s)`} style={{ width: "36px", height: "36px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(244,63,94,.42)", borderRadius: "9px", background: isDark ? "rgba(244,63,94,.12)" : "#FFF1F2", color: "#E11D48", cursor: "pointer" }}><Trash2 size={16} /></button>
                    </form>
                  </div>
                ) : null}

                {/* Busca na extremidade direita. E um unico container que anima
                    a largura de 36px (so a lupa) ate 320px; como ele e o ultimo
                    item da linha, a borda direita fica fixa e o crescimento
                    acontece para a esquerda. Manter um unico elemento (em vez de
                    trocar botao por caixa) e o que permite a transicao ser
                    continua. O estado da busca e o mesmo da listagem completa:
                    ambas as tabelas leem de searchedOrders. */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    height: "36px",
                    width: searchOpen ? "320px" : "36px",
                    borderRadius: "9px",
                    border: `1px solid ${searchOpen ? t.border : "transparent"}`,
                    background: searchOpen ? t.inputBg : "transparent",
                    overflow: "hidden",
                    transition: "width .32s cubic-bezier(.22,1,.36,1), background-color .22s ease, border-color .22s ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (searchOpen) {
                        searchInputRef.current?.focus();
                      } else {
                        setSearchOpen(true);
                      }
                    }}
                    aria-label="Buscar pedidos"
                    aria-expanded={searchOpen}
                    title="Buscar pedidos"
                    style={{ width: "34px", height: "34px", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: "9px", background: "transparent", color: t.textSub, cursor: "pointer" }}
                  >
                    <Search size={16} />
                  </button>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    tabIndex={searchOpen ? 0 : -1}
                    aria-hidden={!searchOpen}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearchQuery("");
                        setSearchOpen(false);
                        setCurrentPage(1);
                      }
                    }}
                    placeholder="Buscar pedido, cliente, NF, marketplace..."
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: t.text,
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: "13px",
                      opacity: searchOpen ? 1 : 0,
                      transition: "opacity .18s ease",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setSearchOpen(false); setCurrentPage(1); }}
                    aria-label="Fechar busca"
                    tabIndex={searchOpen ? 0 : -1}
                    title="Fechar busca"
                    style={{ width: "24px", height: "24px", flexShrink: 0, marginRight: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: "6px", background: "transparent", color: t.textSub, cursor: "pointer", opacity: searchOpen ? 1 : 0, pointerEvents: searchOpen ? "auto" : "none", transition: "opacity .18s ease" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div style={{overflowX: "auto"}}>
                <table style={{width: "100%", borderCollapse: "collapse", minWidth: "960px"}}>
                  <thead>
                    <tr style={{textAlign: "left"}}>
                      {columns?.map((c: any, i: number) => <React.Fragment key={i}>
                        <th style={{padding: "13px 20px", fontSize: "12px", fontWeight: "700", letterSpacing: "0.04em", textTransform: "uppercase", color: `${t.textSub }`, background: `${t.headBg }`, borderBottom: `1px solid ${t.border }`, whiteSpace: "nowrap"}}>
                          {c === "__select__" ? (
                            <input type="checkbox" aria-label="Selecionar pedidos visíveis" checked={allVisibleOrdersSelected} onChange={toggleVisibleOrderSelection} style={{ width: 16, height: 16, accentColor: "#7C3AED", cursor: "pointer" }} />
                          ) : sortKeyByColumn[c] ? (
                            <button type="button" onClick={() => changeSort(sortKeyByColumn[c]!)} aria-label={`Ordenar por ${c}`} aria-sort={sort.key === sortKeyByColumn[c] ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: 0, border: 0, background: "transparent", color: sort.key === sortKeyByColumn[c] ? "#8B5CF6" : "inherit", font: "inherit", textTransform: "inherit", letterSpacing: "inherit", cursor: "pointer", transition: "color 0.18s ease" }}>
                              {c}{sort.key === sortKeyByColumn[c] ? (sort.direction === "asc" ? <ArrowUp size={13} strokeWidth={2.5} /> : <ArrowDown size={13} strokeWidth={2.5} />) : <ArrowUpDown size={13} strokeWidth={2.2} style={{ opacity: 0.55 }} />}
                            </button>
                          ) : c}
                        </th>
                      </React.Fragment>)}
                    </tr>
                  </thead>
                  <tbody>
                    {orders?.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} style={{ padding: "60px 20px", textAlign: "center", color: t.textSub, fontSize: "14px", fontWeight: "500" }}>
                          {searchQuery
                            ? `Nenhum pedido encontrado para "${searchQuery}" neste filtro.`
                            : "Nenhum pedido encontrado para este filtro."}
                        </td>
                      </tr>
                    ) : null}
                    {orders?.map((o: any, i: number) => <React.Fragment key={i}>
                      <tr onClick={() => setSelectedOrder(o)} style={{borderBottom: `1px solid ${t.border }`, cursor: "pointer", transition: "background 0.15s ease"}} >
                        {canDeleteOrder ? <td style={{ padding: "14px 12px 14px 20px", width: 42 }}><input type="checkbox" aria-label={`Selecionar ${o.code}`} checked={selectedOrderIds.includes(o.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleOrderSelection(o.id)} style={{ width: 16, height: 16, accentColor: "#7C3AED", cursor: "pointer" }} /></td> : null}
                        <td style={{padding: "14px 20px"}}><span style={{fontFamily: "'Space Grotesk', sans-serif", fontWeight: "700", fontSize: "14.5px"}}>{o.code }</span></td>
                        <td style={{ padding: "14px 20px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap" }}>{o.raw?.nfe || "-"}</td>
                        <td style={{padding: "14px 20px"}}>
                          <div style={{display: "flex", flexDirection: "column", gap: "2px"}}>
                            <span style={{fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px"}}>{o.customer }</span>
                            <span style={{fontSize: "12px", color: `${t.textSub }`}}>{o.city }</span>
                          </div>
                        </td>
                        <td style={{padding: "14px 20px", fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px"}}>{o.owner }</td>
                        <td style={{padding: "14px 20px"}}><span style={{display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13.5px", fontWeight: "600"}}><span style={{width: "24px", height: "24px", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", background: `${o.carrierBg }`, color: `${o.carrierColor }`}}>{o.carrierInit }</span>{o.carrier }</span></td>
                        <td style={{padding: "14px 20px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: "600"}}>{o.itemsLabel }</td>
                        <td style={{padding: "14px 20px", minWidth: "150px"}}>
                          <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                            <div style={{flex: "1", height: "6px", borderRadius: "999px", background: `${t.barTrack }`, overflow: "hidden"}}><div style={{height: "100%", width: `${o.confW }`, borderRadius: "999px", background: `${o.confFill }`}}></div></div>
                            <span style={{fontSize: "12.5px", fontWeight: "700", width: "38px", textAlign: "right"}}>{o.conf }</span>
                          </div>
                        </td>
                        <td style={{padding: "14px 20px"}}><span style={{fontSize: "13px", fontWeight: "700", color: `${o.slaColor }`}}>{o.sla }</span></td>
                        <td style={{padding: "14px 20px"}}><span style={{display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", background: `${o.statusBg }`, color: `${o.statusColor }`}}><span style={{width: "7px", height: "7px", borderRadius: "50%", background: `${o.statusDot }`}}></span>{o.statusLabel }</span></td>
                        <td style={{padding: "14px 20px", textAlign: "right"}}><span style={{color: `${t.textSub }`, fontWeight: "700"}} >›</span></td>
                      </tr>
                    </React.Fragment>)}
                  </tbody>
                </table>
              </div>
              <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: `1px solid ${t.border }`, flexWrap: "wrap", gap: "12px"}}>
                <span style={{fontSize: "13px", color: `${t.textSub }`}}>Mostrando {searchedOrders.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, searchedOrders.length)} de {searchedOrders.length} pedidos</span>
                <div style={{display: "flex", gap: "6px"}}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border }`, background: `${t.inputBg }`, color: currentPage === 1 ? 'rgba(100,116,139,0.3)' : `${t.textSub }`, cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: "13px"}}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => totalPages <= 5 || p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((pageNum, index, arr) => {
                      const isCurr = pageNum === currentPage;
                      const prev = arr[index - 1];
                      return (
                        <React.Fragment key={pageNum}>
                          {prev && pageNum - prev > 1 && <span style={{display: "inline-flex", alignItems: "flex-end", padding: "0 4px", color: t.textSub}}>...</span>}
                          <button onClick={() => setCurrentPage(pageNum)} style={{width: "34px", height: "34px", borderRadius: "8px", border: isCurr ? "none" : `1px solid ${t.border }`, background: isCurr ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : `${t.inputBg }`, color: isCurr ? "#fff" : `${t.text }`, cursor: "pointer", fontSize: "13px", fontWeight: isCurr ? "700" : "500"}}>{pageNum}</button>
                        </React.Fragment>
                      );
                    })
                  }
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border }`, background: `${t.inputBg }`, color: currentPage === totalPages ? 'rgba(100,116,139,0.3)' : `${t.textSub }`, cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: "13px"}}>›</button>
                </div>
              </div>
            </div>
          )}
          
          {/* DIVERGÊNCIAS VIEW */}
          {isDivergence && (
            <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
                <span style={{ width: "34px", height: "34px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.14)", color: "#EF4444", flexShrink: 0 }}>
                  {alertIcon}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "15.5px", fontWeight: 700, color: t.text }}>Divergências & pendências</span>
                  <span style={{ fontSize: "12.5px", color: t.textSub }}>Pedidos travados aguardando tratativa antes da expedição.</span>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: "13px", color: t.textSub, whiteSpace: "nowrap" }}>{divergences.length} pendência{divergences.length === 1 ? "" : "s"}</span>
              </div>
              {divergences.length === 0 ? (
                <div style={{ padding: "44px 24px", textAlign: "center", color: t.textSub }}>Nenhuma divergência pendente.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                    <thead>
                      <tr style={{ textAlign: "left", background: t.headBg }}>
                        {divColumns.map((column) => <th key={column} style={{ padding: "13px 20px", color: t.textSub, fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>{column}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {divergences.map((order: any) => {
                        const orderDepositante = order.owner || order.depositante || order.raw?.depositante || "-";
                        const isDiv = order.status === "DIVERGENCIA" || order.status === "DIVERGENTE" || Boolean(order.divergenceReporter || order.cancellationReporter || order.cancellationReason);
                        const reason = order.cancellationReason
                          || order.raw?.cancellationReason
                          || (isDiv ? "Divergência reportada durante a conferência/separação." : order.status === "ERRO" ? "Falha no processamento do pedido." : "Sem estoque para concluir a separação.");
                        const issueType = order.status === "ERRO" ? "Erro de integração" : isDiv ? "Divergência" : "Cancelado";
                        const issueColor = order.status === "ERRO" ? "#F97316" : isDiv ? "#F59E0B" : "#EF4444";
                        const registeredBy = order.divergenceReporter
                          || order.raw?.divergenceReporter
                          || order.cancellationReporter
                          || order.raw?.cancellationReporter
                          || (order.createdByName || order.raw?.createdByName
                            ? [order.createdByName || order.raw?.createdByName, order.createdByRole || order.raw?.createdByRole].filter(Boolean).join(" · ")
                            : order.createdBySource || order.raw?.createdBySource || "Sistema");
                        const tratamento = order.tratamentoDivergencia
                          || order.raw?.payload_origem?.tratamentoDivergencia
                          || order.raw?.tratamentoDivergencia;

                        let tratativaEl;
                        if (tratamento?.acao === "PROSSEGUIR_COM_DIVERGENCIA") {
                          tratativaEl = (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: "rgba(16,185,129,0.15)", color: "#10B981" }}>
                              <CheckCircle2 size={13} /> Prosseguir c/ Divergência
                            </span>
                          );
                        } else if (tratamento?.acao === "CANCELAR_DEFINITIVO") {
                          tratativaEl = (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>
                              <XCircle size={13} /> Cancelado Definitivo
                            </span>
                          );
                        } else if (tratamento?.acao) {
                          tratativaEl = (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: "rgba(139,92,246,0.15)", color: "#8B5CF6" }}>
                              {tratamento.acao}
                            </span>
                          );
                        } else {
                          tratativaEl = (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
                              <Clock size={13} /> Aguardando depositante
                            </span>
                          );
                        }

                        return (
                          <tr
                            key={order.id}
                            onClick={() => setTreatingDivergenceOrder({ ...order, cancellationReason: reason, divergenceReporter: registeredBy, depositante: orderDepositante })}
                            style={{ borderBottom: `1px solid ${t.border}`, transition: "background 0.15s ease", cursor: "pointer" }}
                            onMouseEnter={(event) => { event.currentTarget.style.background = t.softBg; }}
                            onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
                          >
                            <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}><span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14.5px", color: t.text }}>{order.displayNumber || order.code}</span></td>
                            <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13.5px", fontWeight: 700, color: issueColor }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: issueColor }} />{issueType}</span></td>
                            <td style={{ padding: "14px 20px", fontSize: "13.5px", color: t.textSub, maxWidth: "300px" }}>{reason}</td>
                            <td style={{ padding: "14px 20px", fontSize: "14px", fontWeight: 600, color: t.text }}>{orderDepositante}</td>
                            <td style={{ padding: "14px 20px", fontSize: "13.5px", color: t.textSub }}>{registeredBy}</td>
                            <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>{tratativaEl}</td>
                            <td style={{ padding: "14px 20px", textAlign: "right" }}><span style={{ color: t.textSub, fontWeight: "700", fontSize: "16px" }}>›</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ----------------- PEDIDOS FULL VIEW (infinoos-wms-pedidos) ----------------- */}
      {uploadModalOpen.open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm" onClick={() => setUploadModalOpen({ open: false, type: "NF" })}>
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-950 dark:text-white">Anexar documento</h4>
              <button onClick={() => setUploadModalOpen({ open: false, type: "NF" })} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-white">✕</button>
            </div>
            <p className="mb-6 text-sm text-slate-600 dark:text-zinc-400">
              Anexe um documento (Carta de correção, NF-e, Etiqueta ou outro) ao pedido <strong>{selectedOrder?.code}</strong>.
            </p>
            {selectedOrder?.raw?.id && selectedOrder?.raw?.depositanteId ? (
              <ShippingAttachmentUploadPanel
                depositanteId={selectedOrder.raw.depositanteId}
                pedidoExpedicaoId={selectedOrder.raw.id}
                defaultTipo={uploadModalOpen.type}
                onSuccess={() => {
                  setUploadModalOpen({ open: false, type: "CARTA_CORRECAO" });
                }}
              />
            ) : (
              <p className="text-sm text-rose-500">Erro: Pedido não possui depositante vinculado.</p>
            )}
          </div>
        </div>, document.body
      ) : null}

      {isPedidosFull && (
        <div style={{ display: "flex", flexDirection: "column", animation: "drawerIn 0.35s cubic-bezier(0.3, 1, 0.4, 1)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "20px", flexWrap: "wrap", marginBottom: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setActiveTab('orders')}
                  className="inline-flex items-center justify-center h-[40px] px-4 rounded-[12px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] font-bold text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm cursor-pointer"
                >
                  <span className="mr-1.5 text-slate-500 font-normal">‹</span> Expedição
                </button>
                <div className="flex items-center gap-2 text-[14px] ml-1">
                  <span className="text-slate-500">Expedição</span>
                  <span className="text-slate-300 text-[12px]">›</span>
                  <span className="text-slate-900 dark:text-slate-100 font-medium">Pedidos</span>
                </div>
              </div>
              <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: "700" }}>Pedidos</h1>
              <p style={{ margin: 0, fontSize: "14.5px", color: t.textSub }}>Listagem completa da fila de expedição por etapa do fluxo.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button className="new-order-trigger" onClick={() => setNewOrderOpen(true)} style={{ height: "44px", padding: "0 20px", border: "none", borderRadius: "11px", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99, 102, 241, 0.32)", display: "flex", alignItems: "center", gap: "8px" }}>
                + Novo pedido
              </button>
            </div>
          </div>

            {/* pipeline stages */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "12px", marginBottom: "24px" }}>
              {stages.map((s: any, i: number) => (
                <button
                  key={i}
                  onClick={s.pick}
                  style={{ textAlign: "left", padding: "16px", borderRadius: "14px", cursor: "pointer", border: `1px solid ${s.border}`, background: s.bg, display: "flex", flexDirection: "column", gap: "10px", transition: "all 0.18s ease" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ width: "30px", height: "30px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", background: s.iconBg, color: s.accent }}>{s.iconEl}</span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: "700", color: s.countColor }}>{s.count}</span>
                  </div>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: s.labelColor }}>{s.label}</span>
                </button>
              ))}
            </div>

            {/* table */}
            <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "16px 20px", borderBottom: `1px solid ${t.border}`, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "15px", fontWeight: "700" }}>{stagesDefs.find(x => x.id === activeFilter)?.label || "Pedidos"}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "36px", width: "320px", padding: "0 12px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg }}>
                    <Search size={16} color={t.textSub}/>
                    <input
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar pedido, cliente, NF, marketplace..."
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "13px" }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}></div>
                <span style={{ fontSize: "13px", color: t.textSub }}>{ordersCount} pedidos · {sortSummary}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "980px" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      {columns.map((c: any, i: number) => (
                        <th key={i} style={{ padding: "13px 20px", fontSize: "12px", fontWeight: "700", letterSpacing: "0.04em", textTransform: "uppercase", color: t.textSub, background: t.headBg, borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>
                          {sortKeyByColumn[c] ? (
                            <button type="button" onClick={() => changeSort(sortKeyByColumn[c]!)} aria-label={`Ordenar por ${c}`} aria-sort={sort.key === sortKeyByColumn[c] ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: 0, border: 0, background: "transparent", color: sort.key === sortKeyByColumn[c] ? "#8B5CF6" : "inherit", font: "inherit", textTransform: "inherit", letterSpacing: "inherit", cursor: "pointer", transition: "color 0.18s ease" }}>
                              {c}{sort.key === sortKeyByColumn[c] ? (sort.direction === "asc" ? <ArrowUp size={13} strokeWidth={2.5} /> : <ArrowDown size={13} strokeWidth={2.5} />) : <ArrowUpDown size={13} strokeWidth={2.2} style={{ opacity: 0.55 }} />}
                            </button>
                          ) : c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} style={{ padding: "60px 20px", textAlign: "center", color: t.textSub, fontSize: "14px", fontWeight: "500" }}>
                          Nenhum pedido encontrado para este filtro.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o: any, i: number) => (
                        <tr key={i} onClick={() => setSelectedOrder(o)} style={{ borderBottom: `1px solid ${t.border}`, cursor: "pointer", transition: "background 0.15s ease" }}>
                        {canDeleteOrder ? <td style={{ padding: "14px 12px 14px 20px", width: 42 }}><input type="checkbox" aria-label={`Selecionar ${o.code}`} checked={selectedOrderIds.includes(o.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleOrderSelection(o.id)} style={{ width: 16, height: 16, accentColor: "#7C3AED", cursor: "pointer" }} /></td> : null}
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: "700", fontSize: "14.5px" }}>{o.code}</span>
                            {o.raw?.isFull ? <span title="Pedido Full" style={{ display: "inline-flex", alignItems: "center", padding: "3px 7px", borderRadius: "999px", background: "rgba(245,158,11,.14)", color: "#D97706", border: "1px solid rgba(245,158,11,.28)", fontSize: "10px", lineHeight: 1, fontWeight: "800", letterSpacing: "0.06em" }}>FULL</span> : null}
                            {o.raw?.isRetirada ? <span title="Devolução ao cliente — retirada de mercadoria solicitada pelo depositante" style={{ display: "inline-flex", alignItems: "center", padding: "3px 7px", borderRadius: "999px", background: "rgba(244,63,94,.14)", color: "#E11D48", border: "1px solid rgba(244,63,94,.28)", fontSize: "10px", lineHeight: 1, fontWeight: "800", letterSpacing: "0.06em" }}>RETIRADA</span> : null}
                            {o.raw?.awaitingReturnInvoice ? <span title="Bloqueado até o upload da NF-e de devolução" style={{ display: "inline-flex", alignItems: "center", padding: "3px 7px", borderRadius: "999px", background: "rgba(100,116,139,.16)", color: "#475569", border: "1px solid rgba(100,116,139,.3)", fontSize: "10px", lineHeight: 1, fontWeight: "800", letterSpacing: "0.06em" }}>SEM NF</span> : null}
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap" }}>{o.raw?.nfe || "-"}</td>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "190px" }}>{o.customer}</span>
                            <span style={{ fontSize: "12px", color: t.textSub }}>{o.city}</span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px", fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "170px" }}>{o.owner}</td>
                        <td style={{ padding: "14px 20px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13.5px", fontWeight: "600" }}><span style={{ width: "24px", height: "24px", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", background: o.carrierBg, color: o.carrierColor }}>{o.carrierInit}</span>{o.carrier}</span></td>
                        <td style={{ padding: "14px 20px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: "600" }}>{o.itemsLabel}</td>
                        <td style={{ padding: "14px 20px", minWidth: "150px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ flex: 1, height: "6px", borderRadius: "999px", background: t.barTrack, overflow: "hidden" }}><div style={{ height: "100%", width: o.confW, borderRadius: "999px", background: o.confFill }}></div></div>
                            <span style={{ fontSize: "12.5px", fontWeight: "700", width: "38px", textAlign: "right" }}>{o.conf}</span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px" }}><span style={{ fontSize: "13px", fontWeight: "700", color: o.slaColor }}>{o.sla}</span></td>
                        <td style={{ padding: "14px 20px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", background: o.statusBg, color: o.statusColor }}><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: o.statusDot }}></span>{o.statusLabel}</span></td>
                        <td style={{ padding: "14px 20px", textAlign: "right" }}><span style={{ color: t.textSub, fontWeight: "700" }}>›</span></td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: `1px solid ${t.border}`, flexWrap: "wrap", gap: "12px" }}>
                <span style={{ fontSize: "13px", color: t.textSub }}>Mostrando {searchedOrders.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, searchedOrders.length)} de {searchedOrders.length} pedidos</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: currentPage === 1 ? 'rgba(100,116,139,0.3)' : t.textSub, cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: "13px" }}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => totalPages <= 5 || p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((pageNum, index, arr) => {
                      const isCurr = pageNum === currentPage;
                      const prev = arr[index - 1];
                      return (
                        <React.Fragment key={pageNum}>
                          {prev && pageNum - prev > 1 && <span style={{ display: "inline-flex", alignItems: "flex-end", padding: "0 4px", color: t.textSub }}>...</span>}
                          <button onClick={() => setCurrentPage(pageNum)} style={{ width: "34px", height: "34px", borderRadius: "8px", border: isCurr ? "none" : `1px solid ${t.border}`, background: isCurr ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : t.inputBg, color: isCurr ? "#fff" : t.text, cursor: "pointer", fontSize: "13px", fontWeight: isCurr ? "700" : "500" }}>{pageNum}</button>
                        </React.Fragment>
                      );
                    })
                  }
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: currentPage === totalPages ? 'rgba(100,116,139,0.3)' : t.textSub, cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: "13px" }}>›</button>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* ============ DETAIL DRAWER (NEW COMPLEX ONE) ============ */}
      {selectedOrder && (() => {
        const sel = selectedOrder;
        
        // Timeline moves logic (matching infinoos-wms-pedidos.html)
        const getTimelineSteps = (status: string, o: any) => {
          if (status === 'CANCELADO') {
            return [
              {
                title: 'Pedido cancelado',
                sub: o?.raw?.cancellationReason ? `Motivo: ${o.raw.cancellationReason}` : (o?.raw?.cancellationReporter ? `Cancelado por ${o.raw.cancellationReporter}` : 'Cancelamento definitivo'),
                dot: '#EF4444',
                halo: 'rgba(239, 68, 68, 0.2)',
                line: 'transparent',
                titleColor: '#EF4444'
              }
            ];
          }

          let orderIdx = 0;
          if (status === 'EM_SEPARACAO' || status === 'SEPARADO') orderIdx = 1;
          else if (status === 'EM_CONFERENCIA') orderIdx = 2;
          else if (status === 'CONFERIDO' || status === 'PRONTO_ROMANEIO') orderIdx = 3;
          else if (status === 'EXPEDIDO' || status === 'ENTREGUE') orderIdx = 4;

          const formatIsoTime = (isoString?: string | null) => {
            if (!isoString) return "";
            const d = new Date(isoString);
            if (Number.isNaN(d.getTime())) return "";
            return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'});
          };

          const stepMeta = [
            { title: 'Pedido recebido', sub: o?.raw?.orderDate ? `Em ${o.raw.orderDate}` : 'Integração e-commerce' },
            { 
              title: 'Em separação', 
              sub: o?.raw?.pickingOperator ? `Separado por ${o.raw.pickingOperator}${o.raw.pickingAt ? ` em ${o.raw.pickingAt}` : ''}` : 'Picking no armazém',
              customData: Boolean(o?.raw?.pickingOperator)
            },
            { 
              title: 'Conferência', 
              sub: o?.raw?.conferenceOperator ? `Conferido por ${o.raw.conferenceOperator}${o.raw.conferenceAt ? ` em ${o.raw.conferenceAt}` : ''}` : 'Validação de saída',
              customData: Boolean(o?.raw?.conferenceOperator)
            },
            { 
              title: 'Expedido', 
              sub: o?.raw?.dispatchedAtIso ? `Despachado${formatIsoTime(o.raw.dispatchedAtIso) ? ` em ${formatIsoTime(o.raw.dispatchedAtIso)}` : ''}` : 'Despacho / coleta',
              customData: Boolean(o?.raw?.dispatchedAtIso)
            }
          ];

          return stepMeta.map((s, i) => {
            const done = i < orderIdx, cur = i === orderIdx;
            return {
              title: s.title,
              sub: (done || cur) && s.customData ? s.sub : (done ? 'Concluído' : (cur ? 'Em andamento' : s.sub)),
              dot: done ? '#10B981' : (cur ? '#8B5CF6' : t.barTrack),
              halo: done ? 'rgba(16,185,129,0.18)' : (cur ? 'rgba(139,92,246,0.2)' : 'transparent'),
              line: i < orderIdx ? '#10B981' : t.border,
              titleColor: done || cur ? t.text : t.textSub
            };
          });
        };

        const moves = getTimelineSteps(sel.raw?.status || sel.status || "", sel);
        const specs = [
          ...(sel.raw?.isFull ? [{
            k: "Operação Full",
            v: sel.raw.fullShipmentCode || "Remessa Full",
            sub: [
              sel.raw.fullShippingMode === "COLETA" ? "Coleta do marketplace" : sel.raw.fullCarrier || "Transportadora informada",
              sel.raw.fullCollectionAt ? `Coleta prevista: ${new Date(sel.raw.fullCollectionAt).toLocaleDateString("pt-BR")}` : null,
            ].filter(Boolean).join(" · "),
            fullWidth: true,
          }] : []),
          { k: "Canal", v: sel.carrier || "-" },
          { k: "Depositante", v: sel.owner || "-" },
          { k: "Nota fiscal", v: sel.raw?.nfe || "-" },
          { k: "Corte (SLA)", v: sel.sla || "-" },
          {
            k: "Criado por",
            v: sel.raw?.createdByName
              ? [sel.raw.createdByName, sel.raw.createdByRole].filter(Boolean).join(" · ")
              : sel.raw?.createdBySource || "Sistema",
            sub: sel.raw?.createdByAt ? `Em ${sel.raw.createdByAt}` : undefined,
            fullWidth: true,
          }
        ];

        const isRingConcluded = ['CONFERIDO', 'PRONTO_ROMANEIO', 'EXPEDIDO', 'ENTREGUE'].includes(sel.raw?.status) || ['CONFERIDO', 'PRONTO_ROMANEIO', 'EXPEDIDO', 'ENTREGUE'].includes(sel.status);
        const confN = isRingConcluded ? 100 : (Number(sel.confN ?? (sel.conf ? parseInt(sel.conf) : 0)) || 0);
        const ring = {
          c1: isRingConcluded ? '#10B981' : '#3B82F6', c2: isRingConcluded ? '#059669' : '#8B5CF6',
          circ: 289,
          offset: 289 - (289 * confN) / 100
        };

        // Try to map real items if they exist
        const realItems = sel.raw?.items || [];
        const nItems = Math.max(1, realItems.length > 0 ? realItems.length : (sel.raw?.itemCount || 3));
        const doneItems = Math.round(nItems * confN / 100);
        const itemsToUse = [];
        for (let i = 0; i < nItems; i++) {
          const r = realItems[i] || {};
          const isDone = i < doneItems;
          itemsToUse.push({
            name: r.name || r.productName || `Produto Genérico ${i+1}`,
            sku: r.sku || r.productSku || `SKU-100${i}`,
            qty: (r.quantity || 1) + ' un',
            qtyColor: isDone ? '#10B981' : t.textSub,
            mark: isDone ? '✓' : '',
            checkBorder: isDone ? '#10B981' : t.border,
            checkBg: isDone ? '#10B981' : 'transparent'
          });
        }

        const isDivergent = sel.statusLabel === "Aguardando tratativa";
        const btnText = isDivergent
          ? "Fechar"
          : sel.raw?.status === "AGUARDANDO_NF_DEVOLUCAO"
          ? "Anexar NF-e de devolução ›"
          : (sel.raw?.status === "NOVO" || sel.raw?.status === "EM_SEPARACAO")
          ? "Iniciar Separação ›"
          : (sel.raw?.status === "SEPARADO" || sel.raw?.status === "EM_CONFERENCIA")
          ? "Iniciar Conferência ›"
          : (sel.raw?.status === "CONFERIDO" || sel.raw?.status === "PRONTO_ROMANEIO")
          ? "Ver em Conferidos ›"
          : "Fechar";

        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
            <div
              onClick={() => setSelectedOrder(null)}
              style={{ position: "absolute", inset: 0, background: "rgba(6, 10, 20, 0.55)", backdropFilter: "blur(3px)", animation: "overlayFade 0.25s ease" }}
            ></div>
            <div style={{ position: "relative", width: "460px", maxWidth: "92vw", height: "100%", background: t.drawerBg, borderLeft: `1px solid ${t.border}`, boxShadow: "-24px 0 60px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", animation: "drawerIn 0.32s cubic-bezier(.3,1,.4,1)", overflow: "hidden" }}>
              <div style={{ position: "relative", padding: "24px 24px 20px 24px", borderBottom: `1px solid ${t.border}`, overflow: "hidden" }}>
                <div style={{ position: "absolute", width: "260px", height: "260px", right: "-80px", top: "-120px", borderRadius: "50%", background: "radial-gradient(circle, rgba(139, 92, 246, 0.28), transparent 70%)", pointerEvents: "none" }}></div>
                <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.12em", color: t.textSub }}>PEDIDO</span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "26px", fontWeight: "700", lineHeight: "1" }}>{sel.code}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", alignSelf: "flex-start", padding: "5px 12px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", background: sel.statusBg, color: sel.statusColor }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: sel.statusDot }}></span>{sel.statusLabel}
                    </span>
                    {sel.raw?.isFull ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", alignSelf: "flex-start", padding: "5px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: "800", letterSpacing: "0.08em", background: "rgba(245,158,11,.14)", color: "#D97706", border: "1px solid rgba(245,158,11,.3)" }}>
                        FULL
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {canDeleteOrder && sel.raw?.id && <form action={deleteShippingOrderAction} onSubmit={(event) => { if (!window.confirm(`Excluir o pedido ${sel.code}? Esta ação não pode ser desfeita.`)) event.preventDefault(); }}>
                      <input type="hidden" name="id" value={sel.raw.id} />
                      <button type="submit" aria-label="Excluir pedido" title="Excluir pedido" style={{ width: "36px", height: "36px", display: "grid", placeItems: "center", flexShrink: 0, borderRadius: "10px", border: "1px solid rgba(239,68,68,.28)", background: "rgba(239,68,68,.08)", color: "#EF4444", cursor: "pointer" }}><Trash2 size={16} /></button>
                    </form>}
                    <button onClick={() => setSelectedOrder(null)} aria-label="Fechar pedido" style={{ width: "36px", height: "36px", flexShrink: 0, borderRadius: "10px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.textSub, fontSize: "16px", cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                {canManuallyChangeOrderStatus && sel.raw?.id ? (
                  <ManualOrderStatusControl
                    orderId={sel.raw.id}
                    status={sel.raw.status}
                    text={t.text}
                    border={t.border}
                    background={t.cardBg}
                  />
                ) : null}

                {/* Motivo do Cancelamento / Divergência */}
                {(sel.raw?.status === "CANCELADO" || sel.raw?.cancellationReason || sel.raw?.tratamentoDivergencia) && (
                  <div style={{ padding: "16px", borderRadius: "14px", border: "1px solid rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.08)", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: "#EF4444" }}>
                        Motivo do Cancelamento / Divergência
                      </span>
                      {(sel.raw?.divergenceReporter || sel.raw?.cancellationReporter) && (
                        <span style={{ fontSize: "11px", color: t.textSub }}>
                          Por: <strong>{sel.raw.divergenceReporter || sel.raw.cancellationReporter}</strong>
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "13.5px", fontWeight: "600", color: t.text }}>
                      {sel.raw?.cancellationReason || "Divergência reportada durante o processo operacional."}
                    </span>
                    {sel.raw?.tratamentoDivergencia && (
                      <div style={{ marginTop: "6px", padding: "10px 12px", borderRadius: "10px", background: t.cardBg, border: `1px solid ${t.border}`, fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                          <strong style={{ color: t.text }}>Tratativa do Depositante:</strong>
                          {sel.raw.tratamentoDivergencia.tratadoPorNome && (
                            <span style={{ fontSize: "11px", color: t.textSub }}>{sel.raw.tratamentoDivergencia.tratadoPorNome}</span>
                          )}
                        </div>
                        <span style={{ color: t.textSub }}>
                          {sel.raw.tratamentoDivergencia.observacao || "Cancelamento definitivo confirmado pelo depositante."}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {isPedidosFull ? (
                  <>
                    {/* customer info */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "20px" }}>
                      <span style={{ fontSize: "16px", fontWeight: "700", lineHeight: "1.3", color: t.text }}>{sel.customer}</span>
                      <span style={{ fontSize: "13px", color: t.textSub }}>{sel.owner} &middot; {sel.city}</span>
                    </div>

                    {/* timeline */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "32px" }}>
                      {moves.map((m: any, i: number) => (
                        <div key={i} style={{ display: "flex", gap: "14px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "12px" }}>
                            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: m.dot, boxShadow: `0 0 0 3px ${m.halo}`, marginTop: "4px" }}></span>
                            <span style={{ flex: 1, width: "2px", background: i === moves.length - 1 ? "transparent" : m.line }}></span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingBottom: "22px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "700", color: m.titleColor }}>{m.title}</span>
                            <span style={{ fontSize: "12.5px", color: t.textSub }}>{m.sub}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* carrier + dock + specs */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                      {specs.map((s: any, i: number) => (
                        <div key={i} style={{ gridColumn: s.fullWidth ? "1 / -1" : undefined, padding: "16px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.cardBg, display: "flex", flexDirection: "column", gap: "5px" }}>
                          <span style={{ fontSize: "11.5px", color: t.textSub }}>{s.k}</span>
                          <span style={{ fontSize: "14.5px", fontWeight: "700", color: t.text }}>{s.v}</span>
                          {s.sub ? <span style={{ fontSize: "11.5px", color: t.textSub }}>{s.sub}</span> : null}
                        </div>
                      ))}
                    </div>

                    {sel.raw?.isFull && sel.raw?.id ? (
                      <ShippingFullDocumentsCard orderId={sel.raw.id} />
                    ) : null}
                  </>
                ) : (
                  <>
                    {/* customer info & circular progress ring */}
                    <div style={{ display: "flex", alignItems: "center", gap: "20px", padding: "18px 20px", borderRadius: "14px", border: `1px solid ${t.border}`, background: t.cardBg, marginBottom: "20px" }}>
                      <div style={{ position: "relative", width: "96px", height: "96px", flexShrink: 0 }}>
                        <svg width="96" height="96" viewBox="0 0 108 108" style={{ transform: "rotate(-90deg)" }}>
                          <circle cx="54" cy="54" r="46" fill="none" stroke={t.barTrack} strokeWidth="11"></circle>
                          <circle cx="54" cy="54" r="46" fill="none" stroke="url(#confGrad)" strokeWidth="11" strokeLinecap="round" strokeDasharray={ring.circ} style={{ animation: "fillRing 1s cubic-bezier(0.3, 1, 0.4, 1) forwards", "--ring-offset": ring.offset } as React.CSSProperties}></circle>
                          <defs>
                            <linearGradient id="confGrad" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0" stopColor={ring.c1}></stop>
                              <stop offset="1" stopColor={ring.c2}></stop>
                            </linearGradient>
                          </defs>
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "19px", fontWeight: "700", color: t.text }}>{isRingConcluded ? "100%" : sel.conf}</span>
                          <span style={{ fontSize: "10px", color: t.textSub, fontWeight: "600" }}>conferido</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "11px", color: t.textSub, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cliente</span>
                          <span style={{ fontSize: "15px", fontWeight: "700", lineHeight: "1.3", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel.customer}</span>
                          <span style={{ fontSize: "12px", color: t.textSub }}>{sel.city}</span>
                        </div>
                        <div style={{ display: "flex", gap: "16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: "700", color: t.text }}>{sel.itemsLabel?.split(' ')[0] || (sel.raw?.items?.length || 1)}</span>
                            <span style={{ fontSize: "11px", color: t.textSub }}>itens</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: "700", color: t.text }}>{sel.raw?.weight || "-"}</span>
                            <span style={{ fontSize: "11px", color: t.textSub }}>peso</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Document buttons */}
                    {(() => {
                      const docs = Array.isArray(sel.raw?.documentos) ? sel.raw.documentos : Array.isArray(sel.raw?.attachments) ? sel.raw.attachments : [];
                      const hasNfe = Boolean(
                        sel.raw?.hasNfe || 
                        (sel.raw?.nfe && sel.raw.nfe !== "Ainda não vinculada" && sel.raw.nfe !== "-") || 
                        docs.some((d: any) => d.tipo === "NF" || d.tipo === "XML_NF" || d.kind === "XML_NF" || (d.mime_type && d.mime_type.includes("xml")))
                      );
                      const hasEtiqueta = Boolean(
                        sel.raw?.hasEtiqueta || 
                        docs.some((d: any) => d.tipo === "ETIQUETA" || d.kind === "ETIQUETA")
                      );
                      const hasCartaCorrecao = Boolean(
                        sel.raw?.hasCartaCorrecao ||
                        docs.some((d: any) => (d.tipo === "CARTA_CORRECAO" || d.tipo === "CCE" || d.kind === "CARTA_CORRECAO" || d.kind === "CCE") && d.status !== "PENDENTE")
                      );
                      const cceDoc = docs.find((d: any) => (d.tipo === "CARTA_CORRECAO" || d.tipo === "CCE" || d.kind === "CARTA_CORRECAO" || d.kind === "CCE") && d.status !== "PENDENTE");
                      const hasDanfe = Boolean(hasNfe);

                      return (
                        <div style={{ marginBottom: "24px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: t.textSub }}>
                              Documentos do pedido
                            </span>
                            <button
                              type="button"
                              onClick={() => setUploadModalOpen({ open: true, type: "CARTA_CORRECAO" })}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                border: "1px solid rgba(139, 92, 246, 0.25)",
                                background: "rgba(139, 92, 246, 0.08)",
                                color: "#8B5CF6",
                                fontSize: "11.5px",
                                fontWeight: "700",
                                cursor: "pointer",
                                transition: "all 0.15s ease"
                              }}
                            >
                              + Anexar documento
                            </button>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: hasCartaCorrecao ? "repeat(4, 1fr)" : "repeat(3, 1fr)", gap: "8px" }}>
                            <ShippingAttachmentPreviewDialog
                              label="Nota Fiscal"
                              viewHref={`/api/expedicao/${sel.raw?.id}/nota-fiscal-preview?disposition=inline`}
                              downloadHref={`/api/expedicao/${sel.raw?.id}/nota-fiscal-preview?disposition=attachment`}
                              customTrigger={(openPreview) => (
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openPreview(); }}
                                  style={{ 
                                    position: "relative", 
                                    display: "flex", 
                                    flexDirection: "column", 
                                    alignItems: "center", 
                                    justifyContent: "center", 
                                    gap: "6px", 
                                    padding: "12px 6px", 
                                    borderRadius: "12px", 
                                    border: `1px solid ${hasNfe ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.25)"}`, 
                                    background: t.cardBg, 
                                    color: t.text, 
                                    cursor: "pointer", 
                                    transition: "all 0.2s" 
                                  }}
                                  className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                                >
                                  <div style={{ position: "relative", display: "inline-flex" }}>
                                    <FileText size={18} color={hasNfe ? "#10B981" : t.textSub} />
                                    <span style={{ 
                                      position: "absolute", 
                                      top: "-6px", 
                                      right: "-8px", 
                                      width: "14px", 
                                      height: "14px", 
                                      borderRadius: "50%", 
                                      background: hasNfe ? "#10B981" : "#EF4444", 
                                      color: "#fff", 
                                      display: "grid", 
                                      placeItems: "center", 
                                      fontSize: "8.5px", 
                                      fontWeight: "900",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)" 
                                    }}>
                                      {hasNfe ? "✓" : "✕"}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: "11px", fontWeight: "600", textAlign: "center", lineHeight: "1.15" }}>NF-e</span>
                                </button>
                              )}
                            />
                            <ShippingAttachmentPreviewDialog
                              label="DANFE Simplificada"
                              viewHref={`/api/expedicao/${sel.raw?.id}/danfe-simplificada?disposition=inline`}
                              downloadHref={`/api/expedicao/${sel.raw?.id}/danfe-simplificada?disposition=attachment`}
                              customTrigger={(openPreview) => (
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openPreview(); }}
                                  style={{ 
                                    position: "relative", 
                                    display: "flex", 
                                    flexDirection: "column", 
                                    alignItems: "center", 
                                    justifyContent: "center", 
                                    gap: "6px", 
                                    padding: "12px 6px", 
                                    borderRadius: "12px", 
                                    border: `1px solid ${hasDanfe ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.25)"}`, 
                                    background: t.cardBg, 
                                    color: t.text, 
                                    cursor: "pointer", 
                                    transition: "all 0.2s" 
                                  }}
                                  className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                                >
                                  <div style={{ position: "relative", display: "inline-flex" }}>
                                    <Receipt size={18} color={hasDanfe ? "#10B981" : t.textSub} />
                                    <span style={{ 
                                      position: "absolute", 
                                      top: "-6px", 
                                      right: "-8px", 
                                      width: "14px", 
                                      height: "14px", 
                                      borderRadius: "50%", 
                                      background: hasDanfe ? "#10B981" : "#EF4444", 
                                      color: "#fff", 
                                      display: "grid", 
                                      placeItems: "center", 
                                      fontSize: "8.5px", 
                                      fontWeight: "900",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)" 
                                    }}>
                                      {hasDanfe ? "✓" : "✕"}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: "11px", fontWeight: "600", textAlign: "center", lineHeight: "1.15" }}>DANFE</span>
                                </button>
                              )}
                            />
                            <ShippingAttachmentPreviewDialog
                              label="Etiqueta de Envio"
                              viewHref={`/api/expedicao/${sel.raw?.id}/anexos/etiqueta?disposition=inline`}
                              downloadHref={`/api/expedicao/${sel.raw?.id}/anexos/etiqueta?disposition=attachment`}
                              customTrigger={(openPreview) => (
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openPreview(); }}
                                  style={{ 
                                    position: "relative", 
                                    display: "flex", 
                                    flexDirection: "column", 
                                    alignItems: "center", 
                                    justifyContent: "center", 
                                    gap: "6px", 
                                    padding: "12px 6px", 
                                    borderRadius: "12px", 
                                    border: `1px solid ${hasEtiqueta ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.25)"}`, 
                                    background: t.cardBg, 
                                    color: t.text, 
                                    cursor: "pointer", 
                                    transition: "all 0.2s" 
                                  }}
                                  className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                                >
                                  <div style={{ position: "relative", display: "inline-flex" }}>
                                    <Tag size={18} color={hasEtiqueta ? "#10B981" : t.textSub} />
                                    <span style={{ 
                                      position: "absolute", 
                                      top: "-6px", 
                                      right: "-8px", 
                                      width: "14px", 
                                      height: "14px", 
                                      borderRadius: "50%", 
                                      background: hasEtiqueta ? "#10B981" : "#EF4444", 
                                      color: "#fff", 
                                      display: "grid", 
                                      placeItems: "center", 
                                      fontSize: "8.5px", 
                                      fontWeight: "900",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)" 
                                    }}>
                                      {hasEtiqueta ? "✓" : "✕"}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: "11px", fontWeight: "600", textAlign: "center", lineHeight: "1.15" }}>Etiqueta</span>
                                </button>
                              )}
                            />
                            {hasCartaCorrecao ? (
                              <ShippingAttachmentPreviewDialog
                                label="Carta de Correção (CC-e)"
                                viewHref={cceDoc?.id ? `/api/documentos/${cceDoc.id}/download?disposition=inline` : `/api/expedicao/${sel.raw?.id}/anexos/carta-correcao?disposition=inline`}
                                downloadHref={cceDoc?.id ? `/api/documentos/${cceDoc.id}/download?disposition=attachment` : `/api/expedicao/${sel.raw?.id}/anexos/carta-correcao?disposition=attachment`}
                                customTrigger={(openPreview) => (
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openPreview(); }}
                                    style={{ 
                                      position: "relative", 
                                      display: "flex", 
                                      flexDirection: "column", 
                                      alignItems: "center", 
                                      justifyContent: "center", 
                                      gap: "6px", 
                                      padding: "12px 6px", 
                                      borderRadius: "12px", 
                                      border: "1px solid rgba(16, 185, 129, 0.3)", 
                                      background: t.cardBg, 
                                      color: t.text, 
                                      cursor: "pointer", 
                                      transition: "all 0.2s" 
                                    }}
                                    className="hover:-translate-y-0.5 hover:shadow-lg dark:hover:bg-slate-800/40 hover:bg-slate-50"
                                  >
                                    <div style={{ position: "relative", display: "inline-flex" }}>
                                      <FileSignature size={18} color="#10B981" />
                                      <span style={{ 
                                        position: "absolute", 
                                        top: "-6px", 
                                        right: "-8px", 
                                        width: "14px", 
                                        height: "14px", 
                                        borderRadius: "50%", 
                                        background: "#10B981", 
                                        color: "#fff", 
                                        display: "grid", 
                                        placeItems: "center", 
                                        fontSize: "8.5px", 
                                        fontWeight: "900",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)" 
                                      }}>
                                        ✓
                                      </span>
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: "600", textAlign: "center", lineHeight: "1.15" }}>CC-e</span>
                                  </button>
                                )}
                              />
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}

                    {sel.raw?.isFull && sel.raw?.id ? (
                      <ShippingFullDocumentsCard orderId={sel.raw.id} />
                    ) : null}

                    {/* carrier + dock + specs */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                      {specs.map((s: any, i: number) => (
                        <div key={i} style={{ gridColumn: s.fullWidth ? "1 / -1" : undefined, padding: "14px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.cardBg, display: "flex", flexDirection: "column", gap: "5px" }}>
                          <span style={{ fontSize: "11.5px", color: t.textSub }}>{s.k}</span>
                          <span style={{ fontSize: "14.5px", fontWeight: "700", color: t.text }}>{s.v}</span>
                          {s.sub ? <span style={{ fontSize: "11.5px", color: t.textSub }}>{s.sub}</span> : null}
                        </div>
                      ))}
                    </div>

                    {/* packing list / produtos */}
                    <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: "700", color: t.text }}>Itens do pedido</span>
                        <span style={{ fontSize: "12.5px", color: t.textSub, fontWeight: "600" }}>{doneItems} de {nItems} conferidos</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {itemsToUse.map((it: any, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.cardBg }}>
                            <span style={{ width: "22px", height: "22px", flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", border: `1.5px solid ${it.checkBorder}`, background: it.checkBg, color: "#fff" }}>{it.mark}</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: "13.5px", fontWeight: "700", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</span>
                              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "11.5px", color: t.textSub }}>{it.sku}</span>
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: it.qtyColor }}>{it.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* timeline */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: "700", color: t.text }}>Histórico</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {moves.map((m: any, i: number) => (
                          <div key={i} style={{ display: "flex", gap: "14px" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "12px" }}>
                              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: m.dot, boxShadow: `0 0 0 3px ${m.halo}`, marginTop: "4px" }}></span>
                              <span style={{ flex: 1, width: "2px", background: i === moves.length - 1 ? "transparent" : m.line }}></span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingBottom: "16px" }}>
                              <span style={{ fontSize: "13.5px", fontWeight: "700", color: m.titleColor }}>{m.title}</span>
                              <span style={{ fontSize: "12.5px", color: t.textSub }}>{m.sub}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>


              <div style={{ flexShrink: 0, padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", gap: "10px", background: t.drawerBg }}>
                {!isPedidosFull && sel.raw?.romaneioId ? (
                  <button 
                    type="button"
                    onClick={() => window.open(`/api/romaneio/${sel.raw.romaneioId}/pdf`, "_blank")}
                    style={{ flex: 1, height: "46px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}
                  >
                    ⎙ Romaneio
                  </button>
                ) : null}
                <button 
                  onClick={() => {
                    const isDiv = sel.statusLabel === "Aguardando tratativa";
                    if (isDiv) setSelectedOrder(null);
                    // A retirada nao vai para separacao: abre o modal de anexo
                    // da NF-e de devolucao ali mesmo, sem trocar de tela. A
                    // validacao acontece dentro do modal.
                    else if (sel.raw?.status === "AGUARDANDO_NF_DEVOLUCAO") {
                      setReturnInvoiceOrder(sel);
                      setSelectedOrder(null);
                    }
                    else if (sel.raw?.status === "NOVO" || sel.raw?.status === "EM_SEPARACAO") router.push(`/expedicao/separacao/${sel.id}`);
                    else if (sel.raw?.status === "SEPARADO" || sel.raw?.status === "EM_CONFERENCIA") router.push(`/expedicao/conferencia/${sel.id}`);
                    else if (sel.raw?.status === "CONFERIDO" || sel.raw?.status === "PRONTO_ROMANEIO") router.push("/expedicao/conferidos");
                    else setSelectedOrder(null);
                  }}
                  style={{ flex: 1.2, height: "46px", border: "none", borderRadius: "11px", background: "linear-gradient(92deg, #6366f1, #8b5cf6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99, 102, 241, 0.32)" }}>{btnText}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {newOrderOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Novo pedido"
          style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", justifyContent: "flex-end" }}
        >
          <button
            aria-label="Fechar novo pedido"
            onClick={() => setNewOrderOpen(false)}
            style={{ position: "absolute", inset: 0, border: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(4px)", cursor: "default" }}
          />
          <aside style={{ position: "relative", width: "min(560px, 100vw)", height: "100%", display: "flex", flexDirection: "column", background: t.drawerBg, borderLeft: `1px solid ${t.border}`, boxShadow: "-20px 0 60px rgba(15, 23, 42, 0.24)", animation: "drawerIn 0.3s cubic-bezier(.3,1,.4,1)" }}>
            <div style={{ padding: "24px 26px 20px", borderBottom: `1px solid ${t.border}`, background: isDark ? t.drawerBg : "linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.13em", color: t.textSub }}>NOVO PEDIDO</div>
                  <h2 style={{ margin: "6px 0 4px", color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>Enviar pedido ao CD</h2>
                  <p style={{ margin: 0, color: t.textSub, fontSize: 13.5 }}>O pedido cai direto na fila de expedição da Infinoos.</p>
                </div>
                <button onClick={() => setNewOrderOpen(false)} aria-label="Fechar" style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 12, border: `1px solid ${t.border}`, background: t.inputBg, color: t.textSub, cursor: "pointer" }}><X size={18} /></button>
              </div>
            </div>

            <form action={submitManualOrder} onSubmit={() => setManualOrderErrorDismissed(false)} style={{ minHeight: 0, display: "flex", flex: 1, flexDirection: "column" }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px 120px", display: "flex", flexDirection: "column", gap: 24 }}>
                <input type="hidden" name="salesChannelCode" value={newOrderChannel} />
                <input type="hidden" name="returnPath" value="/expedicao" />
                <input type="hidden" name="dataPedido" value={new Date().toISOString().slice(0, 10)} />
                <input type="hidden" name="quantidadeItens" value={selectedItems.length} />
                <input type="hidden" name="quantidadeUnidades" value={totalNewOrderUnits} />

                <section>
                  <h3 style={{ margin: "0 0 12px", color: t.text, fontSize: 14, fontWeight: 800 }}>Canal de venda</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: newOrderCarrier === "Outro" ? 12 : 0 }}>
                    {SALES_CHANNEL_OPTIONS.filter((option) => ["MERCADO_LIVRE", "SHOPEE", "AMAZON", "MAGALU", "SHEIN", "TIKTOK", "KWAI", "SITE_PROPRIO"].includes(option.value)).map((option) => {
                      const active = option.value === newOrderChannel;
                      const initials: Record<string, string> = { MERCADO_LIVRE: "ML", SHOPEE: "SH", AMAZON: "AM", MAGALU: "MG", SHEIN: "SE", TIKTOK: "TK", KWAI: "KW", SITE_PROPRIO: "SP" };
                      const channelColors: Record<string, string> = { MERCADO_LIVRE: "#2D3277", SHOPEE: "#EE4D2D", AMAZON: "#FF9900", MAGALU: "#F59E0B", SHEIN: "#111827", TIKTOK: "#111827", KWAI: "#FF6B35", SITE_PROPRIO: "#8B5CF6" };
                      const channelColor = channelColors[option.value] ?? "#8B5CF6";
                      return <button type="button" key={option.value} onClick={() => { setNewOrderChannel(option.value); if (newOrderCarrier === "Coleta Marketplace" && !option.marketplace) setNewOrderCarrier("Outro"); }} style={{ height: 36, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 10, border: `1.5px solid ${active ? "#8B5CF6" : t.border}`, background: active ? "rgba(139,92,246,0.1)" : t.cardBg, color: active ? t.text : t.textSub, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all .16s ease" }}><span style={{ width: 19, height: 19, display: "grid", placeItems: "center", borderRadius: 6, fontSize: 9.5, fontWeight: 800, background: `${channelColor}20`, color: channelColor }}>{initials[option.value]}</span>{option.label}</button>;
                    })}
                  </div>
                </section>

                <section>
                  <h3 style={{ margin: "0 0 12px", color: t.text, fontSize: 14, fontWeight: 800 }}>Operação</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label style={{ position: "relative", color: t.textSub, fontSize: 12, letterSpacing: 0, textTransform: "none", fontWeight: 500 }}>Depositante
                      <input type="hidden" required name="depositanteId" value={newOrderDepositante} />
                      <button type="button" onClick={() => setNewOrderDepositanteOpen((open) => !open)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 7, height: 52, padding: "0 16px", borderRadius: 16, border: `1.5px solid ${newOrderDepositanteOpen ? "#22D3EE" : t.border}`, background: t.cardBg, color: newOrderDepositante ? t.text : t.textSub, fontFamily: "'Manrope', sans-serif", fontSize: 14, cursor: "pointer", textAlign: "left", boxShadow: newOrderDepositanteOpen ? "0 0 0 3px rgba(34,211,238,.13)" : "none", transition: "border-color .16s ease, box-shadow .16s ease" }}>
                        <span style={{ letterSpacing: 0, textTransform: "none", fontWeight: 500 }}>{data.depositanteOptions?.find((depositante: any) => depositante.id === newOrderDepositante)?.nome ?? "Todos"}</span><ChevronDown size={17} color={newOrderDepositanteOpen ? "#64748B" : t.textSub} style={{ transform: newOrderDepositanteOpen ? "rotate(180deg)" : "none", transition: "transform .16s ease" }} />
                      </button>
                      {newOrderDepositanteOpen && <div style={{ position: "absolute", zIndex: 20, top: "calc(100% + 10px)", left: 0, right: 0, padding: 8, borderRadius: 16, border: `1px solid ${t.border}`, background: t.drawerBg, boxShadow: "0 18px 38px rgba(15,23,42,.18)", animation: "popIn .16s ease" }}>
                        {(data.depositanteOptions ?? []).map((depositante: any) => <button type="button" key={depositante.id} onMouseEnter={(event) => { if (depositante.id !== newOrderDepositante) { event.currentTarget.style.background = "#ECFEFF"; event.currentTarget.style.color = "#0E7490"; } }} onMouseLeave={(event) => { if (depositante.id !== newOrderDepositante) { event.currentTarget.style.background = "transparent"; event.currentTarget.style.color = isDark ? t.text : "#0F172A"; } }} onClick={() => { setNewOrderDepositante(depositante.id); setNewOrderItems([]); setNewOrderDepositanteOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 48, padding: "0 12px", border: 0, borderRadius: 13, background: depositante.id === newOrderDepositante ? "#ECFEFF" : "transparent", color: depositante.id === newOrderDepositante ? "#0E7490" : t.text, fontSize: 14, fontWeight: depositante.id === newOrderDepositante ? 600 : 500, textAlign: "left", cursor: "pointer", transition: "background .14s ease, color .14s ease" }}><span>{depositante.nome}</span>{depositante.id === newOrderDepositante && <Check size={17} color="#0E7490" />}</button>)}
                      </div>}
                    </label>
                    <label style={{ color: t.textSub, fontSize: 12 }}>Número do pedido
                      <input required name="numeroPedido" placeholder="Ex.: 18450" style={{ display: "block", width: "100%", marginTop: 7, height: 52, padding: "0 14px", borderRadius: 16, border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: 14, outline: "none" }} />
                    </label>
                  </div>
                </section>

                <section>
                  <h3 style={{ margin: "0 0 12px", color: t.text, fontSize: 14, fontWeight: 800 }}>Destinatário</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[{ name: "clienteNome", label: "Nome do cliente", placeholder: "Ex.: Marina Costa", required: true }, { name: "clienteDocumento", label: "CPF / CNPJ", placeholder: "000.000.000-00" }, { name: "clienteCep", label: "CEP", placeholder: "00000-000" }, { name: "clienteCidade", label: "Cidade / UF", placeholder: "São Paulo · SP" }, { name: "clienteEndereco", label: "Endereço", placeholder: "Ex.: Rua das Flores" }, { name: "clienteNumero", label: "Número", placeholder: "Ex.: 125" }, { name: "clienteTelefone", label: "Telefone", placeholder: "(00) 00000-0000" }].map((field: any) => <label key={field.name} style={{ display: "flex", flexDirection: "column", gap: 6, color: t.textSub, fontSize: 12, fontWeight: 500 }}>{field.label}<input required={field.required} name={field.name} placeholder={field.placeholder} style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box" }} /></label>)}
                  </div>
                  <input type="hidden" name="clienteUf" value="" />
                </section>

                <section>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ margin: 0, color: t.text, fontSize: 14, fontWeight: 800 }}>Itens do pedido</h3>
                    <button type="button" onClick={() => { setProductPickerQuery(""); setShowProductPicker(true); }} style={{ border: 0, padding: 0, background: "transparent", color: "#8B5CF6", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>+ Adicionar item</button>
                  </div>
                  {selectedItems.length === 0 && <div style={{ padding: 18, borderRadius: 12, border: `1px dashed ${t.border}`, color: t.textSub, fontSize: 13, textAlign: "center" }}>Adicione os produtos que deverão ser separados.</div>}
                  {selectedItems.map(({ id, quantity, product }: any, index: number) => <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${t.border}`, background: t.cardBg, marginBottom: 8, minHeight: 58 }}>
                    <input type="hidden" name="productId[]" value={id} />
                    <input type="hidden" name="itemQuantity[]" value={quantity} />
                    <span style={{ width: 42, height: 42, flexShrink: 0, overflow: "hidden", borderRadius: 10, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#60A5FA,#A78BFA)", color: "#fff" }}>{product.imagem_principal_url ? <img src={product.imagem_principal_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Box size={18} />}</span>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ color: t.text, fontWeight: 750, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.nome}</div><div style={{ color: t.textSub, fontSize: 11.5, marginTop: 3 }}>{product.sku || product.codigo_interno || product.codigo_externo || "Sem código"}{product.estoque_disponivel !== undefined ? ` · ${product.estoque_disponivel} em estoque` : ""}</div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <button type="button" aria-label="Diminuir quantidade" onClick={() => setNewOrderItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))} style={{ width: 30, height: 30, display: "grid", placeItems: "center", padding: 0, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, cursor: "pointer" }}><Minus size={14} /></button>
                      <input
                        aria-label={`Quantidade de ${product.nome}`}
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={quantity}
                        onChange={(event) => {
                          const nextQuantity = Number.parseInt(event.target.value, 10);
                          setNewOrderItems((items) => items.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, quantity: Number.isFinite(nextQuantity) && nextQuantity > 0 ? nextQuantity : 1 }
                              : item,
                          ));
                        }}
                        onWheel={(event) => event.currentTarget.blur()}
                        style={{ width: 42, height: 30, padding: "0 3px", border: 0, background: "transparent", color: t.text, fontWeight: 800, fontSize: 14, textAlign: "center", outline: "none" }}
                      />
                      <button type="button" aria-label="Aumentar quantidade" onClick={() => setNewOrderItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity + 1 } : item))} style={{ width: 30, height: 30, display: "grid", placeItems: "center", padding: 0, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, cursor: "pointer" }}><Plus size={14} /></button>
                      <button type="button" aria-label="Remover item" onClick={() => setNewOrderItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} style={{ width: 30, height: 30, display: "grid", placeItems: "center", padding: 0, borderRadius: 8, border: `1px solid rgba(239,68,68,.25)`, background: "rgba(239,68,68,.08)", color: "#EF4444", cursor: "pointer" }}><X size={14} /></button>
                    </div>
                  </div>)}
                  {showProductPicker && <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", background: t.drawerBg, animation: "overlayFade .2s ease" }}>
                    <div style={{ flexShrink: 0, padding: "20px 24px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12 }}>
                      <button type="button" aria-label="Voltar para o pedido" onClick={() => setShowProductPicker(false)} style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", padding: 0, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, cursor: "pointer" }}><ChevronLeft size={17} strokeWidth={2.2} /></button>
                      <strong style={{ color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: 17 }}>Escolher produtos</strong>
                    </div>
                     <div style={{ flexShrink: 0, padding: "16px 24px 0" }}><div style={{ position: "relative" }}><Search size={15} color={t.textSub} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} /><input value={productPickerQuery} onChange={(event) => setProductPickerQuery(event.target.value)} placeholder="Buscar por nome ou SKU..." style={{ width: "100%", height: 46, padding: "0 14px 0 38px", borderRadius: 12, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, outline: "none", boxSizing: "border-box", fontSize: 13.5 }} /></div></div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {pickerProducts.length === 0 && <div style={{ padding: "38px 18px", borderRadius: 14, border: `1px dashed ${t.border}`, color: t.textSub, textAlign: "center", fontSize: 13 }}>Nenhum produto encontrado.</div>}
                      {pickerProducts.map((produto: any) => {
                        const already = newOrderItems.some((item) => item.id === produto.id);
                        const stockValue = produto.estoque_disponivel ?? produto.quantidade_disponivel ?? produto.estoque ?? produto.quantidade;
                        const hasStockValue = stockValue !== undefined && stockValue !== null && stockValue !== "";
                        const outOfStock = hasStockValue && Number(stockValue) <= 0;
                        const imageUrl = produto.imagem_principal_url;
                        return <button type="button" key={produto.id} disabled={outOfStock} onClick={() => setNewOrderItems((items) => already ? items.filter((item) => item.id !== produto.id) : [...items, { id: produto.id, quantity: 1 }])} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 66, padding: "10px 14px", borderRadius: 13, border: `1.5px solid ${already ? "#8B5CF6" : t.border}`, background: already ? "rgba(139,92,246,.08)" : t.cardBg, color: t.text, textAlign: "left", cursor: outOfStock ? "default" : "pointer", opacity: outOfStock ? .72 : 1 }}>
                          <span style={{ width: 40, height: 40, flexShrink: 0, overflow: "hidden", borderRadius: 10, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#60A5FA,#A78BFA)", color: "#fff" }}>{imageUrl ? <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Box size={18} />}</span>
                          <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5 }}>{produto.nome}</strong><small style={{ display: "block", marginTop: 3, color: outOfStock ? "#EF4444" : t.textSub, fontSize: 11.5 }}>{produto.sku || produto.codigo_interno || produto.codigo_externo || "Sem código"}{hasStockValue ? ` · ${Number(stockValue)} em estoque` : ""}</small></span>
                          <span style={{ flexShrink: 0, color: outOfStock ? "#EF4444" : already ? "#10B981" : "#8B5CF6", fontWeight: 800, fontSize: 12.5 }}>{outOfStock ? "Indisponível" : already ? "✓ Adicionado" : "+ Adicionar"}</span>
                        </button>;
                      })}
                    </div>
                    <div style={{ flexShrink: 0, padding: "16px 24px", borderTop: `1px solid ${t.border}`, background: t.drawerBg }}><button type="button" disabled={newOrderItems.length === 0} onClick={() => { setShowProductPicker(false); setProductPickerQuery(""); }} style={{ width: "100%", height: 48, border: 0, borderRadius: 11, background: newOrderItems.length === 0 ? t.softBg : "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: newOrderItems.length === 0 ? t.textSub : "#fff", fontWeight: 800, fontSize: 14, cursor: newOrderItems.length === 0 ? "not-allowed" : "pointer", boxShadow: newOrderItems.length === 0 ? "none" : "0 8px 22px rgba(99,102,241,.25)" }}>Concluir seleção ({newOrderItems.length})</button></div>
                  </div>}
                     {false && <>
                     <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12 }}><button type="button" onClick={() => setShowProductPicker(false)} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, cursor: "pointer" }}><ChevronLeft size={17} /></button><strong style={{ color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: 17 }}>Escolher produtos</strong></div>
                    <div style={{ flexShrink: 0, padding: "16px 24px 0" }}><div style={{ position: "relative" }}><Search size={15} color={t.textSub} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} /><input value={productPickerQuery} onChange={(event) => setProductPickerQuery(event.target.value)} placeholder="Buscar por nome ou SKU..." style={{ width: "100%", height: 46, padding: "0 14px 0 38px", borderRadius: 12, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, outline: "none", boxSizing: "border-box", fontSize: 13.5 }} /></div></div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 8 }}>{availableProducts.map((produto: any) => { const already = newOrderItems.some((item) => item.id === produto.id); return <button type="button" key={produto.id} disabled={already} onClick={() => { setNewOrderItems((items) => already ? items : [...items, { id: produto.id, quantity: 1 }]); setShowProductPicker(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${already ? "#10B981" : t.border}`, background: already ? "rgba(16,185,129,.08)" : t.cardBg, color: t.text, textAlign: "left", cursor: already ? "default" : "pointer" }}><span style={{ width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#60A5FA,#A78BFA)", color: "#fff" }}><Box size={18} /></span><span style={{ flex: 1 }}><strong style={{ display: "block", fontSize: 13.5 }}>{produto.nome}</strong><small style={{ color: t.textSub }}>{produto.sku || produto.codigo_interno || produto.codigo_externo || "Sem código"}</small></span><span style={{ color: already ? "#10B981" : "#8B5CF6", fontWeight: 800 }}>{already ? "✓ Adicionado" : "+ Adicionar"}</span></button>; })}</div>
                    </>}
                </section>

                <section>
                  <h3 style={{ margin: "0 0 12px", color: t.text, fontSize: 14, fontWeight: 800 }}>Transportadora física</h3>
                  <p style={{ margin: "0 0 10px", color: t.textSub, fontSize: 11.5 }}>Quem vai buscar/entregar o pacote -- não é o canal de venda (selecionado acima).</p>
                  <input type="hidden" name="shippingService" value={resolvedCarrierName} />
                  {newOrderCarrier === "Outro" ? <input name="carrierName" required value={newOrderOtherCarrier} onChange={(event) => setNewOrderOtherCarrier(event.target.value)} placeholder="Digite o nome da transportadora" style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 11, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, outline: "none", boxSizing: "border-box", fontSize: 13.5 }} /> : <input type="hidden" name="carrierName" value={resolvedCarrierName} />}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {carrierChipOptions.map((carrier) => <button type="button" key={carrier} onClick={() => { setNewOrderCarrier(carrier); if (carrier !== "Outro") setNewOrderOtherCarrier(""); }} style={{ height: 38, padding: "0 15px", borderRadius: 10, border: `1.5px solid ${newOrderCarrier === carrier ? "#8B5CF6" : t.border}`, background: newOrderCarrier === carrier ? "rgba(139,92,246,.1)" : t.cardBg, color: newOrderCarrier === carrier ? t.text : t.textSub, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .16s ease" }}>{carrier}</button>)}
                  </div>
                  {newOrderCarrier === "Outro" && <div style={{ marginTop: 8, color: t.textSub, fontSize: 11.5 }}>Informe a transportadora responsável pelo envio.</div>}
                  {newOrderCarrier === "Coleta Marketplace" && <div style={{ marginTop: 8, color: t.textSub, fontSize: 11.5 }}>Vai gravar como <strong>{resolvedCarrierName}</strong>.</div>}
                </section>

                <section>
                  <h3 style={{ margin: "0 0 12px", color: t.text, fontSize: 14, fontWeight: 800 }}>Documentos</h3>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, border: `1px solid ${t.border}`, background: t.softBg }}>
                      <Upload size={18} color="#3B82F6" />
                      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", color: t.text, fontSize: 13 }}>Nota fiscal (XML)</strong><small style={{ display: "block", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.textSub }}>{newOrderInvoiceFile?.name ?? "Nenhum arquivo selecionado"}</small></div>
                      <label style={{ height: 34, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 9, background: "rgba(59,130,246,.12)", color: "#2563EB", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Anexar<input type="file" name="invoiceXml" required accept=".xml,application/xml,text/xml" onChange={(event) => setNewOrderInvoiceFile(event.target.files?.[0] ?? null)} style={{ display: "none" }} /></label>
                      {newOrderInvoiceFile && <button type="button" onClick={async () => { const source = await newOrderInvoiceFile.text(); const isHtmlDocument = /<!doctype\s+html|<html[\s>]/i.test(source); const renderedSource = isHtmlDocument ? source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "") : buildInvoicePreviewHtml(source); setNewOrderPreviewZoom(100); setNewOrderPreview({ kind: "invoice", src: renderedSource, file: newOrderInvoiceFile }); }} style={{ height: 34, padding: "0 10px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Visualizar</button>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, border: `1px solid ${t.border}`, background: t.softBg }}>
                      <Upload size={18} color="#8B5CF6" />
                      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", color: t.text, fontSize: 13 }}>Etiqueta de envio</strong><small style={{ display: "block", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.textSub }}>{newOrderLabelFile?.name ?? "Nenhum arquivo selecionado"}</small></div>
                      <label style={{ height: 34, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 9, background: "rgba(139,92,246,.12)", color: "#7C3AED", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Anexar<input type="file" name="shippingLabel" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setNewOrderLabelFile(event.target.files?.[0] ?? null)} style={{ display: "none" }} /></label>
                      {newOrderLabelFile && <button type="button" onClick={() => { setNewOrderPreviewZoom(100); setNewOrderPreview({ kind: "label", src: URL.createObjectURL(newOrderLabelFile), file: newOrderLabelFile }); }} style={{ height: 34, padding: "0 10px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Visualizar</button>}
                    </div>
                  </div>
                </section>
              </div>
              <div className="new-order-footer" style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 26px", borderTop: `1px solid ${t.border}`, background: t.drawerBg }}>
                <div><div style={{ color: t.textSub, fontSize: 12 }}>Total de itens</div><strong style={{ color: t.text, fontSize: 20 }}>{totalNewOrderUnits}</strong></div>
                <div style={{ display: "flex", gap: 14 }}><button className="new-order-cancel" type="button" onClick={() => setNewOrderOpen(false)} style={{ height: 48, padding: "0 18px", borderRadius: 11, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontWeight: 750, cursor: "pointer", transition: "border-color .18s ease, box-shadow .18s ease" }}>Cancelar</button><button className="new-order-submit" type="submit" disabled={selectedItems.length === 0 || isSubmittingManualOrder} style={{ height: 48, padding: "0 22px", border: 0, borderRadius: 11, background: selectedItems.length === 0 ? t.softBg : "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: selectedItems.length === 0 ? t.textSub : "#fff", fontWeight: 800, cursor: selectedItems.length === 0 || isSubmittingManualOrder ? "wait" : "pointer", boxShadow: selectedItems.length === 0 ? "none" : "0 8px 22px rgba(99,102,241,.3)", transition: "transform .18s ease, box-shadow .18s ease", opacity: isSubmittingManualOrder ? .72 : 1 }}>{isSubmittingManualOrder ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Enviando ao CD...</> : "⇢ Enviar ao CD"}</button></div>
              </div>
            </form>
            {newOrderPreview && <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(15,23,42,.72)", animation: "overlayFade .2s ease" }}>
              <div style={{ width: "min(1150px, 100%)", height: "min(92%, 900px)", overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: 22, background: "#fff", boxShadow: "0 24px 80px rgba(0,0,0,.35)" }}>
                <div style={{ flexShrink: 0, minHeight: 76, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 20px", background: "#fff", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}><span style={{ width: 42, height: 42, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 14, background: "#EDE9FE", color: "#4F46E5" }}><FileText size={20} /></span><div style={{ minWidth: 0 }}><strong style={{ display: "block", color: "#0F172A", fontSize: 16 }}>XML da nota fiscal</strong><span style={{ display: "block", marginTop: 3, color: "#64748B", fontSize: 12 }}>Visualização do documento impresso</span></div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => newOrderPreviewFrameRef.current?.contentWindow?.print()} style={{ height: 40, display: "inline-flex", alignItems: "center", gap: 8, padding: "0 15px", borderRadius: 11, border: "1px solid #E2E8F0", background: "#fff", color: "#334155", fontWeight: 800, cursor: "pointer" }}><Receipt size={16} /> Imprimir NF</button>
                    <button type="button" onClick={() => { const file = newOrderPreview.file; if (!file) return; const url = URL.createObjectURL(file); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click(); URL.revokeObjectURL(url); }} style={{ height: 40, display: "inline-flex", alignItems: "center", gap: 8, padding: "0 15px", borderRadius: 11, border: "1px solid #E2E8F0", background: "#fff", color: "#334155", fontWeight: 800, cursor: "pointer" }}><Upload size={16} style={{ transform: "rotate(180deg)" }} /> Baixar NF</button>
                    <button type="button" aria-label="Fechar visualização" onClick={() => setNewOrderPreview(null)} style={{ width: 42, height: 42, display: "grid", placeItems: "center", border: 0, borderRadius: 14, background: "#F1F5F9", color: "#475569", cursor: "pointer" }}><X size={20} /></button>
                  </div>
                </div>
                <div style={{ flexShrink: 0, height: 56, display: "flex", alignItems: "center", gap: 18, padding: "0 20px", background: "#3B3B3B", color: "#fff" }}>
                  <span style={{ fontSize: 18 }}>☰</span><strong style={{ fontSize: 13 }}>{newOrderPreview.kind === "invoice" ? "Nota fiscal" : "Etiqueta de envio"}</strong><span style={{ marginLeft: 10, fontSize: 12, opacity: .8 }}>1&nbsp; / &nbsp;1</span><span style={{ marginLeft: 10, width: 1, height: 26, background: "rgba(255,255,255,.25)" }} />
                  <button type="button" onClick={() => setNewOrderPreviewZoom((value) => Math.max(50, value - 10))} style={{ border: 0, background: "transparent", color: "#fff", fontSize: 20, cursor: "pointer" }}>−</button><span style={{ minWidth: 48, padding: "4px 7px", textAlign: "center", background: "#202020", fontSize: 12 }}>{newOrderPreviewZoom}%</span><button type="button" onClick={() => setNewOrderPreviewZoom((value) => Math.min(160, value + 10))} style={{ border: 0, background: "transparent", color: "#fff", fontSize: 20, cursor: "pointer" }}>+</button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 20, background: "#292929", display: "flex", justifyContent: "center", alignItems: "flex-start" }}><iframe ref={newOrderPreviewFrameRef} title="Visualização do documento" src={newOrderPreview.kind === "label" ? newOrderPreview.src : undefined} srcDoc={newOrderPreview.kind === "invoice" ? newOrderPreview.src : undefined} style={{ width: `${newOrderPreviewZoom}%`, minWidth: 620, height: "100%", minHeight: 650, border: 0, background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,.35)" }} /></div>
              </div>
            </div>}
          </aside>
        </div>
      )}

      {/* Slide-over Drawer para Detalhes / Visualização de Divergências pelo Operador */}
      <ShippingDivergenceDrawer
        order={treatingDivergenceOrder}
        isOpen={Boolean(treatingDivergenceOrder)}
        onClose={() => setTreatingDivergenceOrder(null)}
        readOnly={true}
      />

      {/* Anexo da NF-e de devolução de uma retirada, sem sair da lista */}
      {returnInvoiceOrder ? (
        <ShippingReturnInvoiceModal
          orderId={returnInvoiceOrder.id}
          orderNumber={returnInvoiceOrder.code || ""}
          items={(returnInvoiceOrder.raw?.items ?? []).map((item: any) => ({
            code: item.sku || "",
            name: item.name,
            quantity: Number(item.quantity ?? 0).toLocaleString("pt-BR"),
          }))}
          onClose={() => setReturnInvoiceOrder(null)}
        />
      ) : null}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes drawerIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        /* Os chips de filtro rolam quando a busca expande; a barra de rolagem
           fica oculta para nao poluir a linha. */
        .filter-chips-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .filter-chips-scroll::-webkit-scrollbar { display: none; }
        .new-order-cancel:hover { border-color: #64748B !important; box-shadow: 0 0 0 3px rgba(100,116,139,.14); }
        .new-order-submit:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(99,102,241,.38) !important; }
        @keyframes overlayFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fillRing {
          from { stroke-dashoffset: 289; }
          to { stroke-dashoffset: var(--ring-offset); }
        }
      `}} />
    </div>
  );
}
