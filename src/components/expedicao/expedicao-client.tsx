
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
  Truck
} from "lucide-react";

export function ExpedicaoClient({ data }: { data: any }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("orders");

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
    ordersBg: isOrders ? "rgba(59,130,246,0.15)" : "transparent",
    ordersColor: isOrders ? "#3B82F6" : t.textSub,
    divBg: isDivergence ? "rgba(239, 68, 68, 0.15)" : "transparent",
    divColor: isDivergence ? "#EF4444" : t.textSub,
    divCountBg: isDivergence ? "#EF4444" : t.border,
    divCountColor: isDivergence ? "#fff" : t.text
  };

  const showAdd = true;
  const addBtnLabel = "+ Novo pedido";
  const divergenceCount = data.orders.filter((o: any) => o.status === "DIVERGENTE" || o.status === "ERRO").length;

  const kpis = [
    { label: "A expedir hoje", value: "146", delta: "", iconEl: <Box size={20} />, iconBg: "rgba(59,130,246,0.15)", iconColor: "#3B82F6", deltaColor: "" },
    { label: "Em conferência", value: "32", delta: "", iconEl: <CheckCircle2 size={20} />, iconBg: "rgba(139,92,246,0.15)", iconColor: "#8B5CF6", deltaColor: "" },
    { label: "Aguardando separação", value: "48", delta: "", iconEl: <Clock size={20} />, iconBg: "rgba(16,185,129,0.15)", iconColor: "#10B981", deltaColor: "" },
    { label: "Expedidos hoje", value: "284", delta: "▲ 12%", iconEl: <CheckCircle2 size={20} />, iconBg: "rgba(245,158,11,0.15)", iconColor: "#F59E0B", deltaColor: "#10B981" }
  ];

  const flowCards = [
    { href: "#", kicker: "STEP 1", iconEl: "1", iconBg: "rgba(148,163,184,0.15)", accent: "#64748B", title: "Integração", desc: "Sincronização de pedidos", btnBg: t.softBg, btnColor: t.textSub, cta: "Fila: " + (data.queues[0]?.value || 0) },
    { href: "#", kicker: "STEP 2", iconEl: "2", iconBg: "rgba(59,130,246,0.15)", accent: "#3B82F6", title: "Separação", desc: "Picking por zona/onda", btnBg: "rgba(59,130,246,0.15)", btnColor: "#3B82F6", cta: "Aguardando: " + (data.queues[1]?.value || 0) },
    { href: "#", kicker: "STEP 3", iconEl: "3", iconBg: "rgba(139,92,246,0.15)", accent: "#8B5CF6", title: "Conferência", desc: "Bipagem de saída", btnBg: "rgba(139,92,246,0.15)", btnColor: "#8B5CF6", cta: "Fila: " + (data.queues[2]?.value || 0) },
    { href: "#", kicker: "STEP 4", iconEl: "4", iconBg: "rgba(16,185,129,0.15)", accent: "#10B981", title: "Expedido", desc: "Despacho final", btnBg: "rgba(16,185,129,0.15)", btnColor: "#10B981", cta: "Prontos: " + (data.queues[3]?.value || 0) },
  ];

  const tableFilters = [
    { label: "Todos", hasCount: false, count: 0, countBg: "", countColor: "", bg: t.softBg, color: t.text, border: "transparent" }
  ];
  const tSearchIcon = <PackageSearch size={16} />;

  const getStatusColor = (s: string) => {
    if (s === "CONCLUIDO") return { bg: "rgba(16,185,129,0.15)", text: "#10B981" };
    if (s === "PENDENTE") return { bg: "rgba(245,158,11,0.15)", text: "#F59E0B" };
    return { bg: "rgba(148,163,184,0.15)", text: "#64748B" };
  };

  const tableOrders = data.orders.map((o: any) => {
    const sc = getStatusColor(o.status);
    return {
      code: o.codigo || o.id.slice(0, 8),
      customer: o.cliente?.nome || "Sem cliente",
      carrier: o.transportadora || "N/A",
      items: (o.total_itens || 0) + " itens",
      sla: "24h",
      conf: "0%",
      confW: "0%",
      statusLabel: o.status,
      statusColor: sc.text,
      statusBg: sc.bg,
      statusDot: sc.text,
      avatar: o.cliente?.nome?.[0]?.toUpperCase() || "C",
      avatarBg: "rgba(59,130,246,0.15)",
      avatarColor: "#3B82F6",
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
  const ordersCount = data.totalOrders;
  const filters = tableFilters;
  const orders = tableOrders;
  const columns = ["Pedido", "Cliente", "Transportadora", "Itens", "Progresso", "SLA", "Status", ""];
  const divColumns = ["Pedido", "Tipo", "Problema / Divergência", "Responsável", "Registrado por", ""];

  return (
    <div className="w-full relative opacity-95">


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
              <span style={{fontSize: "13px", fontWeight: "700", color: `${k.deltaColor }`}}>{k.delta }</span>
            </div>
          </div>
        </React.Fragment>)}
      </div>

      {/*<!-- ============ FLUXO DE TRABALHO ============ -->*/}
      { isOrders  && (<>
      <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px"}}>
        {flowCards ?.map((c: any, i: number) => <React.Fragment key={i}>
          <a href="{c.href }" style={{textDecoration: "none", position: "relative", padding: "22px", borderRadius: "16px", border: `1px solid ${t.border }`, background: `${t.cardBg }`, display: "flex", flexDirection: "column", gap: "16px", cursor: "pointer", overflow: "hidden", transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"}} >
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
            <button style={{height: "36px", padding: "0 15px", borderRadius: "9px", fontFamily: "'Manrope', sans-serif", fontSize: "13px", fontWeight: "700", cursor: "pointer", border: `1px solid ${f.border }`, background: `${f.bg }`, color: `${f.color }`, transition: "all 0.18s ease", display: "flex", alignItems: "center", gap: "8px"}}>{f.label }{ f.hasCount  && (<><span style={{padding: "1px 8px", borderRadius: "999px", fontSize: "11px", background: `${f.countBg }`, color: `${f.countColor }`}}>{f.count }</span></>)}</button>
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
                <tr onClick={o.open} style={{borderBottom: `1px solid ${t.border }`, cursor: "pointer", transition: "background 0.15s ease"}} >
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
                  <td style={{padding: "14px 20px"}}><span style={{display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", background: `${o.statusBg }`, color: `${o.statusColor }`}}><span style={{width: "7px", height: "7px", borderRadius: "50%", background: `${o.statusDot }`}}></span>{o.status }</span></td>
                  <td style={{padding: "14px 20px", textAlign: "right"}}><span style={{color: `${t.textSub }`, fontWeight: "700"}} >›</span></td>
                </tr>
              </React.Fragment>)}
            </tbody>
          </table>
        </div>
        <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: `1px solid ${t.border }`, flexWrap: "wrap", gap: "12px"}}>
          <span style={{fontSize: "13px", color: `${t.textSub }`}}>Mostrando 1–8 de 146 pedidos</span>
          <div style={{display: "flex", gap: "6px"}}>
            <button style={{width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border }`, background: `${t.inputBg }`, color: `${t.textSub }`, cursor: "pointer", fontSize: "13px"}}>‹</button>
            <button style={{width: "34px", height: "34px", borderRadius: "8px", border: "none", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "700"}}>1</button>
            <button style={{width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border }`, background: `${t.inputBg }`, color: `${t.text }`, cursor: "pointer", fontSize: "13px"}}>2</button>
            <button style={{width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border }`, background: `${t.inputBg }`, color: `${t.text }`, cursor: "pointer", fontSize: "13px"}}>3</button>
            <button style={{width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border }`, background: `${t.inputBg }`, color: `${t.textSub }`, cursor: "pointer", fontSize: "13px"}}>›</button>
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
