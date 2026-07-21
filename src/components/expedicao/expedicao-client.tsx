
"use client";

import React, { useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { 
  Loader2, 
  PackageSearch,
  AlertTriangle,
  ClipboardList,
  Clock,
  CheckCircle2,
  Box,
  Truck,
  ListChecks,
  Scan,
  FileCheck2
} from "lucide-react";

export function ExpedicaoClient({ data }: { data: any }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("orders");
  const [activeFilter, setActiveFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const isOrders = activeTab === "orders";
  const isWaves = activeTab === "waves";
  const isConference = activeTab === "conference";
  const isDivergence = activeTab === "divergence";

  const setOrders = () => setActiveTab("orders");
  const setDivergence = () => setActiveTab("divergence");

  const t = {
    appBg: isDark ? "#0B1120" : "#F8FAFC",
    border: isDark ? "rgba(255,255,255,0.1)" : "#E2E8F0",
    cardBg: isDark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
    softBg: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC",
    inputBg: isDark ? "rgba(0,0,0,0.2)" : "#F1F5F9",
    text: isDark ? "#F8FAFC" : "#0F172A",
    textSub: isDark ? "#94A3B8" : "#64748B",
    barTrack: isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0",
    headBg: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC"
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
  const divergenceCount = data.orders.filter((o: any) => o.status === "DIVERGENTE" || o.status === "ERRO").length;

  const kpis = [
    { label: "A expedir hoje", value: data.stats[0]?.value || 0, delta: data.stats[0]?.delta || "", iconEl: <Box size={20} />, iconBg: "rgba(59,130,246,0.15)", iconColor: "#3B82F6", deltaColor: "" },
    { label: "Em conferência", value: data.stats[2]?.value || 0, delta: data.stats[2]?.delta || "", iconEl: <CheckCircle2 size={20} />, iconBg: "rgba(139,92,246,0.15)", iconColor: "#8B5CF6", deltaColor: "" },
    { label: "Aguardando separação", value: data.stats[1]?.value || 0, delta: data.stats[1]?.delta || "", iconEl: <Clock size={20} />, iconBg: "rgba(16,185,129,0.15)", iconColor: "#10B981", deltaColor: "" },
    { label: "Expedidos hoje", value: data.stats[3]?.value || 0, delta: data.stats[3]?.delta || "", iconEl: <CheckCircle2 size={20} />, iconBg: "rgba(245,158,11,0.15)", iconColor: "#F59E0B", deltaColor: "#10B981" }
  ];

  const flowCards = [
    { href: "#", kicker: "PAINEL", iconEl: <ClipboardList size={20} className="animated-icon" />, iconBg: "rgba(139,92,246,0.15)", accent: "#8B5CF6", title: "Pedidos", desc: "Ir direto para a listagem completa de pedidos, filtros operacionais e acompanhamento da fila.", btnBg: "rgba(139,92,246,0.15)", btnColor: "#8B5CF6", cta: "Ver Pedidos" },
    { href: "#", kicker: "OPERAÇíO", iconEl: <ListChecks size={20} className="animated-icon" />, iconBg: "rgba(59,130,246,0.15)", accent: "#3B82F6", title: "Separação", desc: "Abrir a fila de picking, distribuir os pedidos e iniciar a leitura operacional do armazém.", btnBg: "rgba(59,130,246,0.15)", btnColor: "#3B82F6", cta: "Entrar em Separação" },
    { href: "#", kicker: "VALIDAÇíO", iconEl: <Scan size={20} className="animated-icon" />, iconBg: "rgba(168,85,247,0.15)", accent: "#A855F7", title: "Conferência", desc: "Entrar na etapa final, validar item a item e liberar somente pedidos conferidos para expedição.", btnBg: "rgba(168,85,247,0.15)", btnColor: "#A855F7", cta: "Entrar em Conferência" },
    { href: "#", kicker: "PÓS-CONFERÊNCIA", iconEl: <FileCheck2 size={20} className="animated-icon" />, iconBg: "rgba(16,185,129,0.15)", accent: "#10B981", title: "Conferidos", desc: "Acompanhar pedidos já conferidos, com ou sem romaneio, antes da etapa final de despacho.", btnBg: "rgba(16,185,129,0.15)", btnColor: "#10B981", cta: "Ver Conferidos" },
  ];

  const tableFiltersDef = [
    { id: 'todos', label: "Todos", count: data.orders.length, hasCount: false, isAlert: false },
    { id: 'aguardando', label: "Aguardando", count: data.orders.filter((o: any) => o.status === "NOVO").length, hasCount: true, isAlert: false },
    { id: 'conferencia', label: "Em conferência", count: data.orders.filter((o: any) => o.status === "EM_CONFERENCIA").length, hasCount: true, isAlert: false },
    { id: 'carregando', label: "Carregando", count: data.orders.filter((o: any) => ["EM_SEPARACAO", "SEPARADO", "PRONTO_ROMANEIO"].includes(o.status)).length, hasCount: true, isAlert: false },
    { id: 'atrasados', label: "Atrasados", count: data.orders.filter((o: any) => o.ageTone === "LATE").length, hasCount: true, isAlert: true }
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

  const getStatusStyle = (s: string) => {
    const statusMap: Record<string, { bg: string; color: string }> = {
      "NOVO": { bg: "rgba(100,116,139,0.15)", color: "#64748B" },
      "EM_SEPARACAO": { bg: "rgba(59,130,246,0.15)", color: "#3B82F6" },
      "SEPARADO": { bg: "rgba(59,130,246,0.15)", color: "#3B82F6" },
      "EM_CONFERENCIA": { bg: "rgba(139,92,246,0.15)", color: "#8B5CF6" },
      "CONFERIDO": { bg: "rgba(16,185,129,0.15)", color: "#10B981" },
      "PRONTO_ROMANEIO": { bg: "rgba(16,185,129,0.15)", color: "#10B981" },
      "EXPEDIDO": { bg: "rgba(16,185,129,0.15)", color: "#10B981" },
      "CANCELADO": { bg: "rgba(239,68,68,0.15)", color: "#EF4444" },
      "DIVERGENTE": { bg: "rgba(245,158,11,0.15)", color: "#F59E0B" }
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

  const filteredDataOrders = activeFilter === "todos" ? data.orders : data.orders.filter((o: any) => {
    if (activeFilter === "aguardando") return o.status === "NOVO";
    if (activeFilter === "conferencia") return o.status === "EM_CONFERENCIA";
    if (activeFilter === "carregando") return ["EM_SEPARACAO", "SEPARADO", "PRONTO_ROMANEIO"].includes(o.status);
    if (activeFilter === "atrasados") return o.ageTone === "LATE";
    return true;
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredDataOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = filteredDataOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const orders = paginatedOrders.map((o: any) => {
    const ss = getStatusStyle(o.status);
    const carrierRaw = o.carrierName || o.channel || o.marketplace || "N/A";
    const cs = getCarrierStyle(carrierRaw);
    
    const isExpedido = ["EXPEDIDO", "PRONTO_ROMANEIO", "CONFERIDO"].includes(o.status);
    const isConf = o.status === "EM_CONFERENCIA";
    const isSep = ["EM_SEPARACAO", "SEPARADO"].includes(o.status);
    const conf = isExpedido ? 100 : (isConf ? 50 : (isSep ? 25 : 0));
    const isFull = conf === 100;
    const confFill = isFull ? 'linear-gradient(90deg,#10B981,#34D399)' : (conf > 0 ? '#3B82F6' : t.barTrack);

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
      itemsLabel: `${o.itemCount || 0} ${(o.itemCount === 1 ? 'item' : 'itens')}`,
      sla: o.ageLabel || "-",
      slaColor: o.ageTone === "LATE" ? "#EF4444" : (o.ageTone === "WARNING" ? "#F59E0B" : t.text),
      conf: conf + "%",
      confW: conf + "%",
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
  
  const isSearch = false;
  const waves: any[] = [];
  const conferenceOrders: any[] = [];
  const scanIcon = <PackageSearch size={20} />;
  const alertIcon = <AlertTriangle size={20} />;
  const divergences = data.orders.filter((o: any) => o.status === "DIVERGENTE" || o.status === "ERRO");
  const emptyImg = "";
  const btnColor = "#3B82F6";
  const softBg = t.softBg;
  const textSub = t.textSub;
  const ordersCount = filteredDataOrders.length;
  const columns = ["Pedido", "Cliente", "Depositante", "Canal", "Itens", "Progresso", "SLA", "Status", ""];
  const divColumns = ["Pedido", "Tipo", "Problema / Divergência", "Responsável", "Registrado por", ""];

  return (
    <div className="w-full relative opacity-95">
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
      `}</style>

      {/*<!-- title row -->*/}
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
          { showAdd  && (<>
            <button style={{height: "44px", padding: "0 20px", border: "none", borderRadius: "11px", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99,102,241,0.32)", display: "flex", alignItems: "center", gap: "8px"}} >{addBtnLabel }</button>
          
      {/*<!-- ============ DRAWER ============ -->*/}
      {selectedOrder && (() => {
        const sel = selectedOrder;
        
        const getTimelineSteps = (status: string, t: any) => {
          const activeColor = "#3B82F6";
          const successColor = "#10B981";
          const pendingColor = t.barTrack;
          const activeHalo = "rgba(59,130,246,0.15)";
          const successHalo = "rgba(16,185,129,0.15)";
          
          const isConferidoExpedido = ["CONFERIDO", "PRONTO_ROMANEIO", "EXPEDIDO"].includes(status);
          const isConferencia = status === "EM_CONFERENCIA";
          const isSeparacao = ["EM_SEPARACAO", "SEPARADO"].includes(status);
          const isNovo = status === "NOVO";
          const isErro = status === "DIVERGENTE" || status === "ERRO" || status === "CANCELADO";
    
          return [
            {
              title: "Pedido Recebido",
              sub: "O pedido foi importado com sucesso",
              titleColor: t.text,
              dot: successColor,
              halo: successHalo,
              line: successColor,
            },
            {
              title: "Em Separação",
              sub: "Coletando os itens no armazém",
              titleColor: (isSeparacao || isConferencia || isConferidoExpedido) ? t.text : t.textSub,
              dot: isConferidoExpedido || isConferencia ? successColor : (isSeparacao ? activeColor : pendingColor),
              halo: isConferidoExpedido || isConferencia ? successHalo : (isSeparacao ? activeHalo : "transparent"),
              line: isConferidoExpedido || isConferencia ? successColor : pendingColor,
            },
            {
              title: "Em Conferência",
              sub: "Conferindo os itens",
              titleColor: (isConferencia || isConferidoExpedido) ? t.text : t.textSub,
              dot: isConferidoExpedido ? successColor : (isConferencia ? activeColor : pendingColor),
              halo: isConferidoExpedido ? successHalo : (isConferencia ? activeHalo : "transparent"),
              line: isConferidoExpedido ? successColor : pendingColor,
            },
            {
              title: isErro ? "Problema/Erro" : "Despachado",
              sub: isErro ? "Atenção necessária" : "Pedido pronto para expedição",
              titleColor: isConferidoExpedido ? t.text : (isErro ? "#EF4444" : t.textSub),
              dot: isConferidoExpedido ? successColor : (isErro ? "#EF4444" : pendingColor),
              halo: isConferidoExpedido ? successHalo : (isErro ? "rgba(239, 68, 68, 0.15)" : "transparent"),
              line: "transparent",
            }
          ];
        };

        const steps = getTimelineSteps(sel.raw.status, t);
        const specs = [
          { k: "Canal", v: sel.carrier },
          { k: "Depositante", v: sel.owner },
          { k: "Nota Fiscal", v: sel.raw.nfe || "-" },
          { k: "Corte (SLA)", v: sel.sla }
        ];

        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
            <div
              onClick={() => setSelectedOrder(null)}
              style={{ position: "absolute", inset: 0, background: "rgba(6, 10, 20, 0.55)", backdropFilter: "blur(3px)", animation: "overlayFade 0.25s ease" }}
            ></div>
            <div style={{ position: "relative", width: "440px", maxWidth: "92vw", height: "100%", background: t.cardBg, borderLeft: `1px solid ${t.border}`, boxShadow: "-24px 0 60px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", animation: "drawerIn 0.32s cubic-bezier(.3,1,.4,1)", overflow: "hidden" }}>
              <div style={{ position: "relative", padding: "24px", borderBottom: `1px solid ${t.border}`, overflow: "hidden" }}>
                <div style={{ position: "absolute", width: "240px", height: "240px", right: "-80px", top: "-110px", borderRadius: "50%", background: "radial-gradient(circle, rgba(139, 92, 246, 0.28), transparent 70%)", pointerEvents: "none" }}></div>
                <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.12em", color: t.textSub }}>PEDIDO</span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "26px", fontWeight: "700", lineHeight: "1" }}>{sel.code}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", alignSelf: "flex-start", padding: "5px 12px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", background: sel.statusBg, color: sel.statusColor }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: sel.statusDot }}></span>{sel.statusLabel}
                    </span>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} style={{ width: "36px", height: "36px", flexShrink: "0", borderRadius: "10px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.textSub, fontSize: "16px", cursor: "pointer" }}>✕</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "15px", fontWeight: "700" }}>{sel.customer}</span>
                  <span style={{ fontSize: "12.5px", color: t.textSub }}>{sel.owner} · {sel.city}</span>
                </div>
                {/* progress steps */}
                <div style={{ marginBottom: "22px", display: "flex", flexDirection: "column", gap: "2px" }}>
                  {steps.map((st, i) => (
                    <div key={i} style={{ display: "flex", gap: "14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "12px" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: st.dot, boxShadow: `0 0 0 3px ${st.halo}`, marginTop: "3px" }}></span>
                        <span style={{ flex: 1, width: "2px", background: st.line }}></span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingBottom: "16px" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: "700", color: st.titleColor }}>{st.title}</span>
                        <span style={{ fontSize: "12px", color: t.textSub }}>{st.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* specs */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {specs.map((s, i) => (
                    <div key={i} style={{ padding: "14px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.softBg, display: "flex", flexDirection: "column", gap: "5px" }}>
                      <span style={{ fontSize: "11.5px", color: t.textSub }}>{s.k}</span>
                      <span style={{ fontSize: "14.5px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s.v}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flexShrink: 0, padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", gap: "10px", background: t.cardBg }}>
                <button style={{ flex: 1, height: "46px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>⎙ Romaneio</button>
                <a href="/m/separacao" style={{ flex: 1.4, height: "46px", border: "none", borderRadius: "11px", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99, 102, 241, 0.32)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Iniciar separação</a>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* CSS for animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes drawerIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes overlayFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />

      </>)}
        </div>
      </div>

      {/*<!-- KPI cards -->*/}
      <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px"}}>
        {kpis ?.map((k: any, i: number) => <React.Fragment key={i}>
          <div style={{padding: "20px", borderRadius: "16px", border: `1px solid ${t.border }`, background: `${t.cardBg }`, display: "flex", flexDirection: "column", gap: "12px"}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
              <span style={{fontSize: "13px", fontWeight: "600", color: `${t.textSub }`}}>{k.label }</span>
              <span style={{width: "34px", height: "34px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: `${k.iconBg }`, color: `${k.iconColor }`}}>{k.iconEl }</span>
            </div>
            <div style={{display: "flex", alignItems: "baseline", gap: "8px"}}>
              <span style={{fontFamily: "'Space Grotesk', sans-serif", fontSize: "30px", fontWeight: "700"}}>{k.value }</span>
              { k.delta ? <span style={{fontSize: "13px", fontWeight: "700", color: `${k.deltaColor }`}}>{k.delta }</span> : null }
            </div>
          </div>
        </React.Fragment>)}
      </div>

      {/*<!-- ============ FLUXO DE TRABALHO ============ -->*/}
      { isOrders  && (<>
      <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px"}}>
        {flowCards ?.map((c: any, i: number) => <React.Fragment key={i}>
          <a href={c.href} className="flow-card" style={{ "--accent": c.accent, "--card-bg": t.cardBg, "--border": t.border, "--shadow": isDark ? "0 16px 32px rgba(0,0,0,0.2)" : "0 16px 32px rgba(0,0,0,0.06)" } as React.CSSProperties} >
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
      </>)}

      {/*<!-- ============ ORDERS TABLE ============ -->*/}
      { isOrders  && (<>
      <div style={{borderRadius: "16px", border: `1px solid ${t.border }`, background: `${t.cardBg }`, overflow: "hidden"}}>
        <div style={{display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px", borderBottom: `1px solid ${t.border }`, flexWrap: "wrap"}}>
          {filters ?.map((f: any, i: number) => <React.Fragment key={i}>
            <button onClick={f.action} style={{height: "36px", padding: "0 15px", borderRadius: "9px", fontFamily: "'Manrope', sans-serif", fontSize: "13px", fontWeight: "700", cursor: "pointer", border: `1px solid ${f.border }`, background: `${f.bg }`, color: `${f.color }`, transition: "all 0.18s ease", display: "flex", alignItems: "center", gap: "8px"}}>{f.label }{ f.hasCount  && (<><span style={{padding: "1px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: `${f.countFw || "600"}`, background: `${f.countBg }`, color: `${f.countColor }`}}>{f.count }</span></>)}</button>
          </React.Fragment>)}
          <div style={{flex: "1"}}></div>
          <span style={{fontSize: "13px", color: `${t.textSub }`}}>{ordersCount } pedidos na fila</span>
        </div>
        <div style={{overflowX: "auto"}}>
          <table style={{width: "100%", borderCollapse: "collapse", minWidth: "960px"}}>
            <thead>
              <tr style={{textAlign: "left"}}>
                {columns ?.map((c: any, i: number) => <React.Fragment key={i}>
                  <th style={{padding: "13px 20px", fontSize: "12px", fontWeight: "700", letterSpacing: "0.04em", textTransform: "uppercase", color: `${t.textSub }`, background: `${t.headBg }`, borderBottom: `1px solid ${t.border }`, whiteSpace: "nowrap"}}>{c }</th>
                </React.Fragment>)}
              </tr>
            </thead>
            <tbody>
              {orders ?.map((o: any, i: number) => <React.Fragment key={i}>
                <tr onClick={() => { setSelectedOrder(o); if(o.open) o.open(); }} style={{borderBottom: `1px solid ${t.border }`, cursor: "pointer", transition: "background 0.15s ease"}} >
                  <td style={{padding: "14px 20px"}}><span style={{fontFamily: "'Space Grotesk', sans-serif", fontWeight: "700", fontSize: "14.5px"}}>{o.code }</span></td>
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
          <span style={{fontSize: "13px", color: `${t.textSub }`}}>Mostrando {filteredDataOrders.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredDataOrders.length)} de {filteredDataOrders.length} pedidos</span>
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
      </>)}

      {/*<!-- ============ WAVES VIEW ============ -->*/}
      { isWaves  && (<>
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "18px"}}>
        {waves ?.map((w: any, i: number) => <React.Fragment key={i}>
          <div style={{borderRadius: "18px", border: `1px solid ${t.border }`, background: `${t.cardBg }`, overflow: "hidden"}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${t.border }`}}>
              <div style={{display: "flex", flexDirection: "column", gap: "3px"}}>
                <span style={{fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: "700"}}>{w.code }</span>
                <span style={{fontSize: "12.5px", color: `${t.textSub }`}}>{w.meta }</span>
              </div>
              <span style={{display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "700", background: `${w.statusBg }`, color: `${w.statusColor }`}}><span style={{width: "7px", height: "7px", borderRadius: "50%", background: `${w.statusDot }`}}></span>{w.status }</span>
            </div>
            <div style={{padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px"}}>
              <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
                <div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: `${t.textSub }`}}>Progresso</span><span style={{fontWeight: "700"}}>{w.pct }</span></div>
                <div style={{height: "8px", borderRadius: "999px", background: `${t.barTrack }`, overflow: "hidden"}}><div style={{height: "100%", width: `${w.pct }`, borderRadius: "999px", background: "linear-gradient(90deg,#3B82F6,#8B5CF6)", transformOrigin: "left", animation: "barGrow 0.8s ease"}}></div></div>
              </div>
              <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px"}}>
                {w.stats ?.map((s: any, i: number) => <React.Fragment key={i}>
                  <div style={{display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", borderRadius: "11px", background: `${t.softBg }`}}>
                    <span style={{fontFamily: "'Space Grotesk', sans-serif", fontSize: "17px", fontWeight: "700", color: `${s.color }`}}>{s.v }</span>
                    <span style={{fontSize: "11.5px", color: `${t.textSub }`}}>{s.k }</span>
                  </div>
                </React.Fragment>)}
              </div>
              <button style={{height: "42px", border: `1px solid ${t.border }`, borderRadius: "11px", background: `${t.inputBg }`, color: `${t.text }`, fontFamily: "'Manrope', sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer"}} >Abrir onda</button>
            </div>
          </div>
        </React.Fragment>)}
      </div>
      </>)}

      {/*<!-- ============ CONFERÊNCIA VIEW ============ -->*/}
      { isConference  && (<>
      <div style={{display: "flex", flexDirection: "column", gap: "18px"}}>
        <div style={{display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px", borderRadius: "14px", border: `1px solid ${t.border }`, background: `${t.softBg }`}}>
          <span style={{width: "38px", height: "38px", flexShrink: "0", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(139,92,246,0.16)", color: "#8B5CF6"}}>{scanIcon }</span>
          <div style={{display: "flex", flexDirection: "column", gap: "2px"}}>
            <span style={{fontSize: "14.5px", fontWeight: "700"}}>Fila de conferência</span>
            <span style={{fontSize: "12.5px", color: `${t.textSub }`}}>Selecione um pedido e inicie a conferência de saída item a item.</span>
          </div>
        </div>
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px"}}>
          {conferenceOrders ?.map((o: any, i: number) => <React.Fragment key={i}>
            <div style={{borderRadius: "18px", border: `1px solid ${o.cardBorder }`, background: `${t.cardBg }`, overflow: "hidden", display: "flex", flexDirection: "column"}}>
              <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${t.border }`}}>
                <span style={{fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: "700"}}>{o.code }</span>
                <span style={{display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "700", background: `${o.statusBg }`, color: `${o.statusColor }`}}><span style={{width: "7px", height: "7px", borderRadius: "50%", background: `${o.statusDot }`}}></span>{o.status }</span>
              </div>
              <div style={{padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px"}}>
                <div style={{display: "flex", flexDirection: "column", gap: "3px"}}>
                  <span style={{fontSize: "14px", fontWeight: "700"}}>{o.customer }</span>
                  <span style={{fontSize: "12.5px", color: `${t.textSub }`}}>{o.owner } · {o.city }</span>
                </div>
                <div style={{display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap"}}>
                  <span style={{display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "8px", fontSize: "11.5px", fontWeight: "700", background: `${o.carrierBg }`, color: `${o.carrierColor }`}}>{o.carrier }</span>
                  <span style={{padding: "3px 10px", borderRadius: "8px", fontSize: "11.5px", fontWeight: "700", background: `${t.softBg }`, color: `${t.textSub }`}}>{o.itemsLabel }</span>
                  <span style={{padding: "3px 10px", borderRadius: "8px", fontSize: "11.5px", fontWeight: "700", background: `${t.softBg }`, color: `${t.textSub }`}}>SLA {o.sla }</span>
                </div>
                <div style={{display: "flex", flexDirection: "column", gap: "7px"}}>
                  <div style={{display: "flex", justifyContent: "space-between", fontSize: "12.5px"}}><span style={{color: `${t.textSub }`}}>Conferência</span><span style={{fontWeight: "700"}}>{o.conf }</span></div>
                  <div style={{height: "7px", borderRadius: "999px", background: `${t.barTrack }`, overflow: "hidden"}}><div style={{height: "100%", width: `${o.confW }`, borderRadius: "999px", background: `${o.confFill }`}}></div></div>
                </div>
                <button onClick={o.open} style={{height: "46px", border: "none", borderRadius: "11px", background: `${o.btnBg }`, color: `${o.btnColor }`, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: `${o.btnShadow }`, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "transform 0.16s ease"}} >{o.confBtnLabel }</button>
              </div>
            </div>
          </React.Fragment>)}
        </div>
      </div>
      </>)}

      {/*<!-- ============ DIVERGÊNCIAS VIEW ============ -->*/}
      { isDivergence  && (<>
      <div style={{borderRadius: "16px", border: `1px solid ${t.border }`, background: `${t.cardBg }`, overflow: "hidden"}}>
        <div style={{display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderBottom: `1px solid ${t.border }`}}>
          <span style={{width: "34px", height: "34px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(239,68,68,0.14)", color: "#EF4444"}}>{alertIcon }</span>
          <div style={{display: "flex", flexDirection: "column", gap: "1px"}}>
            <span style={{fontFamily: "'Space Grotesk', sans-serif", fontSize: "15.5px", fontWeight: "700"}}>Divergências &amp; pendências</span>
            <span style={{fontSize: "12.5px", color: `${t.textSub }`}}>Pedidos travados aguardando tratativa antes da expedição.</span>
          </div>
          <div style={{flex: "1"}}></div>
          <span style={{fontSize: "13px", color: `${t.textSub }`}}>{divergenceCount } pendências</span>
        </div>
        <div style={{overflowX: "auto"}}>
          <table style={{width: "100%", borderCollapse: "collapse", minWidth: "900px"}}>
            <thead>
              <tr style={{textAlign: "left"}}>
                {divColumns ?.map((c: any, i: number) => <React.Fragment key={i}>
                  <th style={{padding: "13px 20px", fontSize: "12px", fontWeight: "700", letterSpacing: "0.04em", textTransform: "uppercase", color: `${t.textSub }`, background: `${t.headBg }`, borderBottom: `1px solid ${t.border }`, whiteSpace: "nowrap"}}>{c }</th>
                </React.Fragment>)}
              </tr>
            </thead>
            <tbody>
              {divergences ?.map((d: any, i: number) => <React.Fragment key={i}>
                <tr style={{borderBottom: `1px solid ${t.border }`, transition: "background 0.15s ease"}} >
                  <td style={{padding: "14px 20px"}}><span style={{fontFamily: "'Space Grotesk', sans-serif", fontWeight: "700", fontSize: "14.5px"}}>{d.code }</span></td>
                  <td style={{padding: "14px 20px"}}><span style={{display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13.5px", fontWeight: "700", color: `${d.typeColor }`}}><span style={{width: "8px", height: "8px", borderRadius: "50%", background: `${d.typeColor }`}}></span>{d.type }</span></td>
                  <td style={{padding: "14px 20px", fontSize: "13.5px", color: `${t.textSub }`, maxWidth: "300px"}}>{d.desc }</td>
                  <td style={{padding: "14px 20px", fontSize: "14px", fontWeight: "600"}}>{d.owner }</td>
                  <td style={{padding: "14px 20px", fontSize: "13.5px", color: `${t.textSub }`}}>{d.who }</td>
                  <td style={{padding: "14px 20px", textAlign: "right"}}><button style={{height: "34px", padding: "0 14px", borderRadius: "9px", border: `1px solid ${t.border }`, background: `${t.inputBg }`, color: `${t.text }`, fontFamily: "'Manrope', sans-serif", fontSize: "12.5px", fontWeight: "700", cursor: "pointer"}} >Tratar</button></td>
                </tr>
              </React.Fragment>)}
            </tbody>
          </table>
        </div>
      </div>
      </>)}
    
    </div>
  );
}
