/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Clock, CheckCircle2, X, Waves, ClipboardList, Box, CheckSquare, Square, Plus, Trash2, Check } from "lucide-react";
import { FancySelectInput } from "@/components/ui/fancy-select-input";
import { createShippingWaveAction, startShippingWaveAction, deleteShippingWavesAction } from "@/app/(dashboard)/expedicao/separacao/actions";

export function ShippingPickingWavesView({
  orders,
  depositantes,
  initialWaves = []
}: {
  orders: any[];
  depositantes: { id: string, nome: string }[];
  initialWaves?: any[];
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [strategy, setStrategy] = useState(0);
  const [limit, setLimit] = useState(50);
  const [selectedDepositante, setSelectedDepositante] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [openingWave, setOpeningWave] = useState<string | null>(null);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [deletingWaves, setDeletingWaves] = useState(false);

  async function handleDeleteSelected() {
    if (selectedForDelete.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${selectedForDelete.length} onda(s)? Os pedidos voltarão para o status NOVO.`)) return;
    setDeletingWaves(true);
    await deleteShippingWavesAction(selectedForDelete);
    setDeletingWaves(false);
    setIsDeleteMode(false);
    setSelectedForDelete([]);
  }

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
    return (initialWaves || []).map((w) => {
      const isConcluida = w.status === 'CONCLUIDA';
      const isAguardando = w.status === 'PENDENTE';
      const isEmSeparacao = w.status === 'EM_SEPARACAO';
      
      let pct = 0;
      let totalItems = 0;
      let completedItems = 0;
      
        let itensMin = '—';
        if (w.iniciado_em && w.status !== 'PENDENTE') {
          const diffMs = new Date().getTime() - new Date(w.iniciado_em).getTime();
          const diffMins = Math.max(diffMs / 1000 / 60, 1);
          let localCompleted = 0;
          const localWaveOrders = orders.filter(o => w.pedidos?.some((p:any) => p.pedido_expedicao_id === o.id));
          localWaveOrders.forEach(o => { localCompleted += (o.separatedUnits || 0); });
          if (localCompleted > 0) { itensMin = (localCompleted / diffMins).toFixed(1); } else { itensMin = '0.0'; }
        }
      const waveOrders = orders.filter(o => w.pedidos?.some((p:any) => p.pedido_expedicao_id === o.id));
      waveOrders.forEach(o => {
        totalItems += (o.totalUnits || 0);
        completedItems += (o.separatedUnits || 0);
      });
      
      if (totalItems > 0) {
        pct = Math.round((completedItems / totalItems) * 100);
      }
      if (isConcluida) pct = 100;
      
      let statusStr = 'Aguardando';
      let statusBg = '#F59E0B22';
      let statusColor = '#F59E0B';
      let statusDot = '#F59E0B';
      let barFill = '#E2E8F0';
      let iconBg = '#F59E0B22';
      let iconColor = '#F59E0B';
      let iconEl = <Clock size={22} />;
      
      if (isConcluida) {
        statusStr = 'Concluída';
        statusBg = '#10B98122';
        statusColor = '#10B981';
        statusDot = '#10B981';
        barFill = '#10B981';
        iconBg = '#10B98122';
        iconColor = '#10B981';
        iconEl = <CheckCircle2 size={22} />;
      } else if (isEmSeparacao) {
        statusStr = 'Em separação';
        statusBg = '#3B82F622';
        statusColor = '#3B82F6';
        statusDot = '#3B82F6';
        barFill = 'linear-gradient(90deg, #3B82F6, #8B5CF6)';
        iconBg = '#3B82F622';
        iconColor = '#3B82F6';
        iconEl = <Waves size={22} />;
      }

      const opName = w.operador?.nome || 'Não iniciada';
      let opInit = '—';
      let opBg = '#F43F5E';
      if (opName !== 'Não iniciada') {
        opInit = opName.split(' ').map((x:string) => x[0]).slice(0,2).join('').toUpperCase();
        opBg = '#3B82F6';
      }

      return {
        id: w.id,
        code: w.codigo,
        meta: `${w.pedidos?.length || 0} pedidos`,
        status: statusStr,
        statusBg, statusColor, statusDot,
        pct, barFill, pctColor: isConcluida ? '#10B981' : (pct === 0 ? t.textSub : '#8B5CF6'),
        stats: [
          { v: completedItems.toString(), k: 'Separados' },
          { v: (totalItems - completedItems).toString(), k: 'Pendentes' },
          { v: itensMin, k: 'Itens/min' }
        ],
        op: opName,
        opInit,
        opBg,
        cta: isConcluida ? 'Ver detalhes ->' : (isAguardando ? 'Iniciar separação ->' : 'Continuar separação ->'),
        iconEl, iconBg, iconColor,
        orders: w.pedidos?.map((p:any) => p.pedido_expedicao_id) || [],
        raw: w
      };
    });
  }, [initialWaves, orders]);

  const kpis = [
    { label: 'Ondas ativas', value: activeWaves.filter(w => w.status !== 'Concluída').length.toString(), iconEl: <Waves size={20} />, iconBg: '#3B82F622', iconColor: '#3B82F6' },
    { label: 'Pedidos em separação', value: activeWaves.filter(w => w.status === 'Em separação').reduce((sum, w) => sum + (w.raw?.pedidos?.length || 0), 0).toString(), iconEl: <ClipboardList size={20} />, iconBg: '#8B5CF622', iconColor: '#8B5CF6' },
    { label: 'Aguardando onda', value: orders.filter((o:any) => o.status === 'NOVO').length.toString(), iconEl: <Clock size={20} />, iconBg: '#F59E0B22', iconColor: '#F59E0B' },
    { label: 'Concluídas hoje', value: activeWaves.filter(w => w.status === 'Concluída').length.toString(), iconEl: <CheckCircle2 size={20} />, iconBg: '#10B98122', iconColor: '#10B981' }
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedOrderIds(eligibleOrders.map(o => o.id));
  }, [eligibleOrders]);

  const previewItems = eligibleOrders.filter(o => selectedOrderIds.includes(o.id)).reduce((sum, o) => sum + (o.totalUnits || 0), 0);

  
  const [isCreating, setIsCreating] = useState(false);
  const handleCreateWave = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsCreating(true);
    try {
      const waveId = await createShippingWaveAction(selectedOrderIds);
      window.location.reload();
    } catch (e) {
      console.error(e);
      setIsCreating(false);
    }
  };


  const handleOpenWave = async (wave: any) => {
    if (wave.orders.length === 0) return;
    setOpeningWave(wave.id);
    if (wave.raw.status === 'PENDENTE' && !wave.raw.iniciado_em) {
      await startShippingWaveAction(wave.id);
    }
    const ids = wave.orders.join(",");
    router.push(`/expedicao/separacao/lote?ids=${encodeURIComponent(ids)}&wave=${encodeURIComponent(wave.code)}`);
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isDeleteMode ? (
            <>
              <button onClick={() => { setIsDeleteMode(false); setSelectedForDelete([]); }} style={{ display: "flex", alignItems: "center", gap: "8px", height: "44px", padding: "0 20px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.textSub, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.textSub; }} onMouseLeave={(e) => { e.currentTarget.style.color = t.textSub; e.currentTarget.style.borderColor = t.border; }}>
                Cancelar
              </button>
              <button onClick={handleDeleteSelected} disabled={deletingWaves || selectedForDelete.length === 0} style={{ display: "flex", alignItems: "center", gap: "8px", height: "44px", padding: "0 20px", borderRadius: "11px", border: "none", background: "#EF4444", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: (deletingWaves || selectedForDelete.length === 0) ? "not-allowed" : "pointer", opacity: (deletingWaves || selectedForDelete.length === 0) ? 0.6 : 1, transition: "transform 0.2s" }} onMouseEnter={(e) => { if(!deletingWaves && selectedForDelete.length > 0) e.currentTarget.style.transform = "translateY(-1px)" }} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                <Trash2 size={18} /> {deletingWaves ? "Excluindo..." : `Excluir (${selectedForDelete.length})`}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsDeleteMode(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "44px", height: "44px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.cardBg, color: t.textSub, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = "#FCA5A5"; }} onMouseLeave={(e) => { e.currentTarget.style.color = t.textSub; e.currentTarget.style.borderColor = t.border; }}>
                <Trash2 size={18} />
              </button>
              <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: "8px", height: "44px", padding: "0 20px", borderRadius: "11px", border: "none", background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99,102,241,0.32)", transition: "transform 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                <Plus size={18} /> Nova onda
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-[18px]">
        {activeWaves.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", padding: "60px 20px", textAlign: "center", color: t.textSub, fontSize: "14px", fontWeight: "500", background: t.cardBg, borderRadius: "16px", border: `1px solid ${t.border}` }}>
            Nenhuma onda em execução no momento. Clique em "+ Nova onda" para começar.
          </div>
        ) : (
          activeWaves.map((w, i) => {
            const isSelected = selectedForDelete.includes(w.id);
            return (
              <a key={i} onClick={(e) => {
                if (isDeleteMode) {
                  e.preventDefault();
                  if (isSelected) {
                    setSelectedForDelete(prev => prev.filter(id => id !== w.id));
                  } else {
                    setSelectedForDelete(prev => [...prev, w.id]);
                  }
                } else {
                  handleOpenWave(w);
                }
              }} style={{ textDecoration: 'none', color: 'inherit', borderRadius: '18px', border: `1px solid ${isSelected ? '#EF4444' : t.border}`, background: isSelected ? 'rgba(239,68,68,0.04)' : t.cardBg, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease', display: 'block', opacity: openingWave === w.id ? 0.7 : 1, pointerEvents: openingWave === w.id ? 'none' : 'auto', position: 'relative' }} onMouseEnter={(e) => { if(!isDeleteMode) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 18px 40px rgba(15,23,42,0.18)'; e.currentTarget.style.borderColor = '#8B5CF6'; } }} onMouseLeave={(e) => { if(!isDeleteMode) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = t.border; } }}>
                {isDeleteMode && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', width: '24px', height: '24px', borderRadius: '6px', border: `2px solid ${isSelected ? '#EF4444' : t.border}`, background: isSelected ? '#EF4444' : t.inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', zIndex: 10 }}>
                    {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '40px', height: '40px', flexShrink: 0, borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: w.iconBg, color: w.iconColor }}>{w.iconEl}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '16px', fontWeight: 700 }}>{w.code}</span>
                      <span style={{ fontSize: '12px', color: t.textSub }}>{w.meta}</span>
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: w.statusBg, color: w.statusColor }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: w.statusDot }}></span>{w.status}
                  </span>
                </div>
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span style={{ color: t.textSub }}>Progresso da separação</span>
                      <span style={{ fontWeight: 700, color: w.pctColor }}>{w.pct}%</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '999px', background: t.barTrack, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${w.pct}%`, borderRadius: '999px', background: w.barFill, transformOrigin: 'left', transition: 'width 0.8s ease' }}></div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {w.stats.map((st, si) => (
                      <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px 12px', borderRadius: '11px', background: t.softBg }}>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '17px', fontWeight: 700 }}>{st.v}</span>
                        <span style={{ fontSize: '11px', color: t.textSub }}>{st.k}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '14px', borderTop: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: w.opBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 800 }}>{w.opInit}</div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: t.textSub }}>{w.op}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#8B5CF6' }}>{openingWave === w.id ? 'Iniciando...' : w.cta}</span>
                  </div>
                </div>
              </a>
            );
          })
        )}
      </div>


      {/* CREATE WAVE MODAL */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={() => setShowCreate(false)} style={{ position: "absolute", inset: 0, background: "rgba(6,10,20,0.6)", backdropFilter: "blur(4px)", animation: "overlayFade 0.25s ease" }}></div>
          <div style={{ position: "relative", width: "100%", maxWidth: "560px", background: t.cardBg, borderRadius: "20px", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", overflow: "hidden", display: "flex", flexDirection: "column", animation: "modalScale 0.3s cubic-bezier(.175,.885,.32,1.1)" }}>
            
            {/* Header */}
            <div style={{ padding: "24px 28px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "flex-start", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(139,92,246,0.12)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Waves size={22} strokeWidth={2.5} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, paddingTop: "2px" }}>
                <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700, color: t.text }}>Nova onda de separação</h2>
                <p style={{ margin: 0, fontSize: "14px", color: t.textSub }}>Selecione critérios para agrupar os pedidos.</p>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ width: "36px", height: "36px", borderRadius: "10px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.textSub, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.textSub; }} onMouseLeave={(e) => { e.currentTarget.style.color = t.textSub; e.currentTarget.style.borderColor = t.border; }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <FancySelectInput
                    label="Depositante"
                    name="depositante"
                    value={selectedDepositante}
                    onChange={setSelectedDepositante}
                    options={[
                      { value: "", label: "Todos" },
                      ...depositantes.map(d => ({ value: d.id, label: d.nome }))
                    ]}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.025em", color: t.textSub }}>Limite de pedidos</span>
                  <input 
                    type="number"
                    value={limit}
                    onChange={e => setLimit(Number(e.target.value))}
                    style={{ width: "100%", height: "52px", padding: "0 14px", borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box", boxShadow: "0 10px 35px rgba(15,23,42,0.04)" }} 
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", borderRadius: "12px", background: t.softBg, border: `1px dashed ${t.border}` }}>
                <span style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(139,92,246,0.16)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Box size={20} />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: t.text }}>{selectedOrderIds.length} pedidos selecionados</span>
                  <span style={{ fontSize: "12px", color: t.textSub }}>{previewItems} volumes estimados nesta onda</span>
                </div>
              </div>

              {eligibleOrders.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: t.text }}>Pedidos elegíveis</span>
                    <button 
                      onClick={() => {
                        if (selectedOrderIds.length === eligibleOrders.length) {
                          setSelectedOrderIds([]);
                        } else {
                          setSelectedOrderIds(eligibleOrders.map(o => o.id));
                        }
                      }}
                      style={{ fontSize: "12px", fontWeight: "600", color: "#3B82F6", background: "none", border: "none", cursor: "pointer" }}
                    >
                      {selectedOrderIds.length === eligibleOrders.length ? "Desmarcar todos" : "Marcar todos"}
                    </button>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", maxHeight: "200px", paddingRight: "4px" }}>
                    {eligibleOrders.map(order => {
                      const isSelected = selectedOrderIds.includes(order.id);
                      return (
                        <div 
                          key={order.id} 
                          onClick={() => {
                            if (isSelected) {
                              setSelectedOrderIds(prev => prev.filter(id => id !== order.id));
                            } else {
                              setSelectedOrderIds(prev => [...prev, order.id]);
                            }
                          }}
                          style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", border: `1px solid ${isSelected ? '#3B82F6' : t.border}`, background: isSelected ? hex2('#3B82F6', 0.05) : t.cardBg, cursor: "pointer", transition: "all 0.15s ease" }}
                        >
                          <div style={{ color: isSelected ? "#3B82F6" : t.textSub, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "2px" }}>
                            <span style={{ fontSize: "13.5px", fontWeight: "700", color: t.text }}>{order.displayNumber}</span>
                            <span style={{ fontSize: "12px", color: t.textSub }}>{order.depositante || 'Sem depositante'} · {order.totalUnits || 0} volumes</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "20px 28px", borderTop: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", background: t.softBg }}>
              <button 
                onClick={() => setShowCreate(false)}
                style={{ height: "44px", padding: "0 24px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.softBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = t.cardBg; }}
              >
                Cancelar
              </button>
              <button 
                disabled={selectedOrderIds.length === 0}
                onClick={handleCreateWave} 
                style={{ display: "flex", alignItems: "center", gap: "8px", height: "44px", padding: "0 24px", borderRadius: "12px", border: "none", background: selectedOrderIds.length === 0 ? t.border : "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: selectedOrderIds.length === 0 ? t.textSub : "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: selectedOrderIds.length === 0 ? "not-allowed" : "pointer", boxShadow: selectedOrderIds.length === 0 ? "none" : "0 8px 22px rgba(99,102,241,0.32)", transition: "all 0.2s ease" }}
                onMouseEnter={(e) => { if(selectedOrderIds.length > 0) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(99,102,241,0.4)"; } }}
                onMouseLeave={(e) => { if(selectedOrderIds.length > 0) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(99,102,241,0.32)"; } }}
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
