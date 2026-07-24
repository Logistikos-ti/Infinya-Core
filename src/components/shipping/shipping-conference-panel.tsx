"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, RefreshCw, Smartphone, Loader2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { saveShippingConferenceAction, markShippingOrderAsDivergentAction } from "@/app/(dashboard)/expedicao/conferencia/actions";
import { ShippingConferenceDocumentsPanel } from "@/components/shipping/shipping-conference-documents-panel";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { PickingOperatorOption } from "@/lib/shipping-picking";
import type { ShippingConferenceOrder } from "@/lib/shipping-conference";
import type { ShippingAttachment } from "@/lib/shipping";

type ShippingConferencePanelProps = {
  order: ShippingConferenceOrder;
  operators: PickingOperatorOption[];
  currentUserId: string;
  currentUserName: string;
  feedback?: string;
  redirectBase?: string;
  documents: {
    orderId: string;
    depositanteId: string;
    attachments: ShippingAttachment[];
    isBlingOrder: boolean;
    isMercadoLivreOrder: boolean;
    hasTrackingCode: boolean;
    canUploadAttachments: boolean;
  };
};

type ConferenceItemState = ShippingConferenceOrder["items"][number] & {
  confirmedQuantityValue: string;
};

type ScanFeedbackTone = "success" | "error";

export function ShippingConferencePanel({
  order,
  operators: _operators,
  currentUserId,
  currentUserName,
  feedback,
  redirectBase = "/expedicao/conferencia",
  documents,
}: ShippingConferencePanelProps) {
  const router = useRouter();

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const t = isDark
    ? {
        appBg: "#0A1120",
        sideBg: "#0C1424",
        sideBg2: "transparent",
        barBg: "#0C1424",
        cardBg: "#101B30",
        inputBg: "#0E1728",
        softBg: "rgba(148,163,184,0.05)",
        border: "rgba(148,163,184,0.14)",
        navHover: "rgba(148,163,184,0.08)",
        barTrack: "rgba(148,163,184,0.16)",
        text: "#F1F5F9",
        textSub: "#8695AD",
      }
    : {
        appBg: "#F5F7FB",
        sideBg: "#FFFFFF",
        sideBg2: "transparent",
        barBg: "#FFFFFF",
        cardBg: "#FFFFFF",
        inputBg: "rgba(255, 255, 255, 0.6)",
        softBg: "rgba(100,116,139,0.05)",
        border: "rgba(100,116,139,0.16)",
        navHover: "rgba(100,116,139,0.07)",
        barTrack: "rgba(100,116,139,0.14)",
        text: "#0F172A",
        textSub: "#64748B",
      };

  const hex = {
    violet: isDark ? "rgba(139,92,246,0.16)" : "rgba(139,92,246,0.10)",
    green: isDark ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.10)",
  };

  const defaultOperatorId = order.assignedOperatorId ?? currentUserId;
  const operatorDisplayName = order.assignedOperatorName?.trim() || currentUserName;
  const [selectedOperatorId] = useState(defaultOperatorId);
  const [items, setItems] = useState<ConferenceItemState[]>(
    order.items.map((item) => ({
      ...item,
      confirmedQuantityValue: String(item.confirmedQuantity),
    })),
  );
  const [scanValue, setScanValue] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanTone, setScanTone] = useState<ScanFeedbackTone>("success");
  
  const operatorMode = true;
  const cameraEnabled = false;
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  useEffect(() => {
    const saved = localStorage.getItem("wms-sound-enabled");
    if (saved !== null) {
      setSoundEnabled(saved === "true");
    }
    const handleStorageChange = () => {
      const current = localStorage.getItem("wms-sound-enabled");
      if (current !== null) {
        setSoundEnabled(current === "true");
      }
    };
    window.addEventListener("sound-preference-changed", handleStorageChange);
    return () => window.removeEventListener("sound-preference-changed", handleStorageChange);
  }, []);

  const [wrongProductScans, setWrongProductScans] = useState(order.wrongProductScans);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const conferenceFormRef = useRef<HTMLFormElement | null>(null);

  const { isWarningVisible, countdownSeconds, resetTimer } = useInactivityTimeout({
    disabled: isSubmitting,
    onExpire: () => {
      router.replace(`${redirectBase}?feedback=inatividade`);
    },
  });

  const completionPercent = useMemo(() => {
    const requested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
    const confirmed = items.reduce((sum, item) => sum + normalizeQuantity(item.confirmedQuantityValue), 0);
    return requested > 0 ? Math.min(100, Math.round((confirmed / requested) * 100)) : 0;
  }, [items]);

  const pendingUnits = useMemo(
    () =>
      items.reduce((sum, item) => {
        const confirmed = normalizeQuantity(item.confirmedQuantityValue);
        return sum + Math.max(item.requestedQuantity - confirmed, 0);
      }, 0),
    [items],
  );

  const quantityDivergentItems = useMemo(
    () =>
      items.filter(
        (item) => normalizeQuantity(item.confirmedQuantityValue) !== item.requestedQuantity,
      ).length,
    [items],
  );

  useEffect(() => {
    const isFull = items.every((item) => normalizeQuantity(item.confirmedQuantityValue) >= item.requestedQuantity);
    if (!operatorMode || cameraEnabled || isFull) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(focusTimer);
  }, [cameraEnabled, operatorMode, items]);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    const submitTimeout = window.setTimeout(() => {
      setIsSubmitting(false);
    }, 15000);

    return () => window.clearTimeout(submitTimeout);
  }, [isSubmitting]);

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
  }

  function playFeedbackTone(tone: ScanFeedbackTone) {
    if (!soundEnabled || typeof window === "undefined") {
      return;
    }

    const AudioContextRef =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextRef) {
      return;
    }

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
    if (tone === "success") {
      setScanMessage(null);
    } else {
      setScanMessage(message);
    }
    setScanTone(tone);
    playFeedbackTone(tone);
  }

  function updateItemQuantity(itemId: string, value: string) {
    resetTimer();
    setItems((current) =>
      current.map((item) =>
        item.id === itemId && !item.isKit
          ? {
              ...item,
              confirmedQuantityValue: value,
            }
          : item,
      ),
    );
  }

  function applyScannedCode(rawValue: string) {
    const normalizedScan = normalizeScanValue(rawValue);

    if (!normalizedScan) {
      setFeedback("Informe ou leia um código para localizar o item.", "error");
      return false;
    }

    const matchedItem = items.find((item) => matchesItemScan(item, normalizedScan));

    if (!matchedItem) {
      setActiveItemId(null);
      setWrongProductScans((current) => current + 1);
      setFeedback("Código não encontrado neste pedido.", "error");
      return false;
    }

    if (matchedItem.isKit && matchedItem.kitComponents.length > 0) {
      const matchedComponent = findMatchingKitComponent(matchedItem, normalizedScan);

      if (!matchedComponent) {
        setActiveItemId(matchedItem.id);
        setWrongProductScans((current) => current + 1);
        setFeedback(`O kit ${matchedItem.sku} foi localizado, mas o componente lido não está mapeado.`, "error");
        return false;
      }

      if (matchedComponent.confirmedQuantity >= matchedComponent.requestedQuantity) {
        setActiveItemId(matchedItem.id);
        setFeedback(
          `O componente ${matchedComponent.sku} já foi totalmente conferido (${matchedComponent.requestedQuantity}/${matchedComponent.requestedQuantity}).`,
          "error",
        );
        return false;
      }

      const nextComponentQuantity = matchedComponent.confirmedQuantity + 1;
      const nextTotalConfirmed = matchedItem.kitComponents.reduce(
        (sum, component) =>
          sum +
          (component.componentProductId === matchedComponent.componentProductId
            ? component.confirmedQuantity + 1
            : component.confirmedQuantity),
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
                        confirmedQuantity: component.confirmedQuantity + 1,
                        pendingQuantity: Math.max(
                          component.requestedQuantity - (component.confirmedQuantity + 1),
                          0,
                        ),
                      }
                    : component,
                ),
                confirmedQuantityValue: String(nextTotalConfirmed),
              }
            : item,
        ),
      );

      setActiveItemId(matchedItem.id);
      setFeedback(
        `Kit ${matchedItem.sku}: componente ${matchedComponent.sku} ${nextComponentQuantity}/${matchedComponent.requestedQuantity}. Total conferido: ${nextTotalConfirmed}/${matchedItem.requestedQuantity}.`,
        "success",
      );
    } else {
      const currentConfirmed = normalizeQuantity(matchedItem.confirmedQuantityValue);
      if (currentConfirmed >= matchedItem.requestedQuantity) {
        setActiveItemId(matchedItem.id);
        setFeedback(`O item ${matchedItem.sku} já foi totalmente conferido.`, "error");
        return false;
      }

      const nextConfirmed = Math.min(currentConfirmed + 1, matchedItem.requestedQuantity);

      setItems((current) =>
        current.map((item) =>
          item.id === matchedItem.id
            ? {
                ...item,
                confirmedQuantityValue: String(nextConfirmed),
              }
            : item,
        ),
      );

      setActiveItemId(matchedItem.id);
      setFeedback(
        `Conferência aplicada em ${matchedItem.sku}. Total conferido: ${nextConfirmed}/${matchedItem.requestedQuantity}.`,
        "success",
      );
    }
    setScanValue("");
    resetTimer();

    requestAnimationFrame(() => {
      quantityInputRefs.current[matchedItem.id]?.focus();
      quantityInputRefs.current[matchedItem.id]?.select();

      if (operatorMode && !cameraEnabled) {
        focusScanInput();
      }
    });

    return true;
  }

  function handleScanSubmit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    applyScannedCode(scanValue);
  }

  const itemsTotal = items.reduce((a, i) => a + i.requestedQuantity, 0);
  const scanned = items.reduce((a, i) => a + normalizeQuantity(i.confirmedQuantityValue), 0);
  const full = pendingUnits <= 0;
  
  const circ = 2 * Math.PI * 40;
  const pctNum = itemsTotal > 0 ? Math.round((scanned / itemsTotal) * 100) : 0;
  const ringOffset = itemsTotal > 0 ? circ * (1 - scanned / itemsTotal) : circ;
  const ringC1 = full ? "#10B981" : "#3B82F6";
  const ringC2 = full ? "#34D399" : "#8B5CF6";

  const finishBg = full ? "linear-gradient(92deg,#10B981,#34D399)" : t.softBg;
  const finishColor = full ? "#fff" : t.textSub;
  const finishCursor = full ? "pointer" : "not-allowed";
  const finishShadow = full ? "0 8px 22px rgba(16,185,129,0.32)" : "none";
  const finishLabel = full ? "Preparar para romaneio" : "Bipe todos os itens";

  // Cat colors for thumbs
  const cat = ['#3B82F6', '#10B981', '#EC4899', '#A855F7', '#F59E0B', '#06B6D4'];
  const hex2 = (h, a) => { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n>>16&255) + ',' + (n>>8&255) + ',' + (n&255) + ',' + a + ')'; };
  const thumb = (c) => 'linear-gradient(140deg,' + c + ' 0%,' + hex2(c, 0.6) + ' 100%)';
  
  // Carrier colors (fallback if carrier not listed)
  const carriers: Record<string, string> = { 'Mercado Livre': '#2D3277', 'Shopee': '#EE4D2D', 'Amazon': '#FF9900', 'Magalu': '#0086FF' };
  const marketplaceName = order.marketplace || order.destination || "Site Próprio";
  const cc = carriers[marketplaceName] || "#64748B";
  const activeCarrier = { bg: hex2(cc, 0.15), color: cc, text: marketplaceName };

  const P = (d: string, i: number) => <path d={d} key={'p' + i} />;
  const C = (cx: number, cy: number, r: number, i: number) => <circle cx={cx} cy={cy} r={r} key={'c' + i} />;
  const mk = (children: React.ReactNode, size?: number) => <svg width={size || 19} height={size || 19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
  
  const scanIcon = mk([P('M4 7V5a1 1 0 0 1 1-1h2',1), P('M17 4h2a1 1 0 0 1 1 1v2',2), P('M20 17v2a1 1 0 0 1-1 1h-2',3), P('M7 20H5a1 1 0 0 1-1-1v-2',4), P('M4 12h16',5)], 26);
  const boxIcon = mk([P('M12 2 3 7v10l9 5 9-5V7z',1), P('M3 7l9 5 9-5',2), P('M12 12v10',3)], 20);
  const checkIcon = mk([P('M20 6 9 17l-5-5',1)], 18);

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "28px 32px", background: t.sideBg2, animation: "panelFadeIn 0.25s ease-out" }}>
      <div style={{ maxWidth: 840, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
        
        <InactivityWarningDialog
          isVisible={isWarningVisible}
          countdownSeconds={countdownSeconds}
          title="Conferência pausada por inatividade"
          description="O operador ficou sem interação nesta conferência. Se a atividade não for retomada, o pedido será devolvido automaticamente para a fila."
          mobileDescription="Sem interação na conferência. Retome agora ou o pedido volta para a fila."
        />

        {feedback ? (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "24px",
              fontSize: "14px",
              fontWeight: 700,
              border: feedback === "concluido" ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(245,158,11,0.3)",
              background: feedback === "concluido" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
              color: feedback === "concluido" ? (isDark ? "#34D399" : "#047857") : (isDark ? "#FBBF24" : "#B45309")
            }}
          >
            {feedback === "concluido"
              ? "Conferência concluída. Revise os documentos e escolha se o pedido vai para romaneio ou se será liberado sem romaneio."
              : feedback === "liberado-romaneio"
                ? "Pedido liberado para romaneio com sucesso."
                : feedback === "liberado-sem-romaneio"
                  ? "Pedido liberado sem romaneio com sucesso."
                : feedback === "romaneio-obrigatorio"
                    ? "Todos os pedidos devem ser liberados obrigatoriamente para romaneio."
                  : feedback === "danfe-pendente"
                    ? "Bipe a DANFE simplificada correta antes de liberar o pedido para romaneio."
                  : feedback === "etiqueta-confirmacao"
                    ? "Confirme a liberação sem etiqueta de envio para continuar."
                  : feedback === "salvo"
                    ? "Conferência atualizada com sucesso."
              : feedback === "incompleto"
                ? "Ainda existem itens pendentes. O pedido permanece na fila para nova conferência."
                : feedback === "documentos-pendentes"
                  ? "Finalize os documentos obrigatórios (XML da NF e etiqueta de envio) para liberar o pedido ao romaneio."
                : feedback === "inatividade"
                  ? "Sessão expirada por inatividade. O pedido foi devolvido para a fila e a operação cancelada."
                  : "Não foi possível concluir a operação solicitada."}
          </div>
        ) : null}

        {/* Divergence alerts removed per user request */}

        <form
          id="shipping-conference-form"
          ref={conferenceFormRef}
          action={saveShippingConferenceAction}
          style={{ display: "flex", flexDirection: "column", gap: 22 }}
          onSubmit={() => {
            resetTimer();
            setIsSubmitting(true);
          }}
        >
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="operatorId" value={selectedOperatorId} />
          <input type="hidden" name="wrongProductScans" value={String(wrongProductScans)} />
          <input type="hidden" name="redirectBase" value={redirectBase} />
          <input type="hidden" name="completeRedirectTo" value={`/expedicao/conferencia/${order.id}?feedback=concluido#documentos-impressao`} />

          {/* Header of order */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
              <svg width={96} height={96} viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="48" cy="48" r="40" fill="none" stroke={t.barTrack} strokeWidth="10" />
                <circle 
                  cx="48" cy="48" r="40" fill="none" stroke="url(#cg)" strokeWidth="10" strokeLinecap="round" 
                  strokeDasharray={circ.toFixed(1)} 
                  strokeDashoffset={ringOffset.toFixed(1)} 
                  style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(.3,1,.4,1)" }} 
                />
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={ringC1} />
                    <stop offset="1" stopColor={ringC2} />
                  </linearGradient>
                </defs>
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: t.text }}>{pctNum}%</span>
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: t.text }}>{order.displayNumber}</span>
              <span style={{ fontSize: 13.5, color: t.textSub }}>{order.customer} · {order.depositante}</span>
              <span style={{ fontSize: 13, color: t.textSub }}>{scanned} de {itemsTotal} volumes conferidos</span>
            </div>
            
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, background: activeCarrier.bg, color: activeCarrier.color }}>
              {activeCarrier.text}
            </span>
          </div>

          {/* Scan field */}
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ position: "relative", width: 54, height: 54, flexShrink: 0, borderRadius: 13, background: hex.violet, color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {scanIcon}
              <span style={{ position: "absolute", left: 8, right: 8, top: 8, height: 2, background: "#8B5CF6", opacity: 0.5, animation: "scanBeam 1.6s ease-in-out infinite" }} />
            </div>
            
            <input 
              ref={scanInputRef}
              value={scanValue}
              onChange={(e) => {
                resetTimer();
                setScanValue(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScanSubmit();
                }
              }}
              onBlur={() => {
                const isFull = items.every((item) => normalizeQuantity(item.confirmedQuantityValue) >= item.requestedQuantity);
                if (operatorMode && !cameraEnabled && !isFull) {
                  window.setTimeout(() => scanInputRef.current?.focus(), 40);
                }
              }}
              placeholder="Bipe o código do volume / produto..." 
              style={{ flex: 1, height: 54, padding: "0 18px", borderRadius: 12, border: `1.5px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, outline: "none", boxSizing: "border-box" }} 
            />
            
            <button 
              type="button" 
              onClick={() => handleScanSubmit()}
              className="btn-bipar"
              style={{ height: 54, padding: "0 22px", border: "none", borderRadius: 12, background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 22px rgba(99,102,241,0.32)" }}
            >
              Bipar
            </button>
          </div>

          {scanMessage ? (
            <div style={{ borderRadius: 12, border: scanTone === "success" ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(244,63,94,0.3)", background: scanTone === "success" ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)", color: scanTone === "success" ? (isDark ? "#34D399" : "#047857") : (isDark ? "#FB7185" : "#BE123C"), padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>
              {scanMessage}
            </div>
          ) : null}

          {/* Items list */}
          <div style={{ borderRadius: 16, border: `1px solid ${t.border}`, background: t.cardBg, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>Itens do pedido</span>
              <span style={{ fontSize: 12.5, color: t.textSub }}>sequência de conferência</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {items.map((item, i) => {
                const doneUnits = normalizeQuantity(item.confirmedQuantityValue);
                const itemFull = doneUnits >= item.requestedQuantity;
                
                const mark = itemFull ? '✓' : (doneUnits > 0 ? '·' : '');
                const checkBorder = itemFull ? '#10B981' : t.border;
                const checkBg = itemFull ? '#10B981' : 'transparent';
                const checkColor = itemFull ? '#fff' : t.textSub;
                const rowBg = itemFull ? hex2('#10B981', 0.05) : 'transparent';
                const nameColor = itemFull ? t.text : t.text;
                const thumbBg = thumb(cat[i % cat.length]);
                const qtyColor = itemFull ? '#10B981' : t.textSub;

                return (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: `1px solid ${t.border}`, background: rowBg, animation: itemFull ? "rowIn 0.3s ease" : "none" }}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="itemKitProgress" value={serializeKitProgress(item)} />
                    
                    <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, border: `1.5px solid ${checkBorder}`, background: checkBg, color: checkColor, fontWeight: 700 }}>{mark}</span>
                    <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 10, background: thumbBg, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.92)", overflow: "hidden" }}>
                      {/* @ts-ignore */}
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : boxIcon}
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: nameColor }}>{item.name}</span>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: t.textSub }}>{item.sku}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontFamily: "'Space Grotesk', sans-serif", fontSize: "15px" }}>
                      <span style={{ fontWeight: 800, color: qtyColor }}>{item.confirmedQuantityValue}</span>
                      <span style={{ fontWeight: 700, color: itemFull ? qtyColor : t.textSub, opacity: itemFull ? 1 : 0.8 }}>/ {item.requestedQuantity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </form>

        {full && (
          <ShippingConferenceDocumentsPanel
            orderId={documents.orderId}
            depositanteId={documents.depositanteId}
            attachments={documents.attachments}
            canUploadAttachments={documents.canUploadAttachments}
            unlocked={full}
            formId="shipping-conference-form"
          />
        )}

        {/* Action bar */}
        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" form="shipping-conference-form" formAction={markShippingOrderAsDivergentAction} className="btn-divergence" style={{ flex: 1, height: 52, borderRadius: 12, border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            ⚠ Reportar divergência
          </button>
          <button 
            type="submit"
            form="shipping-conference-form"
            disabled={!full || isSubmitting} 
            style={{ flex: 1.6, height: 52, border: "none", borderRadius: 12, background: finishBg, color: finishColor, fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 800, cursor: finishCursor, boxShadow: finishShadow, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s ease" }}
          >
            {full ? <FileText size={18} /> : checkIcon} {isSubmitting ? "Finalizando..." : finishLabel}
          </button>
        </div>

      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanBeam { 0% { transform: translateY(0); } 50% { transform: translateY(52px); } 100% { transform: translateY(0); } }
        @keyframes rowIn { from { transform: translateX(-8px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes panelFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes docExpand { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .btn-bipar { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .btn-bipar:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(99,102,241,0.45) !important; filter: brightness(1.05); }
        .btn-bipar:active { transform: translateY(0); box-shadow: 0 4px 12px rgba(99,102,241,0.3) !important; }
        .btn-divergence { transition: all 0.2s ease; }
        .btn-divergence:hover { background: rgba(239,68,68,0.1) !important; border-color: rgba(239,68,68,0.4) !important; color: #EF4444 !important; }
      `}} />
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">{label}</p>
      <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeScanValue(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

function normalizeQuantity(value: string) {
  const numeric = Number(value.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, numeric);
}

function matchesItemScan(item: ConferenceItemState, normalizedScan: string) {
  return item.scanTargets
    .filter(Boolean)
    .some((value) => normalizeScanValue(value) === normalizedScan);
}

function findMatchingKitComponent(item: ConferenceItemState, normalizedScan: string) {
  return item.kitComponents.find((component) =>
    [component.barcode, component.sku]
      .filter(Boolean)
      .some((value) => normalizeScanValue(value) === normalizedScan),
  );
}

function serializeKitProgress(item: ConferenceItemState) {
  if (!item.isKit || item.kitComponents.length === 0) {
    return "";
  }

  return JSON.stringify(
    item.kitComponents.map((component) => ({
      componentProductId: component.componentProductId,
      quantityPerKit: component.quantityPerKit,
      separatedQuantity: component.confirmedQuantity,
      sku: component.sku,
      name: component.name,
      barcode: component.barcode,
    })),
  );
}

