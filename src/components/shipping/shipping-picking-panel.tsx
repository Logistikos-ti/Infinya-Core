
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff } from "lucide-react";
import { savePickingProgressAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { PickingOperatorOption, ShippingPickingOrder } from "@/lib/shipping-picking";
import { useTheme } from "next-themes";

type ShippingPickingPanelProps = {
  order: ShippingPickingOrder;
  operators: PickingOperatorOption[];
  currentUserId: string;
  redirectBase?: string;
};

type PickingItemState = ShippingPickingOrder["items"][number] & {
  separatedQuantityValue: string;
};

type ScanFeedbackTone = "success" | "error";

export function ShippingPickingPanel({
  order,
  operators: _operators,
  currentUserId,
  redirectBase = "/expedicao/separacao",
}: ShippingPickingPanelProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const defaultOperatorId = order.assignedOperatorId ?? currentUserId;
  const [selectedOperatorId] = useState(defaultOperatorId);
  
  const [items, setItems] = useState<PickingItemState[]>(
    order.items.map((item) => ({
      ...item,
      separatedQuantityValue: String(item.separatedQuantity),
    })),
  );
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scanValue, setScanValue] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanTone, setScanTone] = useState<ScanFeedbackTone>("success");
  const [operatorMode, setOperatorMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  
  const {
    videoRef,
    cameraSupported,
    cameraEnabled,
    cameraStarting,
    cameraMessage,
    toggleCamera,
  } = useCameraBarcodeScanner({
    onDetected: (code) => {
      applyScannedCode(code);
      resetTimer();
    },
  });
  
  const { isWarningVisible, countdownSeconds, resetTimer } = useInactivityTimeout({
    disabled: isSubmitting,
    onExpire: () => {
      router.replace(`${redirectBase}?feedback=inatividade`);
    },
  });

  const totalCount = items.length;
  const isComplete = (item: PickingItemState) => {
    return Number(item.separatedQuantityValue) >= item.requestedQuantity;
  };
  const doneCount = items.filter(isComplete).length;
  const progW = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) + "%" : "0%";
  const isAllDone = doneCount === totalCount;

  // Auto focus logic
  useEffect(() => {
    if (!operatorMode || cameraEnabled) return;
    const focusTimer = window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(focusTimer);
  }, [cameraEnabled, operatorMode, currentIndex]);

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
  }

  function playFeedbackTone(tone: ScanFeedbackTone) {
    if (!soundEnabled || typeof window === "undefined") return;
    const AudioContextRef =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    oscillator.onended = () => {
      void context.close();
    };
  }

  function setFeedback(message: string, tone: ScanFeedbackTone) {
    setScanMessage(message);
    setScanTone(tone);
    playFeedbackTone(tone);
  }

  function matchesItemScan(item: PickingItemState, scan: string) {
    const s = scan.toLowerCase();
    if (item.barcode?.toLowerCase() === s) return true;
    if (item.sku.toLowerCase() === s) return true;
    if (item.code?.toLowerCase() === s) return true;
    if (item.isKit && item.kitComponents?.some((c) => c.barcode?.toLowerCase() === s || c.sku.toLowerCase() === s)) return true;
    return false;
  }

  function normalizeScanValue(v: string) {
    return v.trim();
  }

  function normalizeQuantity(v: string) {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function findMatchingKitComponent(item: PickingItemState, scan: string) {
    const s = scan.toLowerCase();
    return item.kitComponents?.find((c) => c.barcode?.toLowerCase() === s || c.sku.toLowerCase() === s);
  }

  function advanceToNextIncomplete(currentIndex: number) {
    // wait a bit so user can read success message
    setTimeout(() => {
      setItems((currentItems) => {
         const isDone = (item: PickingItemState) => Number(item.separatedQuantityValue) >= item.requestedQuantity;
         let next = currentItems.findIndex((i, idx) => idx > currentIndex && !isDone(i));
         if (next === -1) {
            next = currentItems.findIndex(i => !isDone(i));
         }
         if (next !== -1 && next !== currentIndex) {
            setCurrentIndex(next);
            setScanMessage(null); // clear message on advance
         }
         return currentItems;
      });
    }, 1200);
  }

  function applyScannedCode(rawValue: string) {
    const normalizedScan = normalizeScanValue(rawValue);
    if (!normalizedScan) {
      setFeedback("Informe ou leia um código para localizar o item.", "error");
      return false;
    }

    const matchedItem = items.find((item) => matchesItemScan(item, normalizedScan));
    if (!matchedItem) {
      setFeedback("Código não encontrado nesta separação.", "error");
      return false;
    }

    const matchedIndex = items.findIndex(i => i.id === matchedItem.id);
    if (matchedIndex !== currentIndex) {
       setCurrentIndex(matchedIndex);
    }

    if (matchedItem.isKit && matchedItem.kitComponents.length > 0) {
      const matchedComponent = findMatchingKitComponent(matchedItem, normalizedScan);
      if (!matchedComponent) {
        setFeedback(`O kit ${matchedItem.sku} foi localizado, mas o componente lido não está mapeado.`, "error");
        return false;
      }
      if (matchedComponent.separatedQuantity >= matchedComponent.requestedQuantity) {
        setFeedback(`O componente ${matchedComponent.sku} já atingiu ${matchedComponent.requestedQuantity}/${matchedComponent.requestedQuantity}.`, "error");
        return false;
      }

      const nextComponentQuantity = matchedComponent.separatedQuantity + 1;
      const nextTotalSeparated = matchedItem.kitComponents.reduce(
        (sum, component) =>
          sum +
          (component.componentProductId === matchedComponent.componentProductId
            ? component.separatedQuantity + 1
            : component.separatedQuantity),
        0,
      );

      setItems((current) =>
        current.map((item) =>
          item.id === matchedItem.id
            ? {
                ...item,
                kitComponents: item.kitComponents.map((component) =>
                  component.componentProductId === matchedComponent.componentProductId
                    ? {
                        ...component,
                        separatedQuantity: component.separatedQuantity + 1,
                        remainingQuantity: Math.max(
                          component.requestedQuantity - (component.separatedQuantity + 1),
                          0,
                        ),
                      }
                    : component,
                ),
                separatedQuantityValue: String(nextTotalSeparated),
              }
            : item,
        ),
      );

      setFeedback(`Kit ${matchedItem.sku}: componente ${matchedComponent.sku} ${nextComponentQuantity}/${matchedComponent.requestedQuantity}. Total do kit: ${nextTotalSeparated}/${matchedItem.requestedQuantity}.`, "success");
      
      if (nextTotalSeparated >= matchedItem.requestedQuantity) {
         advanceToNextIncomplete(matchedIndex);
      }
    } else {
      const currentSeparated = normalizeQuantity(matchedItem.separatedQuantityValue);
      if (currentSeparated >= matchedItem.requestedQuantity) {
        setFeedback(`O item ${matchedItem.sku} já está completo para separação.`, "error");
        return false;
      }

      const nextSeparated = Math.min(currentSeparated + 1, matchedItem.requestedQuantity);
      setItems((current) =>
        current.map((item) =>
          item.id === matchedItem.id
            ? {
                ...item,
                separatedQuantityValue: String(nextSeparated),
              }
            : item,
        ),
      );

      setFeedback(`Leitura aplicada em ${matchedItem.sku}. +1 separado. Total: ${nextSeparated}/${matchedItem.requestedQuantity}.`, "success");
      
      if (nextSeparated >= matchedItem.requestedQuantity) {
         advanceToNextIncomplete(matchedIndex);
      }
    }
    
    setScanValue("");
    resetTimer();

    requestAnimationFrame(() => {
      if (operatorMode && !cameraEnabled) {
        focusScanInput();
      }
    });

    return true;
  }

  function handleScanSubmit() {
    applyScannedCode(scanValue);
  }

  function handleSkip() {
     setScanMessage(null);
     let next = items.findIndex((i, idx) => idx > currentIndex && !isComplete(i));
     if (next === -1) next = items.findIndex(i => !isComplete(i));
     if (next !== -1 && next !== currentIndex) {
        setCurrentIndex(next);
     } else if (next === -1) {
        // all done?
     } else {
        setFeedback("Não há outros itens pendentes para pular.", "error");
     }
  }
  
  function handleConfirmManual() {
     const currentItem = items[currentIndex];
     if (!currentItem) return;
     if (isComplete(currentItem)) {
        advanceToNextIncomplete(currentIndex);
        return;
     }
     // just force complete it
     setItems(current => current.map((it, idx) => idx === currentIndex ? { ...it, separatedQuantityValue: String(it.requestedQuantity) } : it));
     setFeedback(`Coleta de ${currentItem.sku} confirmada manualmente.`, "success");
     advanceToNextIncomplete(currentIndex);
  }

  function serializeKitProgress(item: PickingItemState) {
    if (!item.isKit || !item.kitComponents.length) return "";
    return JSON.stringify(
      item.kitComponents.map((c) => ({
        componentProductId: c.componentProductId,
        separatedQuantity: c.separatedQuantity,
        remainingQuantity: c.remainingQuantity,
      })),
    );
  }

  // Styles maps
  const t = isDark ? {
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
  const hex2 = (h: string, a: number) => { const n = parseInt(h.slice(1), 16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };
  const hex = { blue: hex2('#3B82F6', 0.14), violet: hex2('#8B5CF6', 0.16), green: hex2('#10B981', 0.16) };
  const cat = ['#3B82F6', '#10B981', '#EC4899', '#A855F7', '#F59E0B', '#06B6D4'];
  const getThumb = (c: string) => `linear-gradient(140deg,${c} 0%,${hex2(c, 0.6)} 100%)`;

  const pinIcon = (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z"/>
      <circle cx="12" cy="10" r="2.4"/>
    </svg>
  );
  const boxIcon = (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5"/><path d="M12 12v10"/>
    </svg>
  );
  const scanIconBig = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V5a1 1 0 0 1 1-1h2"/><path d="M17 4h2a1 1 0 0 1 1 1v2"/><path d="M20 17v2a1 1 0 0 1-1 1h-2"/><path d="M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M4 12h16"/>
    </svg>
  );
  const checkIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
  const doneIcon = (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>
    </svg>
  );

  const currentItem = items[currentIndex];

  return (
    <div 
      className="flex h-[calc(100vh-200px)] min-h-[600px] overflow-hidden rounded-3xl border shadow-sm transition-colors duration-300" 
      style={{ background: t.appBg, color: t.text, borderColor: t.border }}
    >
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="Separação pausada por inatividade"
        description="O operador ficou sem interação nesta separação. Se a atividade não for retomada, o pedido será devolvido automaticamente para a fila."
        mobileDescription="Sem interação na separação. Retome agora ou o pedido volta para a fila."
      />

      {/* MAIN */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: pick list */}
          <div className="flex w-[340px] shrink-0 flex-col border-r" style={{ background: t.sideBg2, borderColor: t.border }}>
            <div className="border-b pb-4 pt-5 px-[22px]" style={{ borderColor: t.border }}>
              <div className="mb-[14px] flex items-baseline justify-between">
                <span className="font-['Space_Grotesk'] text-base font-bold">Lista de separação</span>
                <span className="text-[12.5px]" style={{ color: t.textSub }}>{doneCount}/{totalCount}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: t.barTrack }}>
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-400" style={{ width: progW }}></div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
              {items.map((item, i) => {
                const isItemDone = isComplete(item);
                const isCur = i === currentIndex;
                const qtyStr = `${item.separatedQuantityValue}/${item.requestedQuantity}`;
                
                return (
                  <div key={item.id} onClick={() => { if (!isAllDone) setCurrentIndex(i); }} className="flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] p-[14px] transition-all hover:border-violet-500" style={{
                    borderColor: isCur ? '#8B5CF6' : t.border,
                    background: isCur ? hex2('#8B5CF6', 0.10) : (isItemDone ? t.softBg : t.cardBg)
                  }}>
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-xs font-extrabold" style={{
                      background: isItemDone ? hex2('#10B981', 0.18) : (isCur ? 'linear-gradient(92deg,#3B82F6,#8B5CF6)' : t.softBg),
                      color: isItemDone ? '#10B981' : (isCur ? '#fff' : t.textSub)
                    }}>
                      {isItemDone ? '✓' : (i + 1)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                      <span className="font-['Space_Grotesk'] text-sm font-bold truncate" style={{ color: isItemDone ? t.textSub : t.text }}>
                        {item.routeLines?.[0]?.addressCode || "Sem endereço"}
                      </span>
                      <span className="truncate text-xs" style={{ color: t.textSub }}>{item.name}</span>
                    </div>
                    <span className="font-['Space_Grotesk'] text-[13.5px] font-bold" style={{ color: isCur ? '#8B5CF6' : t.textSub }}>
                      {qtyStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CENTER: active pick */}
          <div className="flex flex-1 min-w-0 flex-col items-center overflow-y-auto p-8 relative">
            
            {/* hidden form for submisson */}
            <form action={savePickingProgressAction} className="hidden" id="submitForm">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="operatorId" value={selectedOperatorId} />
              <input type="hidden" name="redirectBase" value={redirectBase} />
              <input type="hidden" name="completeRedirectTo" value={`/expedicao/conferencia/${order.id}`} />
              {items.map(item => (
                <div key={item.id}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="separatedQuantity" value={item.separatedQuantityValue} />
                  <input type="hidden" name="itemKitProgress" value={serializeKitProgress(item)} />
                </div>
              ))}
            </form>

            {isAllDone ? (
              <div className="mt-10 flex w-full max-w-[480px] animate-[popIn_0.3s_ease] flex-col items-center gap-5 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: hex.green, color: '#10B981' }}>{doneIcon}</div>
                <div className="flex flex-col gap-2">
                  <span className="font-['Space_Grotesk'] text-[26px] font-bold">Separação concluída!</span>
                  <span className="text-[14.5px] leading-relaxed" style={{ color: t.textSub }}>Todos os {totalCount} itens do pedido {order.displayNumber} foram coletados. Envie para conferência.</span>
                </div>
                <button 
                  onClick={() => { setIsSubmitting(true); (document.getElementById('submitForm') as HTMLFormElement).submit(); }}
                  disabled={isSubmitting}
                  className="flex h-[52px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-7 font-['Manrope'] text-[15px] font-extrabold text-white shadow-[0_8px_22px_rgba(99,102,241,0.32)] transition-transform hover:-translate-y-[1px] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Enviando..." : "Ir para conferência →"}
                </button>
              </div>
            ) : currentItem && (
              <div className="flex w-full max-w-[560px] animate-[popIn_0.3s_ease] flex-col gap-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold tracking-[0.08em] uppercase" style={{ color: t.textSub }}>Separando {currentIndex + 1} de {totalCount}</span>
                  <span className="inline-flex items-center gap-[7px] rounded-full px-3 py-[5px] text-[12.5px] font-bold" style={{ background: hex.blue, color: '#3B82F6' }}>
                    <span className="h-[7px] w-[7px] rounded-full bg-blue-500"></span>Pedido {order.displayNumber}
                  </span>
                </div>

                {/* location big */}
                <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-blue-500 to-violet-500 p-7 text-white">
                  <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 12px)' }}></div>
                  <div className="relative flex items-center gap-5">
                    <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-2xl bg-white/20">{pinIcon}</span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-bold tracking-[0.08em] opacity-85">ENDEREÇO DE COLETA</span>
                      <span className="font-['Space_Grotesk'] text-[38px] font-bold leading-none">{currentItem.routeLines?.[0]?.addressCode || "Nenhum local"}</span>
                      <span className="text-[13.5px] opacity-90">{currentItem.routeLines?.[0]?.area || "Sem área definida"}</span>
                    </div>
                  </div>
                </div>

                {/* product */}
                <div className="flex items-center gap-[18px] rounded-[18px] border p-[22px]" style={{ background: t.cardBg, borderColor: t.border }}>
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl text-white/90" style={{ background: getThumb(cat[currentIndex % cat.length]) }}>
                    {boxIcon}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className="text-[17px] font-bold leading-tight">{currentItem.name}</span>
                    <span className="font-['Space_Grotesk'] text-[13px]" style={{ color: t.textSub }}>{currentItem.sku} · EAN {currentItem.barcode || "-"}</span>
                  </div>
                  <div className="flex flex-col items-center gap-[2px] border-l pl-[18px]" style={{ borderColor: t.border }}>
                    <span className="font-['Space_Grotesk'] text-[34px] font-bold text-violet-500">{currentItem.requestedQuantity}</span>
                    <span className="text-[11.5px]" style={{ color: t.textSub }}>a coletar</span>
                  </div>
                </div>

                {/* scan field */}
                <div className="flex items-center gap-4 rounded-[18px] border-[1.5px] border-dashed p-5" style={{ background: t.softBg, borderColor: t.scanBorder }}>
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-violet-500" style={{ background: hex.violet }}>
                    {scanIconBig}
                    <span className="absolute left-2 right-2 top-1.5 h-[2px] animate-[scanBeam_1.6s_ease-in-out_infinite] bg-violet-500 opacity-50"></span>
                  </div>
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <span className="text-sm font-bold">Bipe o produto para confirmar</span>
                    <span className="text-[12.5px]" style={{ color: t.textSub }}>Leitura do código de barras ou digite o EAN</span>
                  </div>
                </div>
                
                {scanMessage && (
                   <div className={`rounded-xl p-3 text-sm font-medium border ${
                     scanTone === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                   }`}>
                     {scanMessage}
                   </div>
                )}
                
                {/* camera view if enabled */}
                {cameraEnabled && (
                  <div className="overflow-hidden rounded-xl border bg-black" style={{ borderColor: t.border }}>
                     <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
                  </div>
                )}

                <div className="relative">
                  <input 
                    ref={scanInputRef}
                    value={scanValue}
                    onChange={(e) => { resetTimer(); setScanValue(e.target.value); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanSubmit(); } }}
                    placeholder="Aguardando leitura do coletor..." 
                    className="h-[54px] w-full rounded-xl border-[1.5px] px-[18px] font-['Space_Grotesk'] text-base outline-none transition-shadow focus:border-violet-500 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.14)]" 
                    style={{ background: t.inputBg, borderColor: t.border, color: t.text }}
                  />
                  <button type="button" onClick={toggleCamera} className="absolute right-3 top-[11px] p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: cameraEnabled ? '#EF4444' : t.textSub }}>
                    {cameraEnabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleSkip} className="flex-1 rounded-xl border h-[52px] font-['Manrope'] text-[15px] font-bold transition-colors hover:border-amber-500 hover:text-amber-500" style={{ background: t.inputBg, borderColor: t.border, color: t.text }}>
                    Pular / sem estoque
                  </button>
                  <button onClick={handleConfirmManual} className="flex-[1.6] flex items-center justify-center gap-2 rounded-xl h-[52px] bg-gradient-to-r from-blue-500 to-violet-500 font-['Manrope'] text-[15px] font-extrabold text-white shadow-[0_8px_22px_rgba(99,102,241,0.32)] transition-transform hover:-translate-y-[1px]">
                    {checkIcon} Confirmar manual
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Global CSS to add the fonts and animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
        @keyframes popIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes scanBeam { 0% { transform: translateY(0); } 50% { transform: translateY(28px); } 100% { transform: translateY(0); } }
      `}} />
    </div>
  );
}
