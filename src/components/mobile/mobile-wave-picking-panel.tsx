"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  savePickingWaveProgressAction,
  savePickingWaveDraftAction,
  cancelPickingOrderAction,
  registerPickingScanAction,
} from "@/app/(dashboard)/expedicao/separacao/actions";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import type { ShippingPickingOrder } from "@/lib/shipping-picking";
import {
  mobileColors,
  mobileGradient,
  hexAlpha,
  headingFont,
  MobileBackButton,
  MobileScanOverlay,
  MobileIcon,
  MobileButtonSpinner,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

type WaveItemState = ShippingPickingOrder["items"][number] & {
  compositeId: string;
  orderId: string;
  orderExternalNumber: string;
  separatedQuantityValue: string;
  routeLineIndex: number;
  routeLineCollected: number;
  isSkipped?: boolean;
  isCancelled?: boolean;
};

type MobileWavePickingPanelProps = {
  orders: ShippingPickingOrder[];
  waveId: string;
  waveCode: string;
  currentUserId: string;
};

function flattenWaveItems(orders: ShippingPickingOrder[]): WaveItemState[] {
  return orders.flatMap((order) =>
    order.items.map((item) => {
      const routeProgress = deriveRouteProgress(item.routeLines, item.separatedQuantity);
      return {
        ...item,
        compositeId: `${order.id}:${item.id}`,
        orderId: order.id,
        orderExternalNumber: order.externalNumber,
        separatedQuantityValue: String(item.separatedQuantity),
        routeLineIndex: routeProgress.index,
        routeLineCollected: routeProgress.collected,
      };
    }),
  );
}

function deriveRouteProgress(routeLines: WaveItemState["routeLines"], separatedQuantity: number) {
  let remaining = Math.max(0, separatedQuantity);
  for (let index = 0; index < routeLines.length; index += 1) {
    const lineQuantity = Math.max(0, Number(routeLines[index]?.quantity ?? 0));
    if (remaining < lineQuantity) {
      return { index, collected: remaining };
    }
    remaining -= lineQuantity;
  }

  return {
    index: Math.max(routeLines.length - 1, 0),
    collected: Math.max(0, Number(routeLines.at(-1)?.quantity ?? 0)),
  };
}

function isWaveItemComplete(item: WaveItemState) {
  return Boolean(item.isSkipped) || normalizeQuantity(item.separatedQuantityValue) >= item.requestedQuantity;
}

function findNextPendingIndex(items: WaveItemState[], startAt = 0) {
  const nextIndex = items.findIndex((item, index) => index >= startAt && !isWaveItemComplete(item));
  return nextIndex >= 0 ? nextIndex : items.length;
}

function getActiveRouteLine(item: WaveItemState) {
  if (!item.routeLines.length) return null;
  return item.routeLines[Math.min(item.routeLineIndex, item.routeLines.length - 1)] ?? null;
}

function compareWaveItemsForPicking(a: WaveItemState, b: WaveItemState) {
  const routeA = a.routeLines[0];
  const routeB = b.routeLines[0];
  if (routeA && routeB) {
    const areaCompare = routeA.area.localeCompare(routeB.area, "pt-BR");
    if (areaCompare !== 0) return areaCompare;
    const labelCompare = routeA.routeLabel.localeCompare(routeB.routeLabel, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
    if (labelCompare !== 0) return labelCompare;
  }
  return a.orderExternalNumber.localeCompare(b.orderExternalNumber, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

function normalizeScan(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

function normalizeQuantity(value: string) {
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

const FLASH_DURATION_MS = 1300;

export function MobileWavePickingPanel({ orders, waveCode, currentUserId }: MobileWavePickingPanelProps) {
  const router = useRouter();
  const initialItems = useMemo(() => flattenWaveItems(orders), [orders]);
  const initialPrioritizedItems = useMemo(
    () => [...initialItems].sort(compareWaveItemsForPicking),
    [initialItems],
  );
  const [items, setItems] = useState<WaveItemState[]>(initialItems);
  const prioritizedItems = useMemo(() => [...items].sort(compareWaveItemsForPicking), [items]);

  const [currentIndex, setCurrentIndex] = useState(() => findNextPendingIndex(initialPrioritizedItems));
  const [scanPhase, setScanPhase] = useState<"address" | "product">("address");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  // Brief green outline on the camera frame, used instead of the full-screen
  // flash while counting intermediate units of the same product.
  const [framePulse, setFramePulse] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [cancelledOrderIds, setCancelledOrderIds] = useState<string[]>([]);
  const completionFormRef = useRef<HTMLFormElement | null>(null);
  const autoSubmittedRef = useRef(false);
  const draftHydratedRef = useRef(false);
  const draftSaveQueueRef = useRef<Promise<{ ok: boolean; message?: string }>>(Promise.resolve({ ok: true }));
  const productScanBusyRef = useRef(false);
  const overlayTimerRef = useRef<number | null>(null);
  const framePulseTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  /* const resetWaveToQueue = useCallback(
    async (reason: "cancelado" | "inatividade") => {
      const orderIds = Array.from(new Set(orders.map((order) => order.id)));
      if (!orderIds.length) {
        router.replace(`/m/separacao?feedback=${reason}`);
        return;
      }

      setIsSubmitting(true);
      const result = await resetPickingOrdersToQueueAction(orderIds, reason);
      if (result.success) {
        router.replace(`/m/separacao?feedback=${reason}&ids=${encodeURIComponent(orderIds.join(","))}`);
      } else {
        setIsSubmitting(false);
        flash({
          type: "err",
          title: "NÃ£o foi possÃ­vel devolver a onda",
          code: "â€”",
          sub: "Tente novamente antes de sair da separaÃ§Ã£o.",
        });
      }
    },
    [flash, orders, router],
  );

  const { isWarningVisible, countdownSeconds, resetTimer } = useInactivityTimeout({
    warningAfterMs: 10_000,
    expireAfterMs: 40_000,
    disabled: isSubmitting || isSavingDraft,
    onExpire: () => {
      void resetWaveToQueue("inatividade");
    },
  });

  */

  const totalCount = prioritizedItems.length;
  const doneCount = prioritizedItems.filter(isWaveItemComplete).length;
  const totalUnits = prioritizedItems.reduce((sum, item) => sum + item.requestedQuantity, 0);
  const separatedUnits = prioritizedItems.reduce(
    (sum, item) => sum + Math.min(normalizeQuantity(item.separatedQuantityValue), item.requestedQuantity),
    0,
  );
  const progressPct = totalUnits > 0 ? Math.round((separatedUnits / totalUnits) * 100) : 0;
  const currentItem = prioritizedItems[currentIndex];
  const isDone = totalCount > 0 && doneCount === totalCount;
  const activeRouteLine = currentItem ? getActiveRouteLine(currentItem) : null;
  const phaseColor = scanPhase === "address" ? mobileColors.blue : mobileColors.violet;

  const applyScanRef = useRef<(code: string) => void>(() => {});
  const handleDetected = useCallback((code: string) => applyScanRef.current(code), []);

  const persistDraft = useCallback(async (itemsToSave: WaveItemState[]) => {
    const payload = itemsToSave.map((item) => ({
      orderId: item.orderId,
      itemId: item.id,
      separatedQuantity: item.isSkipped ? 0 : normalizeQuantity(item.separatedQuantityValue),
    }));

    if (!payload.length) return { ok: true as const };
    const saveNext = async () => {
      setIsSavingDraft(true);
      try {
        return await savePickingWaveDraftAction(payload);
      } finally {
        setIsSavingDraft(false);
      }
    };

    const queuedSave = draftSaveQueueRef.current.then(saveNext, saveNext);
    draftSaveQueueRef.current = queuedSave.then(
      (result) => result,
      () => ({ ok: false, message: "Não foi possível salvar o progresso." }),
    );
    return queuedSave;
  }, []);

  const { videoRef, cameraStarting, cameraMessage, startCamera, stopCamera } = useCameraBarcodeScanner({
    onDetected: handleDetected,
    requirePresenceGap: true,
    confirmReads: 2,
  });

  useEffect(() => {
    if (scannerOpen) void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  useEffect(() => {
    if (!currentItem && scannerOpen) {
      closeScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem]);

  useEffect(() => {
    if (isDone) return;
    const nextPendingIndex = findNextPendingIndex(prioritizedItems, currentIndex);
    if (nextPendingIndex !== currentIndex) {
      setCurrentIndex(nextPendingIndex);
      setScanPhase("address");
    }
  }, [currentIndex, isDone, prioritizedItems]);

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

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (framePulseTimerRef.current) window.clearTimeout(framePulseTimerRef.current);
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!isDone || totalCount === 0 || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    const timer = window.setTimeout(() => {
      setIsSubmitting(true);
      completionFormRef.current?.requestSubmit();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isDone, totalCount]);

  function unlockAudio() {
    if (typeof window === "undefined") return;
    const AudioContextRef =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextRef) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextRef();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
  }

  function openScanner() {
    // Must run inside this direct tap handler: mobile browsers only allow
    // an AudioContext to unlock/resume during a genuine user gesture, and
    // the barcode-detection callback that later triggers flash()/beep()
    // runs async, well outside any gesture, so it can't unlock audio itself.
    unlockAudio();
    setScannerOpen(true);
  }

  function closeScanner() {
    stopCamera(null);
    setScannerOpen(false);
  }

  function scheduleScannerClose(delay: number) {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => closeScanner(), delay);
  }

  /**
   * Vibration + beep, split out from flash() so a partial scan can confirm
   * itself without taking over the screen: mid-count units only pulse the
   * camera frame, and the full-screen flash is saved for the last unit.
   */
  function playFeedback(feedbackType: "ok" | "err" | "warn") {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(feedbackType === "ok" ? 60 : [70, 60, 70]);
    }

    const context = audioContextRef.current;
    if (!context) return;
    if (context.state === "suspended") {
      void context.resume();
    }

    const beep = (freq: number, wave: OscillatorType, startTime: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.value = freq;
      gain.gain.value = 0.05;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    const now = context.currentTime;
    if (feedbackType === "ok") {
      beep(880, "sine", now, 0.12);
    } else {
      beep(220, "square", now, 0.1);
      beep(180, "square", now + 0.14, 0.12);
    }
  }

  function flash(next: ScanOverlayState) {
    setOverlay(next);
    if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = window.setTimeout(() => setOverlay(null), FLASH_DURATION_MS);

    if (next) {
      playFeedback(next.type);
    }
  }

  /** Confirms a mid-count unit: green frame border + the usual beep/vibration. */
  function pulseFrame() {
    playFeedback("ok");
    setFramePulse(true);
    if (framePulseTimerRef.current) window.clearTimeout(framePulseTimerRef.current);
    framePulseTimerRef.current = window.setTimeout(() => setFramePulse(false), 420);
  }

  async function handleBack() {
    if (isSavingDraft) return;
    const result = await persistDraft(items);
    if (!result?.ok) {
      flash({ type: "err", title: "Progresso nÃ£o salvo", code: "â€”", sub: "Tente novamente antes de sair da onda." });
      return;
    }
    router.push("/m/separacao");
  }

  function applyScan(rawValue: string) {
    if (!currentItem) return;
    const normalized = normalizeScan(rawValue);
    if (!normalized) return;

    if (scanPhase === "address") {
      const expected = normalizeScan(activeRouteLine?.addressCode ?? "");
      if (!expected || normalized !== expected) {
        flash({ type: "err", title: "Endereço incorreto", code: rawValue, sub: "Bipe o endereço sugerido na tela." });
        return;
      }
      flash({ type: "ok", title: "Endereço OK", code: activeRouteLine?.addressCode ?? "", sub: currentItem.name });
      setScanPhase("product");
      scheduleScannerClose(FLASH_DURATION_MS);
      return;
    }

    if (productScanBusyRef.current) return;
    productScanBusyRef.current = true;

    const matches = [
      currentItem.barcode,
      currentItem.packBarcode,
      currentItem.sku,
      currentItem.code,
      ...currentItem.scanTargets,
    ]
      .filter(Boolean)
      .some((value) => normalizeScan(String(value)) === normalized);

    if (!matches) {
      productScanBusyRef.current = false;
      flash({ type: "err", title: "Código inválido", code: rawValue, sub: "Este item não pertence a esta posição." });
      return;
    }

    const stockId = activeRouteLine?.stockId;
    if (!stockId) {
      productScanBusyRef.current = false;
      flash({ type: "err", title: "Saldo não localizado", code: rawValue, sub: "Não encontramos o saldo deste endereço." });
      return;
    }

    const nextSeparated = Math.min(
      normalizeQuantity(currentItem.separatedQuantityValue) + 1,
      currentItem.requestedQuantity,
    );
    void registerPickingScanAction({
      orderId: currentItem.orderId,
      itemId: currentItem.id,
      stockId,
      scanId: crypto.randomUUID(),
    }).then((result) => {
      if (!result.ok) {
        productScanBusyRef.current = false;
        flash({ type: "err", title: "Falha na reserva", code: rawValue, sub: result.message });
        return;
      }

      const routeCollected = (currentItem.routeLineCollected ?? 0) + 1;
      const routeComplete = Boolean(activeRouteLine) && routeCollected >= (activeRouteLine?.quantity ?? 0);
      const updatedItems = items.map((item) =>
        item.compositeId === currentItem.compositeId
          ? {
              ...item,
              separatedQuantityValue: String(nextSeparated),
              routeLineIndex: routeComplete ? item.routeLineIndex + 1 : item.routeLineIndex,
              routeLineCollected: routeComplete ? 0 : routeCollected,
            }
          : item,
      );
      setItems(updatedItems);
      productScanBusyRef.current = false;

      if (nextSeparated >= currentItem.requestedQuantity) {
        flash({ type: "ok", title: "Produto OK", code: currentItem.sku, sub: `${nextSeparated}/${currentItem.requestedQuantity} · avançando` });
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = window.setTimeout(() => {
          setScanPhase("address");
          const updatedPrioritizedItems = [...updatedItems].sort(compareWaveItemsForPicking);
          setCurrentIndex(findNextPendingIndex(updatedPrioritizedItems, currentIndex + 1));
          closeScanner();
        }, FLASH_DURATION_MS);
      } else {
        pulseFrame();
      }
    });
  }

  useEffect(() => {
    applyScanRef.current = applyScan;
  });

  function cancelCurrentOrder() {
    if (!currentItem) return;
    const orderId = currentItem.orderId;
    setCancelledOrderIds((current) => (current.includes(orderId) ? current : [...current, orderId]));
    setItems((current) =>
      current.map((item) =>
        item.orderId === orderId
          ? { ...item, isSkipped: true, isCancelled: true, separatedQuantityValue: "0" }
          : item,
      ),
    );
    void cancelPickingOrderAction(orderId).then((result) => {
      if (!result?.ok) {
        flash({ type: "err", title: "Falha ao cancelar", code: "—", sub: "Não foi possível cancelar por falta de estoque." });
      }
    });
    setScanPhase("address");
    const updatedItems = prioritizedItems.map((item) =>
      item.orderId === orderId
        ? { ...item, isSkipped: true, isCancelled: true, separatedQuantityValue: "0" }
        : item,
    );
    const updatedPrioritizedItems = [...updatedItems].sort(compareWaveItemsForPicking);
    setCurrentIndex(findNextPendingIndex(updatedPrioritizedItems, currentIndex + 1));
  }

  return (
    <div className="relative flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      <MobileScanOverlay overlay={overlay} />

      {/* <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="SeparaÃ§Ã£o pausada por inatividade"
        description="O operador ficou sem interaÃ§Ã£o nesta onda. Se a atividade nÃ£o for retomada, a onda serÃ¡ devolvida automaticamente para a fila."
        mobileDescription="O operador ficou sem interaÃ§Ã£o nesta onda. Retome a operaÃ§Ã£o para evitar que a onda volte para a fila."
      /> */}

      <div className="flex shrink-0 items-center gap-3 px-[18px] pb-3 pt-[18px]">
        <MobileBackButton onClick={() => void handleBack()} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[16px] font-extrabold" style={headingFont}>
            Separação
          </span>
          <span className="text-[12px]" style={{ color: mobileColors.muted }}>
            Onda {waveCode}
          </span>
        </div>
        <span
          className="rounded-full px-[11px] py-[5px] text-[11.5px] font-extrabold"
          style={{
            background: hexAlpha(isDone ? mobileColors.green : mobileColors.blue, 0.16),
            color: isDone ? mobileColors.green : mobileColors.blueLight,
          }}
        >
          {isDone ? "Concluída" : `${Math.min(currentIndex + 1, totalCount)}/${totalCount}`}
        </span>
      </div>

      <div className="shrink-0 px-[18px] pb-3">
        <div className="h-[7px] overflow-hidden rounded-full" style={{ background: hexAlpha("#94A3B8", 0.15) }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressPct}%`, background: mobileGradient }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11.5px]" style={{ color: mobileColors.muted }}>
            {isDone ? "Todos os itens separados" : scanPhase === "address" ? "Vá até o endereço" : "Confirme o produto"}
          </span>
          <span className="text-[11.5px] font-bold" style={{ color: mobileColors.violetLight }}>
            {progressPct}%
          </span>
        </div>
      </div>

      <div
        className="app-scroll flex flex-1 flex-col gap-4 overflow-y-auto px-[18px]"
        style={{ paddingBottom: currentItem ? 158 : 18 }}
      >
        {currentItem ? (
          <>
            {/* Primary instruction card — matches the mockup's Flow "active" card exactly */}
            <div
              className="flex flex-col gap-3.5 rounded-[20px] p-[18px]"
              style={{
                border: `1px solid ${hexAlpha(phaseColor, 0.3)}`,
                background: hexAlpha("#94A3B8", 0.04),
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] text-[13px] font-extrabold"
                  style={{ background: hexAlpha(phaseColor, 0.18), color: phaseColor, ...headingFont }}
                >
                  {scanPhase === "address" ? "1" : "2"}
                </span>
                <span className="text-[13px] font-extrabold uppercase tracking-wide" style={{ color: phaseColor }}>
                  {scanPhase === "address" ? "Bipe o endereço" : "Bipe o produto"}
                </span>
              </div>

              <div className="flex items-center gap-[13px]">
                <div
                  className="flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
                  style={{ background: `linear-gradient(140deg, ${mobileColors.blue} 0%, ${hexAlpha(mobileColors.blue, 0.55)} 100%)`, color: "rgba(255,255,255,0.92)" }}
                >
                  {currentItem.imageUrl ? (
                    <Image src={currentItem.imageUrl} alt={currentItem.name} width={54} height={54} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <MobileIcon name="box" size={24} />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[16px] font-extrabold leading-tight">{currentItem.name}</span>
                  <span className="text-[12.5px]" style={{ color: mobileColors.muted, ...headingFont }}>
                    {currentItem.sku}
                  </span>
                </div>
              </div>

              <div
                className="flex items-center gap-3 rounded-[15px] p-4"
                style={{ background: "rgba(5,7,13,0.5)", border: `1px dashed ${hexAlpha(phaseColor, 0.4)}` }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]"
                  style={{ background: hexAlpha(phaseColor, 0.16), color: phaseColor }}
                >
                  <MobileIcon name={scanPhase === "address" ? "loc" : "code"} size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[11px] uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                    {scanPhase === "address" ? "Endereço de picking" : "Código de barras"}
                  </span>
                  <span className="truncate text-[24px] font-bold tracking-wide" style={{ color: mobileColors.text, ...headingFont }}>
                    {scanPhase === "address"
                      ? activeRouteLine?.addressCode ?? "—"
                      : currentItem.barcode || currentItem.sku}
                  </span>
                </div>
                {scanPhase === "product" ? (
                  <div className="shrink-0 border-l pl-3 text-center" style={{ borderColor: hexAlpha("#94A3B8", 0.16) }}>
                    <div className="text-[26px] font-extrabold" style={headingFont}>
                      {normalizeQuantity(currentItem.separatedQuantityValue)}/{currentItem.requestedQuantity}
                    </div>
                    <div className="text-[10.5px]" style={{ color: mobileColors.muted }}>un</div>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full"
                style={{ border: `2px solid ${mobileColors.green}`, animation: "mobileRingPulse 1.6s ease-out infinite" }}
              />
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{ background: hexAlpha(mobileColors.green, 0.16), color: mobileColors.green }}
              >
                <MobileIcon name="check" size={40} strokeWidth={2.6} />
              </span>
            </div>
            <span className="text-[21px] font-bold" style={headingFont}>Onda separada!</span>
            <span className="max-w-[260px] text-[13.5px] leading-relaxed" style={{ color: mobileColors.muted }}>
              {totalCount} itens processados. Direcione o carrinho para a conferência.
              {items.some((i) => i.isSkipped) ? (
                <span className="mt-2 block" style={{ color: mobileColors.amber }}>
                  Há itens pulados por divergência ou ruptura.
                </span>
              ) : null}
            </span>
          </div>
        )}
      </div>

      {currentItem ? (
        <div
          className="left-1/2 flex w-full max-w-md -translate-x-1/2 flex-col gap-2.5 px-[18px] pt-3"
          style={{
            position: "fixed",
            bottom: 0,
            paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
            background: "linear-gradient(180deg, rgba(10,17,32,0) 0%, #0A1120 22%)",
          }}
        >
          <button
            type="button"
            onClick={openScanner}
            className="flex h-[62px] items-center justify-center gap-2 rounded-[17px] text-[16.5px] font-extrabold text-white"
            style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
          >
            <MobileIcon name="scan" size={20} strokeWidth={2} />
            {scanPhase === "address" ? "Bipar endereço" : "Bipar produto"}
          </button>

          <button
            type="button"
            onClick={cancelCurrentOrder}
            className="h-12 rounded-xl text-sm font-bold"
            style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.4)}`, color: mobileColors.redLight, background: "#0A1120" }}
          >
            Sem estoque, cancelar pedido
          </button>
        </div>
      ) : null}

      {scannerOpen && currentItem ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "#000",
            // Without this the middle section's `flex: 1` is inert and the
            // focus frame stacks right under the header instead of centering.
            display: "flex",
            flexDirection: "column",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.65) 100%)",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px",
              paddingTop: "calc(18px + env(safe-area-inset-top))",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, ...headingFont }}>
              {scanPhase === "address" ? "Aponte para o endereço" : "Aponte para o produto"}
            </span>
            <button
              type="button"
              onClick={() => closeScanner()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MobileIcon name="x" size={18} strokeWidth={2.6} />
            </button>
          </div>

          {/* Only the frame lives in the centered area, so it stays put in the
              middle of the screen instead of being pushed up once the unit
              progress appears. */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 250,
                height: 160,
                borderRadius: 22,
                border: `2.5px ${framePulse ? "solid" : "dashed"} ${
                  framePulse ? mobileColors.green : hexAlpha("#ffffff", 0.7)
                }`,
                boxShadow: framePulse ? `0 0 22px ${hexAlpha(mobileColors.green, 0.65)}` : "none",
                transition: "border-color 0.12s ease, box-shadow 0.12s ease",
              }}
            />
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "0 24px calc(36px + env(safe-area-inset-bottom))",
              textAlign: "center",
            }}
          >
            {scanPhase === "product" && currentItem.requestedQuantity > 1 ? (
              <>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, ...headingFont }}>
                  {normalizeQuantity(currentItem.separatedQuantityValue)} de {currentItem.requestedQuantity} unidades
                </span>
                {currentItem.requestedQuantity <= 12 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 7, maxWidth: 260 }}>
                    {Array.from({ length: currentItem.requestedQuantity }).map((_, dotIndex) => {
                      const collected = dotIndex < normalizeQuantity(currentItem.separatedQuantityValue);
                      return (
                        <span
                          key={dotIndex}
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: "50%",
                            background: collected ? mobileColors.green : "transparent",
                            border: `2px solid ${collected ? mobileColors.green : "rgba(255,255,255,0.45)"}`,
                            transition: "background 0.2s ease",
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ width: 220, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 999,
                        background: mobileColors.green,
                        width: `${Math.round((normalizeQuantity(currentItem.separatedQuantityValue) / currentItem.requestedQuantity) * 100)}%`,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.78)", fontSize: 12.5 }}>
                {cameraStarting ? "Abrindo câmera..." : cameraMessage ?? "Posicione o código dentro da moldura"}
              </span>
            )}
          </div>

          <MobileScanOverlay overlay={overlay} />
        </div>
      ) : null}

      <form
        ref={completionFormRef}
        action={savePickingWaveProgressAction}
        onSubmit={() => setIsSubmitting(true)}
        className="hidden"
      >
        {orders.map((order) => (
          <input key={order.id} type="hidden" name="waveOrderId" value={order.id} />
        ))}
        <input type="hidden" name="currentUserId" value={currentUserId} />
        <input type="hidden" name="returnTo" value="/m/separacao" />
        <input type="hidden" name="completeRedirectTo" value="/m/separacao" />
        {cancelledOrderIds.map((orderId) => (
          <input key={orderId} type="hidden" name="cancelledOrderId" value={orderId} />
        ))}
        {items.map((item) => (
          <span key={item.compositeId}>
            <input type="hidden" name="itemOrderId" value={item.orderId} />
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="itemKitProgress" value="" />
            <input
              type="hidden"
              name="separatedQuantity"
              value={item.isSkipped ? "0" : item.separatedQuantityValue}
            />
          </span>
        ))}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <MobileButtonSpinner /> : "Concluir"}
        </button>
      </form>
    </div>
  );
}
