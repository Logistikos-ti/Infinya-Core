"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Barcode, Camera, CameraOff, Focus, MapPinned, Volume2 } from "lucide-react";
import { savePickingProgressAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { Button } from "@/components/ui/button";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { PickingOperatorOption, ShippingPickingOrder } from "@/lib/shipping-picking";

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
  const [selectedOperatorId, setSelectedOperatorId] = useState(
    order.assignedOperatorId ?? currentUserId,
  );
  const [items, setItems] = useState<MobilePickingItem[]>(
    order.items.map((item) => ({
      ...item,
      separatedQuantityValue: String(item.separatedQuantity),
    })),
  );
  const [scanValue, setScanValue] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanTone, setScanTone] = useState<"success" | "error">("success");
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [recentScannedItemId, setRecentScannedItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const recentScanTimerRef = useRef<number | null>(null);
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
    };
  }, []);

  function setFeedback(message: string, tone: "success" | "error") {
    setScanMessage(message);
    setScanTone(tone);

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
      setFeedback(message, "error");
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
      setFeedback(message, "error");
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
        setFeedback(message, "error");
        pushScanHistory(message, "error");
        if (!cameraEnabled) {
          focusScanInput();
        }
        return;
      }

      if (matchedComponent.separatedQuantity >= matchedComponent.requestedQuantity) {
        setActiveItemId(matchedItem.id);
        message = `Componente ${matchedComponent.sku} já completo (${matchedComponent.requestedQuantity}/${matchedComponent.requestedQuantity}).`;
        setFeedback(message, "error");
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
    }

    setActiveItemId(matchedItem.id);
    highlightScannedItem(matchedItem.id);
    setScanValue("");
    setFeedback(message, "success");
    pushScanHistory(message, "success");
    resetTimer();
    if (!cameraEnabled) {
      focusScanInput();
    }
  }

  return (
    <form action={savePickingProgressAction} className="space-y-4 max-w-2xl mx-auto w-full" aria-busy={isSubmitting}>
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="Separação pausada por inatividade"
        description="O operador ficou sem interação nesta separação. Se a atividade não for retomada, o pedido será devolvido automaticamente para a fila."
        mobileDescription="Sem interação na separação. Retome agora ou o pedido volta para a fila."
      />

      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="operatorId" value={selectedOperatorId} />
      <input type="hidden" name="redirectBase" value="/m/separacao" />
      <input type="hidden" name="completeRedirectTo" value={`/m/conferencia/${order.id}`} />

      {/* Hero Header Card */}
      <section className="glass-card rounded-3xl p-5 border border-slate-200/60 dark:border-zinc-800/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-infinya-gradient"></div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-500">
              Separação em andamento
            </p>
            <h1 className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">{order.externalNumber}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-zinc-400">
              {order.customer} • {order.destination}
            </p>
          </div>
          <span className="rounded-xl bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 text-sm font-bold text-primary-600 dark:text-primary-400">
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
        <section className="rounded-3xl border border-primary-500/30 bg-gradient-to-br from-primary-500/5 to-accent-500/5 dark:from-primary-500/15 dark:to-accent-500/10 p-5 shadow-lg shadow-primary-500/10 transition-all">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-600 dark:text-primary-400">
            Item em foco (Próxima Coleta)
          </p>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <ProductThumb imageUrl={nextItem.imageUrl} name={nextItem.name} large />
              <div className="min-w-0">
              <p className="text-xl font-bold text-slate-900 dark:text-white">{nextItem.sku}</p>
              <p className="mt-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">{nextItem.name}</p>
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
          <div className="mt-4 rounded-2xl border border-primary-500/20 bg-white/60 dark:bg-zinc-950/40 px-4 py-3 backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              EAN/GTIN esperado
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{nextItem.barcode || "-"}</p>
          </div>
          <div className="mt-4 space-y-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-infinya-gradient transition-all"
                style={{
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
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {nextItem.routeLines[0]
                  ? `Coleta sugerida em ${nextItem.routeLines[0].addressCode}`
                  : "Sem endereço sugerido."}
              </p>
              {nextItem.routeLines[0] ? (
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[11px]">
                    {nextItem.routeLines[0].area}
                  </span>
                  <span>{nextItem.routeLines[0].routeLabel}</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Área de Scaneamento e Filtros */}
      <section className="glass-card rounded-3xl border border-slate-200/60 dark:border-zinc-800/60 p-5 shadow-sm">
        <label className="space-y-2 block">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400">
            Operador
          </span>
          <select
            value={selectedOperatorId}
            onChange={(event) => {
              resetTimer();
              setSelectedOperatorId(event.target.value);
            }}
            className="h-12 w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
          >
            <option value="">Selecionar operador</option>
            {operators.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 space-y-3">
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-zinc-400">
            Leitura de Código
          </span>
          <div className="flex items-center gap-2 rounded-2xl border-2 border-primary-500/30 bg-white dark:bg-zinc-900 p-2 shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
            <Barcode className="h-5 w-5 ml-2 text-primary-500" />
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
              className="h-11 w-full bg-transparent px-2 text-base font-medium text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => applyScan(scanValue)}
              className="rounded-xl bg-primary-500 hover:bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary-500/20 transition-all"
            >
              Ler
            </button>
          </div>

          {scanMessage ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                scanTone === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
              }`}
            >
              {scanMessage}
            </div>
          ) : null}

          {scanHistory.length ? (
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Últimos scans
              </p>
              <div className="mt-2.5 space-y-2">
                {scanHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      entry.tone === "success"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    }`}
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
              className={`inline-flex items-center justify-center gap-2 flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                cameraEnabled
                  ? "bg-rose-500 text-white hover:bg-rose-600"
                  : "bg-primary-500 text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              }`}
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
              className="inline-flex items-center justify-center gap-2 flex-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <Focus className="h-4 w-4" />
              Focar
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled((current) => !current)}
              className="inline-flex items-center justify-center gap-2 flex-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <Volume2 className="h-4 w-4" />
              {soundEnabled ? "Som ativo" : "Sem som"}
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-950">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`aspect-video w-full object-cover transition ${
                cameraEnabled || cameraStarting ? "opacity-100" : "opacity-35"
              }`}
            />
          </div>

          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
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

          return (
            <div
              key={item.id}
              className={`border transition-all ${
                isCurrentItem
                  ? "rounded-3xl border-primary-500/40 bg-gradient-to-br from-primary-500/10 to-transparent p-5 shadow-lg shadow-primary-500/10"
                  : isCompleted
                    ? "rounded-[24px] border-emerald-500/30 bg-emerald-500/5 p-4"
                    : isActiveItem
                      ? "rounded-[24px] border-primary-500/30 bg-primary-500/5 p-4"
                      : "rounded-[24px] border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
              } ${isRecentlyScanned ? "mobile-scan-flash mobile-scan-flash-sky" : ""}`}
            >
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="itemKitProgress" value={serializeKitProgress(item)} />
              <ProductThumb imageUrl={item.imageUrl} name={item.name} />

              <div className={`flex items-start justify-between ${isCurrentItem ? "gap-4" : "gap-3"}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`${isCurrentItem ? "text-base" : "text-sm"} font-bold text-slate-900 dark:text-white`}>
                      {item.sku}
                    </p>
                    <span
                      className={`rounded-full ${isCurrentItem ? "px-3 py-1" : "px-2 py-0.5"} text-[10px] font-bold uppercase tracking-wider ${
                        isCurrentItem
                          ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                          : isCompleted
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      }`}
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
                  <p className={`mt-1.5 ${isCurrentItem ? "text-sm" : "line-clamp-2 text-xs"} font-medium text-slate-600 dark:text-slate-400`}>
                    {item.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-500">
                    <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">Cod. {item.code}</span>
                    {!isCurrentItem ? (
                      <span className="bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                        {item.requestedQuantity} {item.unit}
                      </span>
                    ) : null}
                  </div>
                </div>
                {isCurrentItem ? (
                  <span className="shrink-0 rounded-xl bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {item.requestedQuantity} {item.unit}
                  </span>
                ) : null}
              </div>

              <div className={`${isCurrentItem ? "mt-4" : "mt-3"} space-y-2`}>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span>Progresso</span>
                  <span>
                    {separatedQuantity} / {item.requestedQuantity} {item.unit}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCompleted ? "bg-emerald-500" : isCurrentItem ? "bg-primary-500" : "bg-amber-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((separatedQuantity / Math.max(item.requestedQuantity, 1)) * 100),
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div
                className={`rounded-2xl border border-slate-200/50 dark:border-zinc-700/50 bg-slate-50 dark:bg-zinc-950/40 ${isCurrentItem ? "mt-4 px-4 py-3" : "mt-3 px-3 py-2.5"}`}
              >
                <div className={`flex ${isCurrentItem ? "flex-col" : "items-center justify-between gap-3"}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    EAN/GTIN esperado
                  </p>
                  <p className={`${isCurrentItem ? "mt-1 text-sm" : "text-sm"} font-bold text-slate-800 dark:text-white`}>
                    {item.barcode || "-"}
                  </p>
                </div>
              </div>

              <div className={`${isCurrentItem ? "mt-4" : "mt-3"} grid grid-cols-2 gap-3`}>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
                    className={`h-11 w-full rounded-xl border px-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors ${
                      isCurrentItem ? "border-primary-500/40 bg-white dark:bg-zinc-900" : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                    }`}
                  />
                </label>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status
                  </span>
                  <div className={`flex h-11 items-center rounded-xl border px-3 text-sm font-bold transition-colors ${
                    missing > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  }`}>
                    {missing > 0 ? `Faltam ${missing}` : "Completo"}
                  </div>
                </div>
              </div>

              <div className={`${isCurrentItem ? "mt-5" : "mt-4"} space-y-3`}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Endereços sugeridos
                </p>
                {item.isKit && item.kitComponents.length ? (
                  <div className="space-y-3">
                    {item.kitComponents.map((component) => (
                      <div
                        key={`${item.id}-${component.componentProductId}`}
                        className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{component.sku}</p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              GTIN {component.barcode || "-"}
                            </p>
                          </div>
                          <p className="text-xs font-bold text-primary-600 dark:text-primary-400">
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
                      className={`rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${isCurrentItem ? "px-4 py-3.5 shadow-sm" : "px-3 py-3"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                            <MapPinned className="h-4 w-4 shrink-0 text-primary-500" />
                            <span className={`${isCurrentItem ? "text-sm" : "text-sm"} font-bold`}>
                              {line.addressCode}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                              {line.area}
                            </span>
                            <span>{line.routeLabel}</span>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-xl border border-primary-500/20 bg-primary-500/10 px-3 py-2 text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 dark:text-primary-400">
                            Coletar
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-primary-700 dark:text-primary-300">
                            {line.quantity} {item.unit}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 px-3 py-2 border border-slate-100 dark:border-zinc-800">
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                            Lote
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-800 dark:text-white">{line.lot}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 px-3 py-2 border border-slate-100 dark:border-zinc-800">
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                            Validade
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-800 dark:text-white">{line.expiry}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-4 text-sm font-medium text-amber-700 dark:text-amber-400 text-center">
                    Sem endereço sugerido.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Floating Action Bar */}
      <div className="sticky bottom-4 z-40 mt-8 rounded-[28px] border border-slate-200/50 dark:border-zinc-700/50 bg-white/80 dark:bg-zinc-900/80 p-5 shadow-2xl backdrop-blur-xl max-w-2xl mx-auto w-full">
        {isWarningVisible ? (
          <div className="mb-4 rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-500/10 to-amber-500/5 px-4 py-3 text-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-rose-600 dark:text-rose-400">
              Atenção operacional
            </p>
            <p className="mt-1 font-bold text-slate-800 dark:text-white">Pedido em risco de voltar para a fila.</p>
            <p className="mt-1 font-medium text-slate-600 dark:text-slate-300">
              Retome a separação em até <span className="font-bold text-rose-600 dark:text-rose-400">{countdownSeconds}s</span>.
            </p>
          </div>
        ) : null}

        <div className="mb-3 flex items-center justify-between gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
          <span>{completionPercent}% concluído</span>
          <span>{pendingUnits} un pendente(s)</span>
        </div>

        <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-infinya-gradient transition-all"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-1">
          <Button
            type="submit"
            name="intent"
            value="complete"
            className="h-14 rounded-2xl bg-infinya-gradient text-white hover:opacity-90 shadow-lg shadow-primary-500/25 transition-all text-base font-bold"
            disabled={isSubmitting}
            onClick={() => setIsSubmitting(true)}
          >
            {isSubmitting ? "Processando separação..." : "Concluir Separação"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 bg-white/60 dark:bg-zinc-950/40 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{value}</p>
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
        className={`${dimensions} flex items-center justify-center overflow-hidden border border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500`}
      >
        Sem foto
      </div>
    );
  }

  return (
    <div
      className={`${dimensions} overflow-hidden border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900`}
    >
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
