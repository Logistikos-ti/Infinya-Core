
"use client";

import React, { useState, useEffect, useMemo, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { PackageCheck, Focus, Sparkles, MapPinned } from "lucide-react";
import {
  cancelPickingOrderAction,
  registerPickingScanAction,
  savePickingWaveDraftAction,
  savePickingWaveProgressAction,
} from "@/app/(dashboard)/expedicao/separacao/actions";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import { resolveScannedPickingQuantity } from "@/lib/shipping-picking-scan";
import {
  buildPickGroupUnits,
  distributeScannedQuantityAcrossGroup,
  resolveMemberRemainingAtStop,
  type PickGroupSourceItem,
} from "@/lib/shipping-picking-groups";
import type { ShippingPickingOrder } from "@/lib/shipping-picking";

type WavePickingItemState = ShippingPickingOrder["items"][number] & {
  compositeId: string;
  orderId: string;
  orderCode: string;
  orderExternalNumber: string;
  orderCustomer: string;
  orderDepositante: string;
  separatedQuantityValue: string;
  routeLineIndex: number;
  routeLineCollected: number;
  isSkipped?: boolean; // New state to track if skipped
  isCancelled?: boolean;
};

// A "picking unit" is what the operator actually works through, one at a
// time: either a single order-item (the historical behaviour) or, when two
// or more orders in the same wave need the same product from the exact same
// stock bin, a single combined step covering all of them at once -- bipe o
// endereço uma vez, bipe o produto até completar o total, em vez de repetir
// os dois bipes uma vez por pedido. See src/lib/shipping-picking-groups.ts.
type PickingUnitView = {
  key: string;
  members: WavePickingItemState[]; // sorted oldest order first (FIFO)
  primary: WavePickingItemState; // oldest member -- used for name/sku/image/address/cancel target
  requestedTotal: number;
  separatedTotal: number;
  orderCount: number;
  isDone: boolean;
};

type ShippingPickingInterfaceProps = {
  orders: ShippingPickingOrder[];
  currentUserId: string;
  currentUserName: string;
  waveCode: string;
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
  waveCode,
  returnTo,
  expireRedirectTo,
  completeRedirectTo,
}: ShippingPickingInterfaceProps) {
  const router = useRouter();

  // Keep the wave view on the same theme preference as the global app shell.
  const { resolvedTheme, setTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  const dark = theme === 'dark';
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
  // Older orders get filled first when a product is grouped across several
  // orders in the wave (see PickingUnitView) -- createdAtIso sorts
  // correctly as a plain string; orders without one fall back to the very
  // end of the queue instead of jumping ahead unpredictably.
  const orderSequenceKeyByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((order) => {
      map.set(order.id, order.createdAtIso ?? `9999-12-31T23:59:59.999Z#${order.externalNumber}`);
    });
    return map;
  }, [orders]);

  const [items, setItems] = useState<WavePickingItemState[]>(initialItems);
  const unitViews = useMemo(
    () => buildPickingUnitViews(items, orderSequenceKeyByOrderId),
    [items, orderSequenceKeyByOrderId],
  );

  const [currentIndex, setCurrentIndex] = useState(() =>
    findNextPendingUnitIndex(buildPickingUnitViews(initialItems, orderSequenceKeyByOrderId)),
  );
  const [scanValue, setScanValue] = useState("");
  const [scanPhase, setScanPhase] = useState<"address" | "product">("address");
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const completionFormRef = useRef<HTMLFormElement | null>(null);
  const autoSubmittedRef = useRef(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isResetting, startResetTransition] = useTransition();
  const [cancelledOrderIds, setCancelledOrderIds] = useState<string[]>([]);
  const draftHydratedRef = useRef(false);
  const draftSaveQueueRef = useRef<Promise<{ ok: boolean; message?: string }>>(Promise.resolve({ ok: true }));
  const productScanBusyRef = useRef(false);

  const persistDraft = useCallback(
    (nextItems: WavePickingItemState[] = items) => {
      const payload = nextItems.map((item) => ({
        orderId: item.orderId,
        itemId: item.id,
        separatedQuantity: item.isSkipped ? 0 : normalizeQuantity(item.separatedQuantityValue),
      }));

      const save = draftSaveQueueRef.current.then(async () => {
        setIsSavingDraft(true);
        try {
          return await savePickingWaveDraftAction(payload);
        } finally {
          setIsSavingDraft(false);
        }
      });

      draftSaveQueueRef.current = save.catch((error) => ({
        ok: false,
        message: error instanceof Error ? error.message : "Falha ao salvar o progresso da onda.",
      }));
      return save;
    },
    [items],
  );

  useEffect(() => {
    if (!draftHydratedRef.current) {
      draftHydratedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      void persistDraft(items);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [items, persistDraft]);

  // Filter tasks from unitViews
  const tasks = unitViews.map((view, i) => {
    const isDone = view.isDone;
    const isCur = i === currentIndex;
    const primaryRoute = getActiveRouteLine(view.primary);
    const groupedLabel = view.orderCount > 1 ? ` · ${view.orderCount} pedidos` : "";

    return {
      id: view.key,
      loc: primaryRoute?.addressCode || "SEM ENDERECO",
      name: view.primary.name + groupedLabel,
      qty: view.requestedTotal + 'x',
      mark: isDone ? '✓' : (i + 1),
      border: view.primary.isCancelled ? '#FCA5A5' : (isCur ? '#8B5CF6' : t.border),
      bg: view.primary.isCancelled ? 'rgba(239,68,68,0.07)' : (isCur ? hex2('#8B5CF6', 0.10) : (isDone ? t.softBg : t.cardBg)),
      numBg: view.primary.isCancelled ? 'rgba(239,68,68,0.14)' : (isDone ? hex2('#10B981', 0.18) : (isCur ? 'linear-gradient(92deg,#3B82F6,#8B5CF6)' : t.softBg)),
      numColor: view.primary.isCancelled ? '#DC2626' : (isDone ? '#10B981' : (isCur ? '#fff' : t.textSub)),
      titleColor: view.primary.isCancelled ? '#B91C1C' : (isDone ? t.textSub : t.text),
      qtyColor: isCur ? '#8B5CF6' : t.textSub,
      detailsVisible: !(isCur && scanPhase === "address"),
      pick: () => { if (i <= currentIndex) setCurrentIndex(i); },
      isSkipped: view.primary.isSkipped,
      isCancelled: view.primary.isCancelled,
    };
  });

  const totalCount = unitViews.length;
  const doneCount = unitViews.filter((view) => view.isDone).length;
  const progW = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) + '%' : '0%';

  useEffect(() => {
    if (currentIndex >= unitViews.length) {
      return;
    }

    const nextPendingIndex = findNextPendingUnitIndex(unitViews, currentIndex);
    if (nextPendingIndex !== currentIndex) {
      setCurrentIndex(nextPendingIndex);
      setScanPhase("address");
    }
  }, [currentIndex, unitViews]);

  const currentUnit = unitViews[currentIndex];
  const current = currentUnit ? {
    active: true,
    done: false,
    idx: currentIndex + 1,
    loc: getActiveRouteLine(currentUnit.primary)?.addressCode || "SEM ENDERECO",
    zone: getActiveRouteLine(currentUnit.primary)?.routeLabel || "",
    name: currentUnit.primary.name,
    sku: currentUnit.primary.sku,
    ean: currentUnit.primary.barcode || currentUnit.primary.code,
    qty: currentUnit.requestedTotal + 'x',
    order: currentUnit.orderCount > 1 ? `${currentUnit.orderCount} pedidos` : currentUnit.primary.orderCode,
    imageUrl: currentUnit.primary.imageUrl,
    thumbBg: thumb(cat[currentIndex % cat.length]),
    separated: currentUnit.separatedTotal,
    requested: currentUnit.requestedTotal,
    orderCount: currentUnit.orderCount,
  } : {
    active: false,
    done: true,
    orderCount: 0,
  };

  const cancelOrder = () => {
    if (!currentUnit) return;
    // With a grouped step (same product, several orders, same bin), "sem
    // estoque" only pulls the oldest order in the group out of the wave --
    // the remaining orders keep being worked on at this same stop.
    const orderId = currentUnit.primary.orderId;
    setCancelledOrderIds((current) => current.includes(orderId) ? current : [...current, orderId]);
    setItems((current) =>
      current.map((item) =>
        item.orderId === orderId
          ? { ...item, isSkipped: true, isCancelled: true, separatedQuantityValue: "0" }
          : item
      )
    );

    void cancelPickingOrderAction(orderId).then((result) => {
      if (!result?.ok) alert("Não foi possível cancelar o pedido por falta de estoque.");
    });

    setScanPhase("address");
  };

  async function leaveWave() {
    if (isSubmitting || isResetting) {
      return;
    }

    setIsSubmitting(true);
    const result = await persistDraft(items);
    if (!result.ok) {
      setIsSubmitting(false);
      setScanMessage(result.message ?? "Nao foi possivel salvar o progresso da onda.");
      return;
    }

    router.push(returnTo);
  }

  // Barcode scanning logic
  const handleScanSubmit = async () => {
    if (!scanValue.trim()) return;
    if (!currentUnit) return;

    const normalized = scanValue.replace(/\s+/g, "").trim().toUpperCase();

    const activeRouteLine = getActiveRouteLine(currentUnit.primary);
    const expectedAddress = activeRouteLine?.addressCode?.replace(/\s+/g, "").trim().toUpperCase() ?? "";

    if (scanPhase === "address") {
      if (!expectedAddress || normalized !== expectedAddress) {
        playFeedbackTone("error");
        alert("Endereco incorreto. Bipe o endereco sugerido na tela.");
        setScanValue("");
        scanInputRef.current?.focus();
        return;
      }

      playFeedbackTone("success");
      setScanPhase("product");
      setScanValue("");
      scanInputRef.current?.focus();
      return;
    }

    if (productScanBusyRef.current) return;
    productScanBusyRef.current = true;

    // Check the unit, pack, SKU and internal codes accepted by any member of
    // this step (they're all the same product, but scan targets are read
    // from each order-item's own row so we union them just in case).
    const acceptedTargets = new Set(
      currentUnit.members
        .flatMap((member) => [member.barcode, member.packBarcode, member.sku, member.code, ...member.scanTargets])
        .filter(Boolean)
        .map((value) => value!.replace(/\s+/g, "").trim().toUpperCase()),
    );
    const matches = acceptedTargets.has(normalized);
    // A pack/caixa barcode (e.g. Dêvi's SKUs with a separate código for the
    // sealed pack) adds packQuantity units per scan instead of 1 -- see
    // resolveScannedPickingQuantity in src/lib/shipping-picking-scan.ts.
    const isPackMatch =
      Boolean(currentUnit.primary.packBarcode) &&
      currentUnit.primary.packBarcode.replace(/\s+/g, "").trim().toUpperCase() === normalized;

    if (!matches) {
      productScanBusyRef.current = false;
      playFeedbackTone("error");
      alert("Codigo invalido para este produto!");
      setScanValue("");
      scanInputRef.current?.focus();
      return;
    }

    const stockId = activeRouteLine?.stockId;
    if (!stockId) {
      productScanBusyRef.current = false;
      playFeedbackTone("error");
      alert("Não foi possível localizar o saldo deste endereço para reservar o estoque.");
      return;
    }

    const scannedQuantity = resolveScannedPickingQuantity({
      isPackMatch,
      packQuantity: currentUnit.primary.packQuantity,
    });

    // How much each member of this step can still absorb from THIS stock
    // bin (not the item's grand total -- an item may still have other,
    // separate stops queued up after this one). See
    // resolveMemberRemainingAtStop for why this isn't derived from
    // routeLineCollected.
    const candidates = currentUnit.members
      .map((member) => {
        const memberActiveLine = getActiveRouteLine(member);
        const remainingAtStop = memberActiveLine
          ? resolveMemberRemainingAtStop({
              stopQuantity: memberActiveLine.quantity,
              requestedQuantity: member.requestedQuantity,
              separatedQuantity: normalizeQuantity(member.separatedQuantityValue),
            })
          : 0;
        return {
          compositeId: member.compositeId,
          orderSequenceKey: orderSequenceKeyByOrderId.get(member.orderId) ?? "",
          remainingAtStop,
        };
      })
      .filter((candidate) => candidate.remainingAtStop > 0);

    const stepCapacity = candidates.reduce((sum, candidate) => sum + candidate.remainingAtStop, 0);
    const appliedQuantityTotal = Math.min(scannedQuantity, stepCapacity);

    if (appliedQuantityTotal <= 0) {
      productScanBusyRef.current = false;
      playFeedbackTone("error");
      alert("Este item já está completo.");
      setScanValue("");
      scanInputRef.current?.focus();
      return;
    }

    const allocations = distributeScannedQuantityAcrossGroup(candidates, appliedQuantityTotal);
    const membersByCompositeId = new Map(currentUnit.members.map((member) => [member.compositeId, member]));

    const results = await Promise.all(
      allocations.map(async (allocation) => {
        const member = membersByCompositeId.get(allocation.compositeId)!;
        const result = await registerPickingScanAction({
          orderId: member.orderId,
          itemId: member.id,
          stockId,
          quantity: allocation.quantity,
          scanId: crypto.randomUUID(),
        });
        return { allocation, member, result };
      }),
    );

    const failures = results.filter((entry) => !entry.result.ok);
    const succeeded = results.filter((entry) => entry.result.ok);

    if (succeeded.length > 0) {
      setItems((current) => {
        const updated = current.map((item) => {
          const hit = succeeded.find((entry) => entry.member.compositeId === item.compositeId);
          if (!hit) return item;

          const nextSeparated = normalizeQuantity(item.separatedQuantityValue) + hit.allocation.quantity;
          const routeCollected = (item.routeLineCollected ?? 0) + hit.allocation.quantity;
          const memberActiveLine = getActiveRouteLine(item);
          const routeComplete = Boolean(memberActiveLine) && routeCollected >= (memberActiveLine?.quantity ?? 0);

          return {
            ...item,
            separatedQuantityValue: String(nextSeparated),
            routeLineIndex: routeComplete ? item.routeLineIndex + 1 : item.routeLineIndex,
            routeLineCollected: routeComplete ? 0 : routeCollected,
          };
        });
        return updated;
      });
    }

    productScanBusyRef.current = false;

    if (failures.length > 0) {
      playFeedbackTone("error");
      alert(`Não foi possível reservar o estoque para ${failures.length === 1 ? "1 pedido" : `${failures.length} pedidos`}: ${failures[0].result.message ?? "erro desconhecido"}`);
    } else {
      playFeedbackTone("success");
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
  }, [currentIndex, current.active, scanPhase]);

  useEffect(() => {
    if (!current.done || totalCount === 0 || autoSubmittedRef.current) return;

    autoSubmittedRef.current = true;
    const timer = window.setTimeout(() => {
      setIsSubmitting(true);
      completionFormRef.current?.requestSubmit();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [current.done, totalCount]);

  return (
    <div className="shipping-picking-ui flex flex-col" style={{ width: "100%", height: "100%", minHeight: "600px", borderRadius: 0, overflow: "hidden", background: t.appBg, color: t.text, transition: "background 0.35s ease, color 0.35s ease", fontFamily: "'Manrope', sans-serif" }}>
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
        @keyframes stockoutPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.08); } 50% { box-shadow: 0 0 0 4px rgba(220,38,38,0.16); } }
      `}} />

      <header style={{ flexShrink: 0, height: "68px", display: "flex", alignItems: "center", gap: "16px", padding: "0 28px", borderBottom: `1px solid ${t.border}`, background: t.barBg, transition: "background 0.35s ease" }}>
         <button onClick={() => void leaveWave()} disabled={isSubmitting || isResetting} style={{ display: "flex", alignItems: "center", gap: "8px", height: "40px", padding: "0 14px", borderRadius: "10px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: isSubmitting || isResetting ? "progress" : "pointer", textDecoration: "none", opacity: isSubmitting || isResetting ? 0.7 : 1 }}>
          ‹ Voltar
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: t.textSub }}>
          <span>Expedição</span><span>›</span><span style={{ color: t.text, fontWeight: "600" }}>Separação</span>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: "flex", alignItems: "center", gap: "9px", height: "38px", padding: "0 14px", borderRadius: "10px", background: t.softBg, border: `1px solid ${t.border}` }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", animation: "pulseDot 1.8s ease-in-out infinite" }}></span>
          <span style={{ fontSize: "13px", fontWeight: "700" }}>Onda {waveCode} ativa</span>
        </div>
        <button onClick={toggleTheme} title="Alternar tema" aria-label="Alternar tema" style={{ position: "relative", width: "68px", height: "32px", padding: "0", borderRadius: "999px", border: `1px solid ${tog.border}`, background: tog.track, cursor: "pointer", transition: "background 0.3s ease, border-color 0.3s ease", boxShadow: `inset 0 1px 3px ${tog.inset}` }}>
          <span style={{ position: "absolute", top: "50%", left: "12px", transform: "translateY(-50%)", fontSize: "12px", color: tog.trackMoon, transition: "color 0.3s ease" }}>☾</span>
          <span style={{ position: "absolute", top: "50%", right: "12px", transform: "translateY(-50%)", fontSize: "12px", color: tog.trackSun, transition: "color 0.3s ease" }}>☀</span>
          <span style={{ position: "absolute", top: "3px", left: "3px", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: tog.knob, boxShadow: "0 1px 4px rgba(0,0,0,0.35)", transform: `translateX(${tog.knobX})`, transition: "transform 0.32s cubic-bezier(.4,1.3,.5,1), background 0.3s ease", fontSize: "13px", color: tog.knobIconColor }}>{tog.knobIcon}</span>
        </button>
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
                <span style={{ width: "30px", height: "30px", flexShrink: 0, borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", background: task.numBg, color: task.numColor }}>{task.isCancelled ? "×" : task.mark}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: "700", color: task.titleColor }}>{task.loc}</span>
                  {task.detailsVisible ? (
                    <span style={{ fontSize: "12px", color: t.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {task.isCancelled ? <span style={{color: '#DC2626', fontWeight: 800 }}>(CANCELADO) </span> : task.isSkipped ? <span style={{color: '#F59E0B'}}>(PULADO) </span> : null}{task.name}
                    </span>
                  ) : (
                    <span style={{ fontSize: "12px", color: t.textSub }}>Valide o endereço para revelar o item</span>
                  )}
                </div>
                {task.detailsVisible && <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13.5px", fontWeight: "700", color: task.qtyColor }}>{task.qty}</span>}
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
              {scanPhase === "product" ? (
              <div style={{ borderRadius: "18px", border: `1px solid ${t.border}`, background: t.cardBg, padding: "22px", display: "flex", gap: "18px", alignItems: "center", animation: "popIn 0.2s ease" }}>
                <div style={{ width: "72px", height: "72px", flexShrink: 0, borderRadius: "14px", background: current.thumbBg, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.92)", overflow: "hidden" }}>
                  {current.imageUrl ? (
                    <img src={current.imageUrl} alt={current.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} />
                  ) : (
                    <BoxIcon size={34} />
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "17px", fontWeight: "700", lineHeight: "1.25" }}>{current.name}</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: t.textSub }}>{current.sku} · EAN {current.ean}</span>
                  {current.orderCount > 1 ? (
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "12.5px", color: "#8B5CF6", fontWeight: 700 }}>
                      Cobrindo {current.orderCount} pedidos neste lote
                    </span>
                  ) : null}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", paddingLeft: "18px", borderLeft: `1px solid ${t.border}` }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "34px", fontWeight: "700", color: "#8B5CF6" }}>{current.separated} / {current.requested}</span>
                  <span style={{ fontSize: "11.5px", color: t.textSub }}>coletados</span>
                </div>
              </div>
              ) : (
                <div style={{ borderRadius: "18px", border: `1.5px dashed #3B82F6`, background: t.softBg, padding: "24px", display: "flex", alignItems: "center", gap: "14px", color: t.textSub }}>
                  <span style={{ width: "48px", height: "48px", flexShrink: 0, borderRadius: "12px", background: hex.blue, color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}><PinIcon size={24} /></span>
                  <span style={{ fontSize: "14px", fontWeight: "700" }}>O produto será exibido após a validação do endereço</span>
                </div>
              )}

              {/* Breakdown per pedido -- a grouped step sums the quantity of
                  several orders (ex.: 1 + 6 + 4 + 4 = 15), which can look
                  wrong at a glance if you don't know it covers more than one
                  pedido. This makes the composition explicit. */}
              {scanPhase === "product" && currentUnit.orderCount > 1 ? (
                <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.softBg, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "11.5px", fontWeight: "700", letterSpacing: "0.05em", color: t.textSub, textTransform: "uppercase" }}>
                    {current.requested}x somam {currentUnit.orderCount} pedidos
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                    {currentUnit.members.map((member) => {
                      const memberSeparated = normalizeQuantity(member.separatedQuantityValue);
                      const memberDone = memberSeparated >= member.requestedQuantity;
                      return (
                        <span
                          key={member.compositeId}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "5px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: "700",
                            background: memberDone ? hex.green : t.cardBg,
                            color: memberDone ? "#10B981" : t.text,
                            border: `1px solid ${memberDone ? "transparent" : t.border}`,
                          }}
                        >
                          Pedido {member.orderCode} · {memberSeparated}/{member.requestedQuantity}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* scan field */}
              <div style={{ borderRadius: "18px", border: `1.5px dashed ${scanPhase === "address" ? "#3B82F6" : t.scanBorder}`, background: t.softBg, padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ position: "relative", width: "48px", height: "48px", flexShrink: 0, borderRadius: "12px", background: hex.violet, color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <ScanIconBig size={24} />
                  <span style={{ position: "absolute", left: "8px", right: "8px", top: "6px", height: "2px", background: "#8B5CF6", opacity: 0.5, animation: "scanBeam 1.6s ease-in-out infinite" }}></span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
                  <span style={{ fontSize: "14px", fontWeight: "700" }}>{scanPhase === "address" ? "Bipe o endereco de coleta primeiro" : "Bipe o produto para confirmar"}</span>
                  <span style={{ fontSize: "12.5px", color: t.textSub }}>Leitura do código de barras ou digite o EAN</span>
                </div>
              </div>
              <input
                ref={scanInputRef}
                value={scanValue}
                onChange={e => setScanValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); void handleScanSubmit(); }
                }}
                placeholder={scanPhase === "address" ? "Aguardando bipagem do endereco..." : "Aguardando bipagem do produto..."}
                style={{ height: "54px", padding: "0 18px", borderRadius: "12px", border: `1.5px solid ${scanPhase === "address" ? "#3B82F6" : t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", outline: "none", boxSizing: "border-box" }}
              />

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={cancelOrder} style={{ flex: 1, height: "52px", borderRadius: "12px", border: "1px solid #DC2626", background: t.inputBg, color: "#DC2626", fontFamily: "'Manrope', sans-serif", fontSize: "15px", fontWeight: "800", cursor: "pointer", animation: "stockoutPulse 1.6s ease-in-out infinite" }}>
                  {current.orderCount > 1 ? `Sem estoque, cancelar pedido ${currentUnit.primary.orderCode}` : "Sem estoque, cancelar pedido"}
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
                  Todos os itens da onda foram processados.
                  {items.some(i => i.isSkipped) && <span style={{display: 'block', marginTop: 8, color: '#F59E0B'}}>Aviso: Há itens pulados por divergência ou ruptura.</span>}
                </span>
              </div>
              <form ref={completionFormRef} action={savePickingWaveProgressAction} onSubmit={() => setIsSubmitting(true)} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                {orders.map((order) => (
                  <input key={order.id} type="hidden" name="waveOrderId" value={order.id} />
                ))}
                <input type="hidden" name="currentUserId" value={currentUserId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="completeRedirectTo" value={completeRedirectTo} />
                {cancelledOrderIds.map((orderId) => <input key={orderId} type="hidden" name="cancelledOrderId" value={orderId} />)}

                {items.map(item => (
                  <React.Fragment key={item.compositeId}>
                    <input type="hidden" name="itemOrderId" value={item.orderId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="itemKitProgress" value="[]" />
                    <input type="hidden" name="separatedQuantity" value={item.isSkipped ? "0" : item.separatedQuantityValue} />
                  </React.Fragment>
                ))}

                <button type="submit" disabled={isSubmitting} style={{ display: "none" }}>
                  {isSubmitting ? <MobileButtonSpinner size={20} /> : "Ir para conferência →"}
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
      orderCode: order.displayNumber || order.code,
      orderExternalNumber: order.externalNumber,
      orderCustomer: order.customer,
      orderDepositante: order.depositante,
      separatedQuantityValue: String(item.separatedQuantity),
      ...deriveRouteProgress(item.routeLines, item.separatedQuantity),
    })),
  );
}

function deriveRouteProgress(routeLines: WavePickingItemState["routeLines"], separatedQuantity: number) {
  let remaining = Math.max(0, separatedQuantity);
  for (let index = 0; index < routeLines.length; index += 1) {
    const lineQuantity = Math.max(0, Number(routeLines[index]?.quantity ?? 0));
    if (remaining < lineQuantity) {
      return { routeLineIndex: index, routeLineCollected: remaining };
    }
    remaining -= lineQuantity;
  }

  return {
    routeLineIndex: Math.max(routeLines.length - 1, 0),
    routeLineCollected: Math.max(0, Number(routeLines.at(-1)?.quantity ?? 0)),
  };
}

function normalizeQuantity(value: string) {
  const numeric = Number(value.replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

function isWaveItemComplete(item: WavePickingItemState) {
  return Boolean(item.isSkipped) || normalizeQuantity(item.separatedQuantityValue) >= item.requestedQuantity;
}

function getActiveRouteLine(item: WavePickingItemState) {
  if (!item.routeLines.length) return null;
  return item.routeLines[Math.min(item.routeLineIndex, item.routeLines.length - 1)] ?? null;
}

function toPickGroupSourceItem(item: WavePickingItemState, orderSequenceKey: string): PickGroupSourceItem {
  return {
    compositeId: item.compositeId,
    orderId: item.orderId,
    orderSequenceKey,
    productId: item.productId,
    isKit: item.isKit,
    isDone: isWaveItemComplete(item),
    routeLines: item.routeLines.map((line) => ({ stockId: line.stockId, quantity: line.quantity })),
    routeLineIndex: item.routeLineIndex,
  };
}

// Builds the ordered list of "picking units" the operator works through:
// a mix of individual order-items and, where possible, combined steps that
// cover the same product across several orders in the wave at once. See
// src/lib/shipping-picking-groups.ts for the underlying grouping/FIFO logic.
function buildPickingUnitViews(
  items: WavePickingItemState[],
  orderSequenceKeyByOrderId: Map<string, string>,
): PickingUnitView[] {
  const itemsByCompositeId = new Map(items.map((item) => [item.compositeId, item]));
  const sourceItems = items.map((item) =>
    toPickGroupSourceItem(item, orderSequenceKeyByOrderId.get(item.orderId) ?? ""),
  );
  const units = buildPickGroupUnits(sourceItems);

  const views = units.map((unit): PickingUnitView => {
    if (unit.kind === "single") {
      const full = itemsByCompositeId.get(unit.item.compositeId)!;
      return {
        key: unit.item.compositeId,
        members: [full],
        primary: full,
        requestedTotal: full.requestedQuantity,
        separatedTotal: normalizeQuantity(full.separatedQuantityValue),
        orderCount: 1,
        isDone: isWaveItemComplete(full),
      };
    }

    const fullMembers = [...unit.members]
      .sort((a, b) => a.orderSequenceKey.localeCompare(b.orderSequenceKey))
      .map((member) => itemsByCompositeId.get(member.compositeId)!);
    const distinctOrders = new Set(fullMembers.map((member) => member.orderId));

    return {
      key: `${unit.productId} ${unit.stockId}`,
      members: fullMembers,
      primary: fullMembers[0],
      requestedTotal: fullMembers.reduce((sum, member) => sum + member.requestedQuantity, 0),
      separatedTotal: fullMembers.reduce((sum, member) => sum + normalizeQuantity(member.separatedQuantityValue), 0),
      orderCount: distinctOrders.size,
      isDone: fullMembers.every(isWaveItemComplete),
    };
  });

  return views.sort((a, b) => {
    const firstRouteA = a.primary.routeLines[0];
    const firstRouteB = b.primary.routeLines[0];
    if (firstRouteA && firstRouteB) {
      const areaCompare = firstRouteA.area.localeCompare(firstRouteB.area, "pt-BR");
      if (areaCompare !== 0) return areaCompare;
      const labelCompare = firstRouteA.routeLabel.localeCompare(firstRouteB.routeLabel, "pt-BR", { numeric: true, sensitivity: "base" });
      if (labelCompare !== 0) return labelCompare;
    }
    return a.primary.orderExternalNumber.localeCompare(b.primary.orderExternalNumber, "pt-BR", { numeric: true, sensitivity: "base" });
  });
}

function findNextPendingUnitIndex(views: PickingUnitView[], startAt = 0) {
  const index = views.findIndex((view, i) => i >= startAt && !view.isDone);
  return index >= 0 ? index : views.length;
}
