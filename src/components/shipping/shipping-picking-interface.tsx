
"use client";

import React, { useState, useEffect, useMemo, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Focus, Sparkles, MapPinned } from "lucide-react";
import { savePickingWaveProgressAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { ShippingPickingOrder } from "@/lib/shipping-picking";

type WavePickingItemState = ShippingPickingOrder["items"][number] & {
  compositeId: string;
  orderId: string;
  orderCode: string;
  orderExternalNumber: string;
  orderCustomer: string;
  orderDepositante: string;
  separatedQuantityValue: string;
  isSkipped?: boolean; // New state to track if skipped
};

type ShippingPickingInterfaceProps = {
  orders: ShippingPickingOrder[];
  currentUserId: string;
  currentUserName: string;
  returnTo: string;
  expireRedirectTo: string;
  completeRedirectTo: string;
};

// Extracted SVGs
const PinIcon = ({ size = 19 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z" />
    <circle cx={12} cy={10} r={2.4} />
  </svg>
);
const BoxIcon = ({ size = 19 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="M3 7l9 5 9-5" />
    <path d="M12 12v10" />
  </svg>
);
const ScanIconBig = ({ size = 19 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V5a1 1 0 0 1 1-1h2" />
    <path d="M17 4h2a1 1 0 0 1 1 1v2" />
    <path d="M20 17v2a1 1 0 0 1-1 1h-2" />
    <path d="M7 20H5a1 1 0 0 1-1-1v-2" />
    <path d="M4 12h16" />
  </svg>
);
const CheckIcon = ({ size = 19 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const DoneIcon = ({ size = 19 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12l2 2 4-4" />
    <circle cx={12} cy={12} r={9} />
  </svg>
);

export function ShippingPickingInterface({
  orders,
  currentUserId,
  currentUserName,
  returnTo,
  expireRedirectTo,
  completeRedirectTo,
}: ShippingPickingInterfaceProps) {
  const router = useRouter();
  
  // Theme logic
  const { theme: nextTheme, setTheme, resolvedTheme } = require("next-themes").useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isSystemDark = mounted && (nextTheme === "system" ? resolvedTheme : nextTheme) === "dark";
  const toggleTheme = () => setTheme(isSystemDark ? "light" : "dark");
  
  const dark = typeof isSystemDark !== "undefined" ? isSystemDark : true;
  const t = dark ? {
    appBg: '#0A1120', sideBg: '#0C1424', sideBg2: '#0B1322', barBg: '#0C1424', cardBg: '#101B30',
    inputBg: '#0E1728', softBg: 'rgba(148,163,184,0.05)', border: 'rgba(148,163,184,0.14)',
    navHover: 'rgba(148,163,184,0.08)', barTrack: 'rgba(148,163,184,0.16)',
    text: '#F1F5F9', textSub: '#8695AD', scanBorder: 'rgba(139,92,246,0.4)'
  } : {
    appBg: '#F5F7FB', sideBg: '#FFFFFF', sideBg2: '#FBFCFE', barBg: '#FFFFFF', cardBg: '#FFFFFF',
    inputBg: '#F8FAFC', softBg: 'rgba(100,116,139,0.05)', border: 'rgba(100,116,139,0.16)',
    navHover: 'rgba(100,116,139,0.07)', barTrack: 'rgba(100,116,139,0.14)',
    text: '#0F172A', textSub: '#64748B', scanBorder: 'rgba(139,92,246,0.4)'
  };
  
  const tog = dark ? {
    track: '#0E1729', border: 'rgba(96,165,250,0.30)', inset: 'rgba(0,0,0,0.5)',
    knob: '#0B1220', knobX: '0px', knobIcon: '☾', knobIconColor: '#3B82F6', trackMoon: 'transparent', trackSun: '#3B4763'
  } : {
    track: '#F4F5F8', border: 'rgba(100,116,139,0.18)', inset: 'rgba(0,0,0,0.06)',
    knob: '#FFFFFF', knobX: '36px', knobIcon: '☀', knobIconColor: '#F6A623', trackMoon: '#B4BCC9', trackSun: 'transparent'
  };

  const hex2 = (h: string, a: number) => { 
    const n = parseInt(h.slice(1), 16); 
    return 'rgba(' + (n>>16&255) + ',' + (n>>8&255) + ',' + (n&255) + ',' + a + ')'; 
  };
  const hex = { blue: hex2('#3B82F6', 0.14), violet: hex2('#8B5CF6', 0.16), green: hex2('#10B981', 0.16) };
  const cat = ['#3B82F6', '#10B981', '#EC4899', '#A855F7', '#F59E0B', '#06B6D4'];
  const thumb = (c: string) => 'linear-gradient(140deg,' + c + ' 0%,' + hex2(c, 0.6) + ' 100%)';

  // Items Logic
  const initialItems = useMemo(() => flattenWaveItems(orders), [orders]);
  const [items, setItems] = useState<WavePickingItemState[]>(initialItems);
  const prioritizedItems = useMemo(() => [...items].sort(compareWaveItemsForPicking), [items]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [scanValue, setScanValue] = useState("");
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, startResetTransition] = useTransition();

  const waveId = orders[0]?.id || "WAVE"; // display

  // Filter tasks from prioritizedItems
  const tasks = prioritizedItems.map((p, i) => {
    const isDone = i < currentIndex;
    const isCur = i === currentIndex;
    const qtyNum = normalizeQuantity(p.separatedQuantityValue);
    
    return {
      id: p.compositeId,
      loc: p.routeLines[0]?.addressCode || "SEM ENDERECO",
      name: p.name,
      qty: p.requestedQuantity + 'x',
      mark: isDone ? '✓' : (i + 1),
      border: isCur ? '#8B5CF6' : t.border,
      bg: isCur ? hex2('#8B5CF6', 0.10) : (isDone ? t.softBg : t.cardBg),
      numBg: isDone ? hex2('#10B981', 0.18) : (isCur ? 'linear-gradient(92deg,#3B82F6,#8B5CF6)' : t.softBg),
      numColor: isDone ? '#10B981' : (isCur ? '#fff' : t.textSub),
      titleColor: isDone ? t.textSub : t.text,
      qtyColor: isCur ? '#8B5CF6' : t.textSub,
      pick: () => { if (i <= currentIndex) setCurrentIndex(i); },
      isSkipped: p.isSkipped
    };
  });

  const totalCount = prioritizedItems.length;
  const doneCount = Math.min(currentIndex, totalCount);
  const progW = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) + '%' : '0%';

  const currentItem = prioritizedItems[currentIndex];
  const current = currentItem ? {
    active: true,
    done: false,
    idx: currentIndex + 1,
    loc: currentItem.routeLines[0]?.addressCode || "SEM ENDERECO",
    zone: currentItem.routeLines[0]?.routeLabel || "",
    name: currentItem.name,
    sku: currentItem.sku,
    ean: currentItem.barcode || currentItem.code,
    qty: currentItem.requestedQuantity + 'x',
    order: currentItem.orderExternalNumber,
    thumbBg: thumb(cat[currentIndex % cat.length]),
    separated: normalizeQuantity(currentItem.separatedQuantityValue),
    requested: currentItem.requestedQuantity
  } : {
    active: false,
    done: true,
  };

  const skip = () => {
    if (!currentItem) return;
    
    // Mark as skipped/rupture
    setItems((current) =>
      current.map((item) =>
        item.compositeId === currentItem.compositeId
          ? { ...item, isSkipped: true }
          : item
      )
    );
    
    setCurrentIndex(Math.min(currentIndex + 1, totalCount));
  };

  const confirmItem = () => {
    if (!currentItem) return;
    
    // Auto-fill full quantity and go to next
    setItems((current) =>
      current.map((item) =>
        item.compositeId === currentItem.compositeId
          ? { ...item, separatedQuantityValue: String(item.requestedQuantity) }
          : item
      )
    );
    
    setCurrentIndex(Math.min(currentIndex + 1, totalCount));
  };

  // Barcode scanning logic
  const handleScanSubmit = () => {
    if (!scanValue.trim()) return;
    if (!currentItem) return;
    
    const normalized = scanValue.replace(/\s+/g, "").trim().toUpperCase();
    
    // Check if it matches the current item
    const matches = [currentItem.barcode, currentItem.sku, currentItem.code]
      .map(s => s?.replace(/\s+/g, "").trim().toUpperCase())
      .includes(normalized);
      
    if (matches) {
      // Increment quantity
      const currentSeparated = normalizeQuantity(currentItem.separatedQuantityValue);
      const nextSeparated = Math.min(currentSeparated + 1, currentItem.requestedQuantity);
      
      setItems((prev) =>
        prev.map((item) =>
          item.compositeId === currentItem.compositeId
            ? { ...item, separatedQuantityValue: String(nextSeparated) }
            : item
        )
      );
      
      if (nextSeparated >= currentItem.requestedQuantity) {
        // Play beep and advance
        playFeedbackTone("success");
        setTimeout(() => setCurrentIndex(Math.min(currentIndex + 1, totalCount)), 300);
      } else {
        playFeedbackTone("success");
      }
    } else {
      playFeedbackTone("error");
      alert("Codigo invalido para este produto!");
    }
    
    setScanValue("");
    scanInputRef.current?.focus();
  };

  // Beep tone
  function playFeedbackTone(tone: "success" | "error") {
    if (typeof window === "undefined") return;
    const AudioContextRef = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextRef) return;
    const context = new AudioContextRef();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone === "success" ? "sine" : "square";
    oscillator.frequency.value = tone === "success" ? 880 : 220;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (tone === "success" ? 0.08 : 0.16));
    oscillator.onended = () => { void context.close(); };
  }

  // Refocus input
  useEffect(() => {
    if (current.active && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [currentIndex, current.active]);

  return (
    <div className="shipping-picking-ui flex flex-col" style={{ width: "100%", height: "100%", minHeight: "600px", color: t.text, transition: "color 0.35s ease", fontFamily: "'Manrope', sans-serif" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .shipping-picking-ui * { box-sizing: border-box; }
        .shipping-picking-ui a { color: #8B5CF6; text-decoration: none; }
        .shipping-picking-ui a:hover { color: #A78BFA; }
        .shipping-picking-ui input::placeholder { color: #94A3B8; opacity: 0.7; }
        .shipping-picking-ui ::-webkit-scrollbar { width: 10px; height: 10px; }
        .shipping-picking-ui ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.35); border-radius: 8px; }
        .shipping-picking-ui ::-webkit-scrollbar-track { background: transparent; }
        @keyframes popIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes pulseDot { 0%,100% { opacity: 0.4; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes scanBeam { 0% { transform: translateY(0); } 50% { transform: translateY(52px); } 100% { transform: translateY(0); } }
      `}} />
      
      <header style={{ flexShrink: 0, height: "68px", display: "flex", alignItems: "center", gap: "16px", padding: "0 28px", borderBottom: "none", background: "transparent" }}>
        <button onClick={() => router.push("/expedicao/separacao")} style={{ display: "flex", alignItems: "center", gap: "8px", height: "40px", padding: "0 14px", borderRadius: "10px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer", textDecoration: "none" }}>
          ‹ Voltar
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: t.textSub }}>
          <span>Expedição</span><span>›</span><span style={{ color: t.text, fontWeight: "600" }}>Separação</span>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: "flex", alignItems: "center", gap: "9px", height: "38px", padding: "0 14px", borderRadius: "10px", background: t.softBg, border: `1px solid ${t.border}` }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", animation: "pulseDot 1.8s ease-in-out infinite" }}></span>
          <span style={{ fontSize: "13px", fontWeight: "700" }}>Onda {waveId} ativa</span>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT: pick list */}
        <div style={{ width: "340px", flexShrink: 0, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", background: t.sideBg2 }}>
          <div style={{ padding: "20px 22px 16px 22px", borderBottom: `1px solid ${t.border}` }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "14px" }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: "700" }}>Lista de separação</span>
              <span style={{ fontSize: "12.5px", color: t.textSub }}>{doneCount}/{totalCount}</span>
            </div>
            <div style={{ height: "8px", borderRadius: "999px", background: t.barTrack, overflow: "hidden" }}>
              <div style={{ height: "100%", width: progW, borderRadius: "999px", background: "linear-gradient(90deg,#3B82F6,#8B5CF6)", transition: "width 0.4s ease" }}></div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {tasks.map(task => (
              <div key={task.id} onClick={task.pick} style={{ padding: "14px", borderRadius: "12px", cursor: "pointer", border: `1.5px solid ${task.border}`, background: task.bg, display: "flex", alignItems: "center", gap: "12px", transition: "all 0.16s ease" }}>
                <span style={{ width: "30px", height: "30px", flexShrink: 0, borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", background: task.numBg, color: task.numColor }}>{task.mark}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: "700", color: task.titleColor }}>{task.loc}</span>
                  <span style={{ fontSize: "12px", color: t.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {task.isSkipped ? <span style={{color: '#F59E0B'}}>(PULADO) </span> : null}{task.name}
                  </span>
                </div>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13.5px", fontWeight: "700", color: task.qtyColor }}>{task.qty}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: active pick */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {current.active && (
            <div style={{ width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "20px", animation: "popIn 0.3s ease" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", letterSpacing: "0.08em", color: t.textSub }}>SEPARANDO {current.idx} DE {totalCount}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", background: hex.blue, color: "#3B82F6" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#3B82F6" }}></span>Pedido {current.order}
                </span>
              </div>

              {/* location big */}
              <div style={{ position: "relative", borderRadius: "20px", padding: "28px", background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", color: "#fff", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 12px)" }}></div>
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "20px" }}>
                  <span style={{ width: "60px", height: "60px", flexShrink: 0, borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.18)" }}>
                    <PinIcon size={30} />
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", letterSpacing: "0.08em", opacity: 0.85 }}>ENDEREÇO DE COLETA</span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "38px", fontWeight: "700", lineHeight: "1" }}>{current.loc}</span>
                    <span style={{ fontSize: "13.5px", opacity: 0.9 }}>{current.zone}</span>
                  </div>
                </div>
              </div>

              {/* product */}
              <div style={{ borderRadius: "18px", border: `1px solid ${t.border}`, background: t.cardBg, padding: "22px", display: "flex", gap: "18px", alignItems: "center" }}>
                <div style={{ width: "72px", height: "72px", flexShrink: 0, borderRadius: "14px", background: current.thumbBg, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.92)" }}>
                  <BoxIcon size={34} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "17px", fontWeight: "700", lineHeight: "1.25" }}>{current.name}</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: t.textSub }}>{current.sku} · EAN {current.ean}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", paddingLeft: "18px", borderLeft: `1px solid ${t.border}` }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "34px", fontWeight: "700", color: "#8B5CF6" }}>{current.separated} / {current.requested}</span>
                  <span style={{ fontSize: "11.5px", color: t.textSub }}>coletados</span>
                </div>
              </div>

              {/* scan field */}
              <div style={{ borderRadius: "18px", border: `1.5px dashed ${t.scanBorder}`, background: t.softBg, padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ position: "relative", width: "48px", height: "48px", flexShrink: 0, borderRadius: "12px", background: hex.violet, color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <ScanIconBig size={24} />
                  <span style={{ position: "absolute", left: "8px", right: "8px", top: "6px", height: "2px", background: "#8B5CF6", opacity: 0.5, animation: "scanBeam 1.6s ease-in-out infinite" }}></span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
                  <span style={{ fontSize: "14px", fontWeight: "700" }}>Bipe o produto para confirmar</span>
                  <span style={{ fontSize: "12.5px", color: t.textSub }}>Leitura do código de barras ou digite o EAN</span>
                </div>
              </div>
              <input 
                ref={scanInputRef}
                value={scanValue}
                onChange={e => setScanValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); handleScanSubmit(); }
                }}
                placeholder="Aguardando leitura do coletor..." 
                style={{ height: "54px", padding: "0 18px", borderRadius: "12px", border: `1.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", outline: "none", boxSizing: "border-box" }} 
              />

              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={skip} style={{ flex: 1, height: "52px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
                  Pular / sem estoque
                </button>
                <button onClick={confirmItem} style={{ flex: 1.6, height: "52px", border: "none", borderRadius: "12px", background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "15px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99,102,241,0.32)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <CheckIcon size={18} /> Confirmar coleta
                </button>
              </div>
            </div>
          )}

          {current.done && (
            <div style={{ width: "100%", maxWidth: "480px", marginTop: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", textAlign: "center", animation: "popIn 0.3s ease" }}>
              <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: hex.green, color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DoneIcon size={48} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "26px", fontWeight: "700" }}>Separação concluída!</span>
                <span style={{ fontSize: "14.5px", color: t.textSub, lineHeight: "1.5" }}>
                  Todos os {totalCount} itens da onda foram processados. 
                  {items.some(i => i.isSkipped) && <span style={{display: 'block', marginTop: 8, color: '#F59E0B'}}>Aviso: Há itens pulados por divergência ou ruptura.</span>}
                </span>
              </div>
              <form action={savePickingWaveProgressAction} onSubmit={() => setIsSubmitting(true)} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                {orders.map((order) => (
                  <input key={order.id} type="hidden" name="waveOrderId" value={order.id} />
                ))}
                <input type="hidden" name="currentUserId" value={currentUserId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="completeRedirectTo" value={completeRedirectTo} />
                
                {items.map(item => (
                  <React.Fragment key={item.compositeId}>
                    <input type="hidden" name="itemOrderId" value={item.orderId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="separatedQuantity" value={item.isSkipped ? "0" : item.separatedQuantityValue} />
                  </React.Fragment>
                ))}
                
                <button type="submit" disabled={isSubmitting} style={{ height: "52px", padding: "0 28px", border: "none", borderRadius: "12px", background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "15px", fontWeight: "800", cursor: "pointer", boxShadow: "0 8px 22px rgba(99,102,241,0.32)", display: "flex", alignItems: "center", textDecoration: "none" }}>
                  {isSubmitting ? "Finalizando..." : "Ir para conferência →"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helpers
function flattenWaveItems(orders: ShippingPickingOrder[]) {
  return orders.flatMap((order) =>
    order.items.map((item) => ({
      ...item,
      compositeId: `${order.id}:${item.id}`,
      orderId: order.id,
      orderCode: order.code,
      orderExternalNumber: order.externalNumber,
      orderCustomer: order.customer,
      orderDepositante: order.depositante,
      separatedQuantityValue: String(item.separatedQuantity),
    })),
  );
}

function normalizeQuantity(value: string) {
  const numeric = Number(value.replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

function compareWaveItemsForPicking(a: WavePickingItemState, b: WavePickingItemState) {
  const firstRouteA = a.routeLines[0];
  const firstRouteB = b.routeLines[0];
  if (firstRouteA && firstRouteB) {
    const areaCompare = firstRouteA.area.localeCompare(firstRouteB.area, "pt-BR");
    if (areaCompare !== 0) return areaCompare;
    const labelCompare = firstRouteA.routeLabel.localeCompare(firstRouteB.routeLabel, "pt-BR", { numeric: true, sensitivity: "base" });
    if (labelCompare !== 0) return labelCompare;
  }
  return a.orderExternalNumber.localeCompare(b.orderExternalNumber, "pt-BR", { numeric: true, sensitivity: "base" });
}
