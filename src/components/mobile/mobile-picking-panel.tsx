"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Barcode, Camera, CameraOff, Focus, MapPinned, Volume2 } from "lucide-react";
import { savePickingProgressAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { PickingOperatorOption, ShippingPickingOrder } from "@/lib/shipping-picking";
import {
  mobileColors,
  mobileGradient,
  hexAlpha,
  headingFont,
  MobilePrimaryButton,
  MobileScanOverlay,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

type MobilePickingPanelProps = {
  order: ShippingPickingOrder;
  operators: PickingOperatorOption[];
  currentUserId: string;
};

type MobilePickingItem = ShippingPickingOrder["items"][number] & {
  separatedQuantityValue: string;
};

type ScanHistoryEntry = {
  id: string;
  text: string;
  tone: "success" | "error";
};

export function MobilePickingPanel({
  order,
  operators,
  currentUserId,
}: MobilePickingPanelProps) {
  const router = useRouter();
  const [selectedOperatorId] = useState(
    order.assignedOperatorId ?? currentUserId,
  );
  const [items, setItems] = useState<MobilePickingItem[]>(
    order.items.map((item) => ({
      ...item,
      separatedQuantityValue: String(item.separatedQuantity),
    })),
  );
  const [scanValue, setScanValue] = useState("");
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [recentScannedItemId, setRecentScannedItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const recentScanTimerRef = useRef<number | null>(null);
  const overlayTimerRef = useRef<number | null>(null);
  const {
    videoRef,
    cameraSupported,
    cameraEnabled,
    cameraStarting,
    cameraMessage,
    toggleCamera,
  } = useCameraBarcodeScanner({
    onDetected: (code) => {
      applyScan(code);
      resetTimer();
    },
  });
  const { isWarningVisible, countdownSeconds, resetTimer } = useInactivityTimeout({
    disabled: isSubmitting,
    onExpire: () => {
      router.replace("/m/separacao?feedback=inatividade");
    },
  });

  const completionPercent = useMemo(() => {
    const requested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
    const separated = items.reduce(
      (sum, item) => sum + normalizeQuantity(item.separatedQuantityValue),
      0,
    );

    return requested > 0 ? Math.min(100, Math.round((separated / requested) * 100)) : 0;
  }, [items]);

  const pendingUnits = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Math.max(item.requestedQuantity - normalizeQuantity(item.separatedQuantityValue), 0),
        0,
      ),
    [items],
  );

  const nextItem = useMemo(
    () =>
      items.find(
        (item) =>
          normalizeQuantity(item.separatedQuantityValue) < item.requestedQuantity &&
          item.routeLines.length > 0,
      ) ??
      items.find(
        (item) => normalizeQuantity(item.separatedQuantityValue) < item.requestedQuantity,
      ) ??
      null,
    [items],
  );

  const orderedItems = useMemo(() => {
    return [...items]
      .filter((item) => !nextItem || item.id !== nextItem.id)
      .sort((left, right) => {
      const leftSeparated = normalizeQuantity(left.separatedQuantityValue);
      const rightSeparated = normalizeQuantity(right.separatedQuantityValue);
      const leftPending = leftSeparated < left.requestedQuantity;
      const rightPending = rightSeparated < right.requestedQuantity;

      if (leftPending !== rightPending) {
        return leftPending ? -1 : 1;
      }

      return left.sku.localeCompare(right.sku, "pt-BR");
      });
  }, [items, nextItem]);

  useEffect(() => {
    if (cameraEnabled) {
      return;
    }

    const timer = window.setTimeout(() => scanInputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [cameraEnabled]);

  useEffect(() => {
    return () => {
      if (recentScanTimerRef.current) {
        window.clearTimeout(recentScanTimerRef.current);
      }
      if (overlayTimerRef.current) {
        window.clearTimeout(overlayTimerRef.current);
      }
    };
  }, []);

  function flash(next: ScanOverlayState) {
    setOverlay(next);
    if (overlayTimerRef.current) {
      window.clearTimeout(overlayTimerRef.current);
    }
    overlayTimerRef.current = window.setTimeout(() => setOverlay(null), 700);

    if (!soundEnabled || typeof window === "undefined" || !next) {
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

    oscillator.type = next.type === "ok" ? "sine" : "square";
    oscillator.frequency.value = next.type === "ok" ? 880 : 220;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.onended = () => void context.close();
  }

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
  }

  function pushScanHistory(text: string, tone: "success" | "error") {
    setScanHistory((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        text,
        tone,
      },
      ...current,
    ].slice(0, 3));
  }

  function updateQuantity(itemId: string, value: string) {
    resetTimer();
    setItems((current) =>
      current.map((item) =>
        item.id === itemId && !item.isKit ? { ...item, separatedQuantityValue: value } : item,
      ),
    );
  }

  function highlightScannedItem(itemId: string) {
    setRecentScannedItemId(itemId);

    if (recentScanTimerRef.current) {
      window.clearTimeout(recentScanTimerRef.current);
    }

    recentScanTimerRef.current = window.setTimeout(() => {
      setRecentScannedItemId((current) => (current === itemId ? null : current));
    }, 1200);
  }

  function applyScan(rawValue: string) {
    const normalizedScan = normalizeScan(rawValue);

    if (!normalizedScan) {
      const message = "Leia ou digite um código para localizar o item.";
      flash({ type: "err", title: "Código vazio", code: "—", sub: message });
      pushScanHistory(message, "error");
      if (!cameraEnabled) {
        focusScanInput();
      }
      return;
    }

    const matchedItem = items.find((item) => matchesItemScan(item, normalizedScan));

    if (!matchedItem) {
      setActiveItemId(null);
      const message = "Código não encontrado nesta separação.";
      flash({ type: "err", title: "Não encontrado", code: rawValue, sub: message });
      pushScanHistory(message, "error");
      if (!cameraEnabled) {
        focusScanInput();
      }
      return;
    }

    let message = "";

    if (matchedItem.isKit && matchedItem.kitComponents.length > 0) {
      const matchedComponent = findMatchingKitComponent(matchedItem, normalizedScan);

      if (!matchedComponent) {
        setActiveItemId(matchedItem.id);
        message = `Kit ${matchedItem.sku} localizado, mas o componente lido não está mapeado.`;
        flash({ type: "err", title: "Componente não mapeado", code: matchedItem.sku, sub: message });
        pushScanHistory(message, "error");
        if (!cameraEnabled) {
          focusScanInput();
        }
        return;
      }

      if (matchedComponent.separatedQuantity >= matchedComponent.requestedQuantity) {
        setActiveItemId(matchedItem.id);
        message = `Componente ${matchedComponent.sku} já completo (${matchedComponent.requestedQuantity}/${matchedComponent.requestedQuantity}).`;
        flash({ type: "warn", title: "Já completo", code: matchedComponent.sku, sub: message });
        pushScanHistory(message, "error");
        if (!cameraEnabled) {
          focusScanInput();
        }
        return;
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

      message = `${matchedItem.sku}: ${matchedComponent.sku} ${nextComponentQuantity}/${matchedComponent.requestedQuantity}. Total ${nextTotalSeparated}/${matchedItem.requestedQuantity}.`;
      flash({ type: "ok", title: "Componente bipado", code: matchedComponent.sku, sub: message });
    } else {
      const currentSeparated = normalizeQuantity(matchedItem.separatedQuantityValue);
      const nextSeparated = Math.min(currentSeparated + 1, matchedItem.requestedQuantity);

      setItems((current) =>
        current.map((item) =>
          item.id === matchedItem.id
            ? { ...item, separatedQuantityValue: String(nextSeparated) }
            : item,
        ),
      );

      message = `${matchedItem.sku}: ${nextSeparated}/${matchedItem.requestedQuantity} separado(s).`;
      flash({ type: "ok", title: "Item bipado", code: matchedItem.sku, sub: `${nextSeparated}/${matchedItem.requestedQuantity} ${matchedItem.unit}` });
    }

    setActiveItemId(matchedItem.id);
    highlightScannedItem(matchedItem.id);
    setScanValue("");
    pushScanHistory(message, "success");
    resetTimer();
    if (!cameraEnabled) {
      focusScanInput();
    }
  }

  return (
    <form
      action={savePickingProgressAction}
      className="relative mx-auto w-full max-w-2xl space-y-4"
      aria-busy={isSubmitting}
      onSubmit={() => setIsSubmitting(true)}
      style={{ color: mobileColors.text, ...bodyFontVar }}
    >
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="Separação pausada por inatividade"
        description="O operador ficou sem interação nesta separação. Se a atividade não for retomada, o pedido será devolvido automaticamente para a fila."
        mobileDescription="Sem interação na separação. Retome agora ou o pedido volta para a fila."
      />

      <MobileScanOverlay overlay={overlay} />

      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="operatorId" value={selectedOperatorId} />
      <input type="hidden" name="redirectBase" value="/m/separacao" />
      <input type="hidden" name="completeRedirectTo" value={`/m/conferencia/${order.id}`} />

      {/* Hero Header Card */}
      <section
        className="relative overflow-hidden rounded-3xl p-5"
        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) }}
      >
        <div className="absolute left-0 top-0 h-1 w-full" style={{ background: mobileGradient }} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: mobileColors.blueLight }}>
              Separação em andamento
            </p>
            <h1 className="mt-1.5 text-2xl font-bold" style={headingFont}>{order.displayNumber}</h1>
            <p className="mt-1 text-sm font-medium" style={{ color: mobileColors.muted }}>
              {order.customer} • {order.destination}
            </p>
          </div>
          <span
            className="rounded-xl px-3 py-1.5 text-sm font-bold"
            style={{ background: hexAlpha(mobileColors.blue, 0.1), border: `1px solid ${hexAlpha(mobileColors.blue, 0.2)}`, color: mobileColors.blueLight }}
          >
            {completionPercent}%
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <MiniInfo label="Pendentes" value={`${pendingUnits} un`} />
          <MiniInfo label="Operador" value={selectedOperatorId ? "Definido" : "Pendente"} />
        </div>
      </section>

      {/* Item em Foco */}
      {nextItem ? (
        <section
          className="rounded-3xl p-5 transition-all"
          style={{
            border: `1px solid ${hexAlpha(mobileColors.blue, 0.3)}`,
            background: `linear-gradient(140deg, ${hexAlpha(mobileColors.blue, 0.08)}, ${hexAlpha(mobileColors.violet, 0.05)})`,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: mobileColors.blueLight }}>
            Item em foco (Próxima Coleta)
          </p>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <ProductThumb imageUrl={nextItem.imageUrl} name={nextItem.name} large />
              <div className="min-w-0">
                <p className="text-xl font-bold" style={headingFont}>{nextItem.sku}</p>
                <p className="mt-1.5 text-sm font-medium" style={{ color: mobileColors.muted }}>{nextItem.name}</p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <InfoPill label="Pedido" value={`${nextItem.requestedQuantity} ${nextItem.unit}`} />
            <InfoPill
              label="Separado"
              value={`${normalizeQuantity(nextItem.separatedQuantityValue)} ${nextItem.unit}`}
            />
            <InfoPill
              label="Falta"
              value={`${Math.max(
                nextItem.requestedQuantity - normalizeQuantity(nextItem.separatedQuantityValue),
                0,
              )} ${nextItem.unit}`}
            />
          </div>
          <div
            className="mt-4 rounded-2xl px-4 py-3"
            style={{ border: `1px solid ${hexAlpha(mobileColors.blue, 0.2)}`, background: hexAlpha("#000000", 0.2) }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
              EAN/GTIN esperado
            </p>
            <p className="mt-1 text-sm font-bold" style={{ color: mobileColors.text, ...headingFont }}>{nextItem.barcode || "-"}</p>
          </div>
          <div className="mt-4 space-y-3">
            <div className="h-2.5 overflow-hidden rounded-full" style={{ background: hexAlpha("#94A3B8", 0.15) }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  background: mobileGradient,
                  width: `${Math.min(
                    100,
                    Math.round(
                      (normalizeQuantity(nextItem.separatedQuantityValue) /
                        Math.max(nextItem.requestedQuantity, 1)) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold" style={{ color: mobileColors.text }}>
                {nextItem.routeLines[0]
                  ? `Coleta sugerida em ${nextItem.routeLines[0].addressCode}`
                  : "Sem endereço sugerido."}
              </p>
              {nextItem.routeLines[0] ? (
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium" style={{ color: mobileColors.muted }}>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px]"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: hexAlpha("#94A3B8", 0.06) }}
                  >
                    {nextItem.routeLines[0].area}
                  </span>
                  <span>{nextItem.routeLines[0].routeLabel}</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Área de Scaneamento */}
      <section
        className="rounded-3xl p-5"
        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) }}
      >
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: mobileColors.muted }}>
            Operador
          </span>
          <div
            className="rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.text }}
          >
            {order.assignedOperatorName ?? "Operador não atribuído"}
          </div>
        </label>

        <div className="mt-5 space-y-3">
          <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: mobileColors.muted }}>
            Leitura de Código
          </span>
          <div
            className="flex items-center gap-2 rounded-2xl p-2 transition-all"
            style={{ border: `2px solid ${hexAlpha(mobileColors.blue, 0.3)}`, background: hexAlpha("#94A3B8", 0.05) }}
          >
            <Barcode className="ml-2 h-5 w-5" style={{ color: mobileColors.blueLight }} />
            <input
              ref={scanInputRef}
              value={scanValue}
              onChange={(event) => {
                resetTimer();
                setScanValue(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyScan(scanValue);
                }
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  scanInputRef.current?.focus();
                }, 40);
              }}
              placeholder="Leia EAN, SKU ou código"
              className="h-11 w-full bg-transparent px-2 text-base font-medium outline-none"
              style={{ color: mobileColors.text }}
            />
            <button
              type="button"
              onClick={() => applyScan(scanValue)}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all"
              style={{ background: mobileColors.blue }}
            >
              Ler
            </button>
          </div>

          {scanHistory.length ? (
            <div
              className="rounded-2xl px-4 py-3"
              style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: hexAlpha("#94A3B8", 0.03) }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                Últimos scans
              </p>
              <div className="mt-2.5 space-y-2">
                {scanHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl px-3 py-2 text-xs font-semibold"
                    style={{
                      background: hexAlpha(entry.tone === "success" ? mobileColors.green : mobileColors.red, 0.12),
                      color: entry.tone === "success" ? mobileColors.green : mobileColors.redLight,
                    }}
                  >
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={toggleCamera}
              disabled={!cameraSupported}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: cameraEnabled ? mobileColors.red : mobileColors.blue }}
            >
              {cameraEnabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {cameraStarting
                ? "Abrindo câmera..."
                : cameraEnabled
                  ? "Desligar câmera"
                  : "Ler pela câmera"}
            </button>

            <button
              type="button"
              onClick={focusScanInput}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.18)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.text }}
            >
              <Focus className="h-4 w-4" />
              Focar
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled((current) => !current)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.18)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.text }}
            >
              <Volume2 className="h-4 w-4" />
              {soundEnabled ? "Som ativo" : "Sem som"}
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "#05070D" }}>
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-video w-full object-cover transition"
              style={{ opacity: cameraEnabled || cameraStarting ? 1 : 0.35 }}
            />
          </div>

          <p className="text-xs font-medium" style={{ color: mobileColors.muted }}>
            {cameraMessage ??
              (cameraSupported
                ? "Abra a câmera para escanear pelo celular ou notebook sem depender do teclado."
                : "Seu navegador atual não liberou leitura por câmera. O leitor USB e o campo manual continuam disponíveis.")}
          </p>
        </div>
      </section>

      {/* Lista de Itens Restantes */}
      <section className="space-y-4">
        {orderedItems.map((item) => {
          const separatedQuantity = normalizeQuantity(item.separatedQuantityValue);
          const missing = Math.max(item.requestedQuantity - separatedQuantity, 0);
          const isCurrentItem = nextItem?.id === item.id;
          const isCompleted = missing === 0;
          const isActiveItem = activeItemId === item.id;
          const isRecentlyScanned = recentScannedItemId === item.id;

          const cardBorder = isCurrentItem
            ? hexAlpha(mobileColors.blue, 0.4)
            : isCompleted
              ? hexAlpha(mobileColors.green, 0.3)
              : isActiveItem
                ? hexAlpha(mobileColors.blue, 0.3)
                : hexAlpha("#94A3B8", 0.14);
          const cardBg = isCurrentItem
            ? hexAlpha(mobileColors.blue, 0.1)
            : isCompleted
              ? hexAlpha(mobileColors.green, 0.05)
              : isActiveItem
                ? hexAlpha(mobileColors.blue, 0.05)
                : hexAlpha("#94A3B8", 0.045);

          return (
            <div
              key={item.id}
              className={`rounded-3xl p-4 transition-colors ${isRecentlyScanned ? "mobile-scan-flash mobile-scan-flash-sky" : ""}`}
              style={{ border: `1px solid ${cardBorder}`, background: cardBg }}
            >
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="itemKitProgress" value={serializeKitProgress(item)} />
              <ProductThumb imageUrl={item.imageUrl} name={item.name} />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={isCurrentItem ? "text-base font-bold" : "text-sm font-bold"} style={headingFont}>
                      {item.sku}
                    </p>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: hexAlpha(
                          isCurrentItem ? mobileColors.blue : isCompleted ? mobileColors.green : mobileColors.amber,
                          0.16,
                        ),
                        color: isCurrentItem ? mobileColors.blueLight : isCompleted ? mobileColors.green : mobileColors.amber,
                      }}
                    >
                      {isRecentlyScanned
                        ? "Lido agora"
                        : isCurrentItem
                          ? "Em foco"
                          : isCompleted
                            ? "Completo"
                            : "Pendente"}
                    </span>
                  </div>
                  <p className={`mt-1.5 text-xs font-medium ${isCurrentItem ? "" : "line-clamp-2"}`} style={{ color: mobileColors.muted }}>
                    {item.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium" style={{ color: mobileColors.muted }}>
                    <span className="rounded-md px-2 py-0.5" style={{ background: hexAlpha("#94A3B8", 0.1) }}>Cod. {item.code}</span>
                    {!isCurrentItem ? (
                      <span className="rounded-md px-2 py-0.5" style={{ background: hexAlpha("#94A3B8", 0.1) }}>
                        {item.requestedQuantity} {item.unit}
                      </span>
                    ) : null}
                  </div>
                </div>
                {isCurrentItem ? (
                  <span className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold" style={{ background: hexAlpha("#94A3B8", 0.1), color: mobileColors.text }}>
                    {item.requestedQuantity} {item.unit}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                  <span>Progresso</span>
                  <span>
                    {separatedQuantity} / {item.requestedQuantity} {item.unit}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full" style={{ background: hexAlpha("#94A3B8", 0.15) }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      background: isCompleted ? mobileColors.green : isCurrentItem ? mobileColors.blue : mobileColors.amber,
                      width: `${Math.min(
                        100,
                        Math.round((separatedQuantity / Math.max(item.requestedQuantity, 1)) * 100),
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 rounded-2xl px-3 py-2.5" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.12)}`, background: hexAlpha("#94A3B8", 0.04) }}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                    EAN/GTIN esperado
                  </p>
                  <p className="text-sm font-bold" style={{ color: mobileColors.text }}>
                    {item.barcode || "-"}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                    Qtd Separada
                  </span>
                  <input
                    type="number"
                    name="separatedQuantity"
                    min={0}
                    max={item.requestedQuantity}
                    step={1}
                    value={item.separatedQuantityValue}
                    onChange={(event) => updateQuantity(item.id, event.target.value)}
                    readOnly={item.isKit}
                    className="h-11 w-full rounded-xl px-3 text-sm font-bold outline-none"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.text }}
                  />
                </label>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                    Status
                  </span>
                  <div
                    className="flex h-11 items-center rounded-xl px-3 text-sm font-bold"
                    style={{
                      border: `1px solid ${hexAlpha(missing > 0 ? mobileColors.amber : mobileColors.green, 0.3)}`,
                      background: hexAlpha(missing > 0 ? mobileColors.amber : mobileColors.green, 0.1),
                      color: missing > 0 ? mobileColors.amber : mobileColors.green,
                    }}
                  >
                    {missing > 0 ? `Faltam ${missing}` : "Completo"}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                  Endereços sugeridos
                </p>
                {item.isKit && item.kitComponents.length ? (
                  <div className="space-y-3">
                    {item.kitComponents.map((component) => (
                      <div
                        key={`${item.id}-${component.componentProductId}`}
                        className="rounded-2xl px-3 py-3"
                        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.04) }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold" style={{ color: mobileColors.text }}>{component.sku}</p>
                            <p className="text-[11px] font-medium" style={{ color: mobileColors.muted }}>
                              GTIN {component.barcode || "-"}
                            </p>
                          </div>
                          <p className="text-xs font-bold" style={{ color: mobileColors.blueLight }}>
                            {component.separatedQuantity}/{component.requestedQuantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : item.routeLines.length ? (
                  item.routeLines.map((line) => (
                    <div
                      key={`${item.id}-${line.stockId}`}
                      className="rounded-2xl px-3 py-3"
                      style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.04) }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <MapPinned className="h-4 w-4 shrink-0" style={{ color: mobileColors.blueLight }} />
                            <span className="text-sm font-bold" style={{ color: mobileColors.text }}>
                              {line.addressCode}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-medium" style={{ color: mobileColors.muted }}>
                            <span
                              className="rounded-full px-2 py-0.5"
                              style={{ background: hexAlpha(mobileColors.blue, 0.1), border: `1px solid ${hexAlpha(mobileColors.blue, 0.2)}`, color: mobileColors.blueLight }}
                            >
                              {line.area}
                            </span>
                            <span>{line.routeLabel}</span>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-xl px-3 py-2 text-right" style={{ border: `1px solid ${hexAlpha(mobileColors.blue, 0.2)}`, background: hexAlpha(mobileColors.blue, 0.1) }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: mobileColors.blueLight }}>
                            Coletar
                          </p>
                          <p className="mt-0.5 text-sm font-bold" style={{ color: mobileColors.blueLight }}>
                            {line.quantity} {item.unit}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl px-3 py-2" style={{ background: hexAlpha("#94A3B8", 0.05), border: `1px solid ${hexAlpha("#94A3B8", 0.1)}` }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: mobileColors.muted }}>
                            Lote
                          </p>
                          <p className="mt-1 text-xs font-bold" style={{ color: mobileColors.text }}>{line.lot}</p>
                        </div>
                        <div className="rounded-xl px-3 py-2" style={{ background: hexAlpha("#94A3B8", 0.05), border: `1px solid ${hexAlpha("#94A3B8", 0.1)}` }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: mobileColors.muted }}>
                            Validade
                          </p>
                          <p className="mt-1 text-xs font-bold" style={{ color: mobileColors.text }}>{line.expiry}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    className="rounded-2xl px-4 py-4 text-center text-sm font-medium"
                    style={{ border: `1px dashed ${hexAlpha(mobileColors.amber, 0.3)}`, background: hexAlpha(mobileColors.amber, 0.05), color: mobileColors.amber }}
                  >
                    Sem endereço sugerido.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Floating Action Bar */}
      <div
        className="sticky bottom-4 z-40 mx-auto mt-8 w-full max-w-2xl rounded-[28px] p-5 shadow-2xl"
        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "rgba(10,17,32,0.92)" }}
      >
        {isWarningVisible ? (
          <div
            className="mb-4 rounded-2xl px-4 py-3 text-sm"
            style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.2)}`, background: hexAlpha(mobileColors.red, 0.08) }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: mobileColors.redLight }}>
              Atenção operacional
            </p>
            <p className="mt-1 font-bold" style={{ color: mobileColors.text }}>Pedido em risco de voltar para a fila.</p>
            <p className="mt-1 font-medium" style={{ color: mobileColors.muted }}>
              Retome a separação em até <span className="font-bold" style={{ color: mobileColors.redLight }}>{countdownSeconds}s</span>.
            </p>
          </div>
        ) : null}

        <div className="mb-3 flex items-center justify-between gap-3 text-sm font-bold" style={{ color: mobileColors.text }}>
          <span>{completionPercent}% concluído</span>
          <span>{pendingUnits} un pendente(s)</span>
        </div>

        <div className="mb-5 h-2.5 overflow-hidden rounded-full" style={{ background: hexAlpha("#94A3B8", 0.15) }}>
          <div className="h-full rounded-full transition-all" style={{ background: mobileGradient, width: `${completionPercent}%` }} />
        </div>

        <MobilePrimaryButton type="submit" disabled={isSubmitting} style={{ height: 56 }}>
          {isSubmitting ? "Processando separação..." : "Concluir Separação"}
        </MobilePrimaryButton>
        <input type="hidden" name="intent" value="complete" />
      </div>
    </form>
  );
}

const bodyFontVar = { fontFamily: "var(--font-manrope), sans-serif" };

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: hexAlpha("#94A3B8", 0.05) }}>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>{label}</p>
      <p className="mt-1.5 text-base font-bold" style={{ color: mobileColors.text }}>{value}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.06) }}>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>{label}</p>
      <p className="mt-1 text-sm font-bold" style={{ color: mobileColors.text }}>{value}</p>
    </div>
  );
}

function normalizeScan(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

function normalizeQuantity(value: string) {
  const numeric = Number(value.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, numeric);
}

function matchesItemScan(item: MobilePickingItem, normalizedScan: string) {
  return item.scanTargets
    .filter(Boolean)
    .some((value) => normalizeScan(value) === normalizedScan);
}

function findMatchingKitComponent(item: MobilePickingItem, normalizedScan: string) {
  return item.kitComponents.find((component) =>
    [component.barcode, component.sku]
      .filter(Boolean)
      .some((value) => normalizeScan(value) === normalizedScan),
  );
}

function serializeKitProgress(item: MobilePickingItem) {
  if (!item.isKit || item.kitComponents.length === 0) {
    return "";
  }

  return JSON.stringify(
    item.kitComponents.map((component) => ({
      componentProductId: component.componentProductId,
      quantityPerKit: component.quantityPerKit,
      separatedQuantity: component.separatedQuantity,
      sku: component.sku,
      name: component.name,
      barcode: component.barcode,
    })),
  );
}

function ProductThumb({
  imageUrl,
  name,
  large = false,
}: {
  imageUrl: string | null;
  name: string;
  large?: boolean;
}) {
  const dimensions = large ? "h-20 w-20 rounded-3xl" : "mb-4 h-16 w-16 rounded-2xl";

  if (!imageUrl) {
    return (
      <div
        className={`${dimensions} flex items-center justify-center overflow-hidden text-[10px] font-bold uppercase tracking-wide`}
        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.08), color: mobileColors.muted }}
      >
        Sem foto
      </div>
    );
  }

  return (
    <div className={`${dimensions} overflow-hidden`} style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.06) }}>
      <Image
        src={imageUrl}
        alt={`Foto do produto ${name}`}
        width={80}
        height={80}
        unoptimized
        className="h-full w-full object-cover"
      />
    </div>
  );
}
