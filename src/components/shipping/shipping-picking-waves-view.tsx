/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Clock, CheckCircle2, X, Waves, ClipboardList, Box, Plus } from "lucide-react";

export function ShippingPickingWavesView({ 
  orders,
  depositantes 
}: { 
  orders: any[];
  depositantes: { id: string, nome: string }[];
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [strategy, setStrategy] = useState(0);
  const [limit, setLimit] = useState(40);
  const [selectedDepositante, setSelectedDepositante] = useState("");

  const t = isDark ? {
    appBg: '#0A1120', sideBg: '#0C1424', barBg: '#0C1424', cardBg: '#101B30',
    inputBg: '#0E1728', softBg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.14)',
    text: '#F1F5F9', textSub: '#8695AD', barTrack: 'rgba(148,163,184,0.16)'
  } : {
    appBg: '#F5F7FB', sideBg: '#FFFFFF', barBg: '#FFFFFF', cardBg: '#FFFFFF',
    inputBg: '#F8FAFC', softBg: 'rgba(100,116,139,0.05)', border: 'rgba(100,116,139,0.16)',
    text: '#0F172A', textSub: '#64748B', barTrack: 'rgba(100,116,139,0.14)'
  };

  const hex2 = (h: string, a: number) => { 
    const n = parseInt(h.slice(1), 16); 
    return 'rgba(' + (n>>16&255) + ',' + (n>>8&255) + ',' + (n&255) + ',' + a + ')'; 
  };
  const grad = 'linear-gradient(92deg,#3B82F6,#8B5CF6)';

  // Calculate stats & active waves
  const activeWaves = useMemo(() => {
    const inProgress = orders.filter(o => o.status === "EM_SEPARACAO" || o.status === "NOVO");
    const groups = new Map<string, any[]>();
    
    // We group by operator. If NOVO, we group by "Aguardo"
    inProgress.forEach(o => {
      const key = o.status === "NOVO" ? 'aguardando' : (o.operatorId || 'unassigned');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(o);
    });

    const opColors = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981'];
    let colorIdx = 0;

    return Array.from(groups.entries())
      .filter(([key]) => key !== 'aguardando')
      .map(([key, opsOrders], i) => {
      const operatorName = opsOrders[0].operatorName || 'Operador Desconhecido';
      
      let totalItems = 0;
      let completedItems = 0;
      opsOrders.forEach(o => {
        const items = o.totalItems || o.itens?.length || 0;
        totalItems += items;
        completedItems += o.completedItems || Math.floor(items / 2); 
      });

      const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      const status = pct >= 100 ? 'Concluída' : 'Em separação';
      const done = status === 'Concluída';
      
      let statusBg, statusColor, statusDot;
      if (status === 'Em separação') { statusBg = hex2('#3B82F6', 0.14); statusColor = '#3B82F6'; statusDot = '#3B82F6'; }
      else if (status === 'Concluída') { statusBg = hex2('#10B981', 0.14); statusColor = '#10B981'; statusDot = '#10B981'; }
      
      const c = opColors[colorIdx % opColors.length];
      colorIdx++;

      return {
        id: key,
        code: `Onda W-${i+101}`,
        meta: `${opsOrders.length} pedidos · ${opsOrders[0].depositante || 'Vários'}`,
        status,
        statusBg, statusColor, statusDot,
        pct,
        pctColor: done ? '#10B981' : (pct === 0 ? t.textSub : '#8B5CF6'),
        barFill: done ? 'linear-gradient(90deg,#10B981,#34D399)' : 'linear-gradient(90deg,#3B82F6,#8B5CF6)',
        op: operatorName,
        opInit: operatorName.split(' ').map((x:any) => x[0]).slice(0, 2).join(''),
        opBg: `linear-gradient(135deg, ${c}, ${hex2(c, 0.65)})`,
        cta: done ? 'Ver detalhes' : (pct === 0 ? 'Iniciar separação' : 'Continuar separação'),
        stats: [
          { v: completedItems.toString(), k: 'Separados' },
          { v: (totalItems - completedItems).toString(), k: 'Pendentes' },
          { v: '—', k: 'Itens/min' }
        ],
        orders: opsOrders.map(o => o.id)
      };
    }).sort((a,b) => -1);
  }, [orders]);

  const kpis = [
    { label: 'Ondas ativas', value: activeWaves.filter(w => w.status !== 'Concluída').length, iconEl: <Waves size={20} />, iconBg: hex2('#3B82F6', 0.14), iconColor: '#3B82F6' },
    { label: 'Pedidos em separação', value: orders.filter(o => o.status === 'EM_SEPARACAO').length, iconEl: <ClipboardList size={20} />, iconBg: hex2('#8B5CF6', 0.14), iconColor: '#8B5CF6' },
    { label: 'Aguardando onda', value: orders.filter(o => o.status === 'NOVO').length, iconEl: <Clock size={20} />, iconBg: hex2('#F59E0B', 0.14), iconColor: '#F59E0B' },
    { label: 'Concluídas hoje', value: orders.filter(o => o.status === 'SEPARADO').length, iconEl: <CheckCircle2 size={20} />, iconBg: hex2('#10B981', 0.14), iconColor: '#10B981' }
  ];

  const stratDefs = [
    { title: 'Por prioridade (SLA)', sub: 'Pedidos com corte mais próximo' },
    { title: 'Single / multi-item', sub: 'Separa unitários dos combinados' },
    { title: 'Por rota / região', sub: 'Agrupa pedidos da mesma região' },
    { title: 'Por transportadora', sub: 'Mesma coleta / marketplace' }
  ];

  const eligibleOrders = useMemo(() => {
    let avail = orders.filter(o => o.status === "NOVO");
    if (selectedDepositante) {
      avail = avail.filter(o => o.depositanteId === selectedDepositante);
    }
    // Very simple sort based on strategy for now
    if (strategy === 1) {
      // Single item first
      avail.sort((a,b) => (a.totalItems || 0) - (b.totalItems || 0));
    }
    return avail.slice(0, limit);
  }, [orders, strategy, limit, selectedDepositante]);

  const previewItems = eligibleOrders.reduce((sum, o) => sum + (o.totalItems || 0), 0);

  const handleCreateWave = () => {
    if (eligibleOrders.length === 0) {
      alert("Não há pedidos elegíveis para esta onda.");
      return;
    }
    const ids = eligibleOrders.map(o => o.id).join(",");
    router.push(`/expedicao/separacao/lote?ids=${encodeURIComponent(ids)}`);
  };

  const handleOpenWave = (wave: any) => {
    if (wave.orders.length === 0) return;
    const ids = wave.orders.join(",");
    router.push(`/expedicao/separacao/lote?ids=${encodeURIComponent(ids)}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", opacity: 0.95 }}>
      {/* BREADCRUMB / BACK BUTTON */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.push("/expedicao")}
          className="inline-flex items-center justify-center h-[40px] px-4 rounded-[12px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[14px] font-bold text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm cursor-pointer"
        >
          <span className="mr-1.5 text-slate-500 font-normal">‹</span> Expedição
        </button>
        <div className="flex items-center gap-2 text-[14px] ml-1">
          <span className="text-slate-500">Expedição</span>
          <span className="text-slate-300 dark:text-slate-600 text-[12px]">›</span>
          <span className="text-slate-900 dark:text-slate-100 font-medium">Ondas de Separação</span>
        </div>
      </div>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: "800", color: t.text, margin: 0 }}>Ondas de Separação</h1>
          <span style={{ fontSize: "14.5px", color: t.textSub }}>Gerencie filas de picking agrupadas e otimize o trajeto no armazém.</span>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: "8px", height: "44px", padding: "0 20px", borderRadius: "11px", border: "none", background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99,102,241,0.32)", transition: "transform 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
          <Plus size={18} /> Nova onda
        </button>
      </div>

      {/* KPIS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ padding: "24px", minHeight: "108px", borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, display: "flex", alignItems: "center", gap: "18px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: k.iconBg, color: k.iconColor }}>{k.iconEl}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: "800", color: t.text, lineHeight: 1 }}>{k.value}</span>
              <span style={{ fontSize: "13.5px", color: t.textSub, fontWeight: "500", marginTop: "2px" }}>{k.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* WAVES GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "18px" }}>
        {activeWaves.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", padding: "60px 20px", textAlign: "center", color: t.textSub, fontSize: "14px", fontWeight: "500", background: t.cardBg, borderRadius: "16px", border: `1px solid ${t.border}` }}>
            Nenhuma onda em execução no momento. Clique em "+ Nova onda" para começar.
          </div>
        ) : (
          activeWaves.map((w, i) => (
            <div key={i} style={{ borderRadius: "18px", border: `1px solid ${t.border}`, background: t.cardBg, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: "700", color: t.text }}>{w.code}</span>
                  <span style={{ fontSize: "12.5px", color: t.textSub }}>{w.meta}</span>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "700", background: w.statusBg, color: w.statusColor }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: w.statusDot }}></span>{w.status}
                </span>
              </div>
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                    <span style={{ color: t.textSub }}>Progresso</span>
                    <span style={{ fontWeight: "700", color: t.text }}>{w.pct}%</span>
                  </div>
                  <div style={{ height: "8px", borderRadius: "999px", background: t.barTrack, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${w.pct}%`, borderRadius: "999px", background: w.barFill, transformOrigin: "left", transition: "width 0.5s ease" }}></div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  {w.stats.map((s, si) => (
                    <div key={si} style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "10px 12px", borderRadius: "11px", background: t.softBg }}>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "17px", fontWeight: "700", color: si === 0 && w.status !== 'Aguardando' ? '#3B82F6' : t.text }}>{s.v}</span>
                      <span style={{ fontSize: "11.5px", color: t.textSub }}>{s.k}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: w.opBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800" }}>{w.opInit}</div>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: t.textSub }}>{w.op}</span>
                  </div>
                  <button onClick={() => handleOpenWave(w)} style={{ height: "36px", padding: "0 16px", border: `1px solid ${t.border}`, borderRadius: "9px", background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "border-color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = "#8B5CF6"} onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border}>
                    {w.cta}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE WAVE MODAL */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={() => setShowCreate(false)} style={{ position: "absolute", inset: 0, background: "rgba(6,10,20,0.6)", backdropFilter: "blur(4px)", animation: "overlayFade 0.25s ease" }}></div>
          <div style={{ position: "relative", width: "520px", maxWidth: "96vw", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: "20px", background: t.cardBg, border: `1px solid ${t.border}`, boxShadow: "0 32px 80px rgba(0,0,0,0.4)", animation: "drawerIn 0.3s cubic-bezier(.3,1,.4,1)" }}>
            <div style={{ padding: "24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: "700", color: t.text }}>Nova onda de separação</span>
                <span style={{ fontSize: "13px", color: t.textSub }}>Selecione critérios para agrupar os pedidos.</span>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ width: "36px", height: "36px", flexShrink: 0, borderRadius: "10px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.textSub, fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={(e) => e.currentTarget.style.color = "#8B5CF6"} onMouseLeave={(e) => e.currentTarget.style.color = t.textSub}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>Estratégia de agrupamento</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {stratDefs.map((s, i) => {
                    const on = i === strategy;
                    return (
                      <div key={i} onClick={() => setStrategy(i)} style={{ padding: "14px", borderRadius: "12px", cursor: "pointer", border: `1.5px solid ${on ? '#8B5CF6' : t.border}`, background: on ? hex2('#8B5CF6', 0.08) : t.cardBg, display: "flex", flexDirection: "column", gap: "4px", transition: "all 0.16s ease" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: "700", color: on ? (isDark ? '#C4B5FD' : '#8B5CF6') : t.text }}>{s.title}</span>
                        <span style={{ fontSize: "11.5px", color: t.textSub }}>{s.sub}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>Depositante</span>
                  <select 
                    value={selectedDepositante} 
                    onChange={e => setSelectedDepositante(e.target.value)}
                    style={{ height: "46px", padding: "0 14px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, fontSize: "14px", color: t.text, outline: "none" }}
                  >
                    <option value="">Todos</option>
                    {depositantes.map(d => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>Limite de pedidos</span>
                  <input 
                    type="number"
                    value={limit}
                    onChange={e => setLimit(Number(e.target.value))}
                    style={{ height: "46px", padding: "0 14px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} 
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", borderRadius: "12px", background: t.softBg, border: `1px dashed ${t.border}` }}>
                <span style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(139,92,246,0.16)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Box size={20} />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: t.text }}>{eligibleOrders.length} pedidos elegíveis</span>
                  <span style={{ fontSize: "12px", color: t.textSub }}>{previewItems} volumes estimados nesta onda</span>
                </div>
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.border}`, display: "flex", gap: "10px" }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, height: "48px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "700", cursor: "pointer" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = "#8B5CF6"} onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border}>
                Cancelar
              </button>
              <button 
                onClick={handleCreateWave} 
                disabled={eligibleOrders.length === 0}
                style={{ flex: 1.6, height: "48px", border: "none", borderRadius: "11px", background: eligibleOrders.length ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : t.border, color: eligibleOrders.length ? "#fff" : t.textSub, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: eligibleOrders.length ? "pointer" : "not-allowed", boxShadow: eligibleOrders.length ? "0 8px 22px rgba(99,102,241,0.32)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                Criar e iniciar separação →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
