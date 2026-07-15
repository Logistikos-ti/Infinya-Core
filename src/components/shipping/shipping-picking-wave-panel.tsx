"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Barcode, Camera, CameraOff, Focus, ListOrdered, MapPinned, PackageCheck, ScanSearch, Sparkles, Volume2 } from "lucide-react";
import {
  resetPickingOrdersToQueueAction,
  savePickingWaveProgressAction,
} from "@/app/(dashboard)/expedicao/separacao/actions";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { ShippingPickingOrder } from "@/lib/shipping-picking";

type ShippingPickingWavePanelProps = {
  orders: ShippingPickingOrder[];
  currentUserId: string;
  currentUserName: string;
  returnTo: string;
  expireRedirectTo: string;
  completeRedirectTo: string;
};

type WavePickingItemState = ShippingPickingOrder["items"][number] & {
  compositeId: string;
  orderId: string;
  orderCode: string;
  orderExternalNumber: string;
  orderCustomer: string;
  orderDepositante: string;
  separatedQuantityValue: string;
};

type ConsolidatedStop = {
  key: string;
  addressCode: string;
  area: string;
  routeLabel: string;
  totalQuantity: number;
  pendingQuantity: number;
  lines: Array<{
    compositeId: string;
    orderExternalNumber: string;
    sku: string;
    name: string;
    barcode: string;
    quantity: number;
    unit: string;
    lot: string;
    expiry: string;
  }>;
};

type ScanFeedbackTone = "success" | "error";

export function ShippingPickingWavePanel({
  orders,
  currentUserId,
  currentUserName,
  returnTo,
  expireRedirectTo,
  completeRedirectTo,
}: ShippingPickingWavePanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<WavePickingItemState[]>(
    flattenWaveItems(orders),
  );
  const [scanValue, setScanValue] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanTone, setScanTone] = useState<ScanFeedbackTone>("success");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [operatorMode, setOperatorMode] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, startResetTransition] = useTransition();
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const orderIds = useMemo(() => orders.map((order) => order.id), [orders]);
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
    disabled: isSubmitting || isResetting,
    onExpire: () => {
      resetWaveToQueue("inatividade");
    },
  });

  const resetWaveToQueue = useCallback(
    (reason: "cancelado" | "inatividade") => {
      startResetTransition(async () => {
        await resetPickingOrdersToQueueAction(orderIds, reason);
        router.replace(
          `${expireRedirectTo}${expireRedirectTo.includes("?") ? "&" : "?"}feedback=${reason}&ids=${encodeURIComponent(orderIds.join(","))}`,
        );
      });
    },
    [expireRedirectTo, orderIds, router],
  );

  const summary = useMemo(() => {
    const orderCount = orders.length;
    const itemCount = items.length;
    const totalUnits = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
    const separatedUnits = items.reduce(
      (sum, item) => sum + normalizeQuantity(item.separatedQuantityValue),
      0,
    );
    return {
      orderCount,
      itemCount,
      totalUnits,
      separatedUnits,
      pendingUnits: Math.max(totalUnits - separatedUnits, 0),
      completionPercent:
        totalUnits > 0 ? Math.min(100, Math.round((separatedUnits / totalUnits) * 100)) : 0,
    };
  }, [items, orders.length]);

  const consolidatedStops = useMemo(() => buildConsolidatedStops(items), [items]);
  const nextStop = useMemo(
    () => consolidatedStops.find((stop) => stop.pendingQuantity > 0) ?? null,
    [consolidatedStops],
  );
  const prioritizedItems = useMemo(
    () => [...items].sort(compareWaveItemsForPicking),
    [items],
  );

  useEffect(() => {
    if (!operatorMode || cameraEnabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [cameraEnabled, operatorMode]);

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
    setScanMessage(message);
    setScanTone(tone);
    playFeedbackTone(tone);
  }

  function updateItemQuantity(compositeId: string, value: string) {
    resetTimer();
    setItems((current) =>
      current.map((item) =>
        item.compositeId === compositeId && !item.isKit
          ? { ...item, separatedQuantityValue: value }
          : item,
      ),
    );
  }

  function applyScannedCode(rawValue: string) {
    const normalizedScan = normalizeScanValue(rawValue);

    if (!normalizedScan) {
      setFeedback("Informe ou leia um codigo para localizar o item.", "error");
      return false;
    }

    const matchedItem = items.find((item) => matchesItemScan(item, normalizedScan));

    if (!matchedItem) {
      setActiveItemId(null);
      setFeedback("Codigo nao encontrado nesta onda de separacao.", "error");
      return false;
    }

    if (matchedItem.isKit && matchedItem.kitComponents.length > 0) {
      const matchedComponent = findMatchingKitComponent(matchedItem, normalizedScan);

      if (!matchedComponent) {
        setActiveItemId(matchedItem.compositeId);
        setFeedback(
          `O kit ${matchedItem.sku} foi localizado, mas o componente lido nao esta mapeado.`,
          "error",
        );
        return false;
      }

      if (matchedComponent.separatedQuantity >= matchedComponent.requestedQuantity) {
        setActiveItemId(matchedItem.compositeId);
        setFeedback(
          `O componente ${matchedComponent.sku} ja atingiu ${matchedComponent.requestedQuantity}/${matchedComponent.requestedQuantity}.`,
          "error",
        );
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
          item.compositeId === matchedItem.compositeId
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

      setActiveItemId(matchedItem.compositeId);
      setFeedback(
        `Kit ${matchedItem.sku}: componente ${matchedComponent.sku} ${nextComponentQuantity}/${matchedComponent.requestedQuantity}.`,
        "success",
      );
    } else {
      const currentSeparated = normalizeQuantity(matchedItem.separatedQuantityValue);

      if (currentSeparated >= matchedItem.requestedQuantity) {
        setActiveItemId(matchedItem.compositeId);
        setFeedback(`O item ${matchedItem.sku} ja esta completo.`, "error");
        return false;
      }

      const nextSeparated = Math.min(currentSeparated + 1, matchedItem.requestedQuantity);

      setItems((current) =>
        current.map((item) =>
          item.compositeId === matchedItem.compositeId
            ? { ...item, separatedQuantityValue: String(nextSeparated) }
            : item,
        ),
      );

      setActiveItemId(matchedItem.compositeId);
      setFeedback(
        `Leitura aplicada em ${matchedItem.sku}. Total: ${nextSeparated}/${matchedItem.requestedQuantity}.`,
        "success",
      );
    }

    setScanValue("");
    resetTimer();

    requestAnimationFrame(() => {
      quantityInputRefs.current[matchedItem.compositeId]?.focus();
      quantityInputRefs.current[matchedItem.compositeId]?.select();
      if (operatorMode && !cameraEnabled) {
        focusScanInput();
      }
    });

    return true;
  }

  function handleScanSubmit() {
    applyScannedCode(scanValue);
  }

  return (
    <div className="space-y-5">
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="Separacao pausada por inatividade"
        description="O operador ficou sem interacao nesta onda de separacao. Se a atividade nao for retomada, os pedidos voltam automaticamente para a fila."
        mobileDescription="Sem interacao na separacao. Retome agora ou a onda volta para a fila."
      />

      <div className="glass-card rounded-3xl border border-slate-200/50 p-6 shadow-sm transition-all hover:border-primary-500/30 dark:border-zinc-800/50">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                Onda em execucao
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {summary.orderCount} pedidos
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {summary.itemCount} itens
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {summary.totalUnits} unidades
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
              Lista consolidada de separacao
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
              Selecao agrupada por operador. Leia os itens, confirme as quantidades e conclua a onda.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-zinc-500">
              <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                Operador: {currentUserName}
              </span>
              <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                Pedidos: {orders.map((order) => order.externalNumber).join(", ")}
              </span>
              <span className="rounded-md border border-primary-500/20 bg-primary-500/10 px-2 py-1 text-primary-700 dark:text-primary-300">
                {summary.completionPercent}% concluido
              </span>
            </div>
          </div>

          <div className="grid min-w-[220px] gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
            <InfoMini label="Separado" value={`${summary.separatedUnits} un`} />
            <InfoMini label="Pendente" value={`${summary.pendingUnits} un`} />
            <InfoMini label="Paradas" value={`${consolidatedStops.length}`} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="glass-card rounded-3xl border border-slate-200/50 p-5 shadow-sm dark:border-zinc-800/50">
            <div className="space-y-3">
              <span className="block text-sm font-bold text-slate-700 dark:text-zinc-300">
                Leitura de codigo de barras
              </span>
              <div className="flex items-center gap-2 rounded-2xl border-2 border-primary-500/30 bg-white p-2 shadow-inner transition-all focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 dark:bg-zinc-900">
                <Barcode className="ml-2 h-5 w-5 text-primary-500" />
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
                      handleScanSubmit();
                    }
                  }}
                  onBlur={() => {
                    if (operatorMode && !cameraEnabled) {
                      window.setTimeout(() => {
                        scanInputRef.current?.focus();
                      }, 40);
                    }
                  }}
                  placeholder="Leia EAN/GTIN ou SKU"
                  className="h-10 w-full border-0 bg-transparent px-2 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleScanSubmit}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <ScanSearch className="h-4 w-4" />
                  Ler
                </button>
              </div>
              <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-zinc-500">
                Funciona com leitor USB em modo teclado. Em caso de produto repetido, a leitura cai no
                primeiro item pendente da onda.
              </p>
              {scanMessage ? (
                <div
                  className={`mt-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                    scanTone === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  }`}
                >
                  {scanMessage}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleCamera}
                disabled={!cameraSupported}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  cameraEnabled
                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/20 hover:bg-rose-600"
                    : "bg-primary-500 text-white shadow-md shadow-primary-500/20 hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                }`}
              >
                {cameraEnabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                {cameraStarting ? "Abrindo camera..." : cameraEnabled ? "Desligar camera" : "Ler pela camera"}
              </button>

              <button
                type="button"
                onClick={() => setOperatorMode((current) => !current)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  operatorMode
                    ? "bg-primary-500 text-white shadow-md shadow-primary-500/20 hover:bg-primary-600"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {operatorMode ? "Modo operador ativo" : "Ativar modo operador"}
              </button>

              <button
                type="button"
                onClick={() => setSoundEnabled((current) => !current)}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  soundEnabled
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <Volume2 className="h-4 w-4" />
                {soundEnabled ? "Som ativo" : "Ativar som"}
              </button>

              <button
                type="button"
                onClick={focusScanInput}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <Focus className="h-4 w-4" />
                Focar leitura
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-zinc-700">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`aspect-video w-full object-cover transition ${
                  cameraEnabled || cameraStarting ? "opacity-100" : "opacity-35"
                }`}
              />
            </div>

            <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-zinc-500">
              {cameraMessage ??
                (cameraSupported
                  ? "Compativel com celular e notebook. Abra a camera e aponte para o EAN/GTIN do produto."
                  : "Seu navegador atual nao liberou leitura por camera. O leitor USB e o campo manual continuam disponiveis.")}
            </p>
          </div>

          <div className="glass-card rounded-3xl border border-slate-200/50 p-5 shadow-sm dark:border-zinc-800/50">
            {nextStop ? (
              <div className="mb-5 rounded-3xl border border-primary-500/20 bg-primary-500/10 p-4">
                <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300">
                  <Sparkles className="h-4 w-4" />
                  <p className="text-xs font-bold uppercase tracking-[0.22em]">Proxima coleta</p>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-slate-950 dark:text-white">{nextStop.addressCode}</p>
                  <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-300">
                    {nextStop.area} - {nextStop.routeLabel}
                  </p>
                  <p className="mt-3 inline-flex rounded-xl border border-primary-500/20 bg-white/70 px-3 py-1.5 text-xs font-bold text-primary-700 dark:bg-zinc-900/60 dark:text-primary-300">
                    {nextStop.pendingQuantity} unidade(s) pendente(s)
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
              <MapPinned className="h-5 w-5" />
              <h3 className="text-sm font-bold">Rota consolidada</h3>
            </div>

            <div className="mt-5 space-y-3">
              {consolidatedStops.length ? (
                consolidatedStops.map((stop, index) => (
                  <div
                    key={stop.key}
                    className={`rounded-2xl border bg-white/60 p-4 shadow-sm dark:bg-zinc-900/60 ${
                      nextStop?.key === stop.key
                        ? "border-primary-500/40 ring-2 ring-primary-500/15 dark:border-primary-500/40"
                        : "border-slate-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                        Parada {index + 1}
                      </p>
                      {nextStop?.key === stop.key ? (
                        <span className="rounded-full bg-primary-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                          Agora
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                      {stop.addressCode}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-600 dark:text-zinc-400">
                      {stop.area} - {stop.routeLabel}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <p className="inline-block rounded-xl border border-primary-500/20 bg-primary-500/10 px-3 py-1.5 text-xs font-bold text-primary-600 dark:text-primary-400">
                        {stop.totalQuantity} unidade(s)
                      </p>
                      <p className="inline-block rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                        {stop.pendingQuantity} pendente(s)
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-sm font-medium leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-400">
                  Ainda nao encontramos saldo sugerido para esta onda. Revise estoque, picking ou enderecamento antes de iniciar a coleta.
                </div>
              )}
            </div>
          </div>
        </div>

        <form
          action={savePickingWaveProgressAction}
          className="space-y-5"
          aria-busy={isSubmitting || isResetting}
          onSubmit={() => setIsSubmitting(true)}
        >
          {orders.map((order) => (
            <input key={order.id} type="hidden" name="waveOrderId" value={order.id} />
          ))}
          <input type="hidden" name="currentUserId" value={currentUserId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="completeRedirectTo" value={completeRedirectTo} />

          <div className="space-y-4">
            {prioritizedItems.map((item, itemIndex) => {
              const missingQuantity = Math.max(
                item.requestedQuantity - normalizeQuantity(item.separatedQuantityValue),
                0,
              );
              const nextRouteLine = item.routeLines.find((line) => line.quantity > 0) ?? item.routeLines[0] ?? null;
              const isPriorityItem = itemIndex === 0 || activeItemId === item.compositeId;

              return (
                <div
                  key={item.compositeId}
                  className={`rounded-3xl border p-5 shadow-sm transition-all ${
                    activeItemId === item.compositeId
                      ? "border-primary-500/40 bg-gradient-to-br from-primary-500/5 to-transparent"
                      : isPriorityItem
                        ? "border-sky-500/30 bg-sky-500/5"
                      : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <input type="hidden" name="itemOrderId" value={item.orderId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="itemKitProgress" value={serializeKitProgress(item)} />

                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <ProductThumb imageUrl={item.imageUrl} name={item.name} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-primary-500/20 bg-primary-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                            Pedido {item.orderExternalNumber}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {item.orderDepositante}
                          </span>
                          {isPriorityItem ? (
                            <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                              Prioridade
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-base font-bold text-slate-900 dark:text-white">{item.sku}</p>
                        <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-zinc-500">
                          Cliente: {item.orderCustomer}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-500 dark:text-zinc-500">
                          <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                            Codigo {item.code}
                          </span>
                          <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                            Ref. {item.externalReference || "-"}
                          </span>
                          <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
                            GTIN {item.barcode || "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[340px]">
                      <label className="space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                          Separado
                        </span>
                        <input
                          ref={(element) => {
                            quantityInputRefs.current[item.compositeId] = element;
                          }}
                          type="number"
                          name="separatedQuantity"
                          min={0}
                          max={item.requestedQuantity}
                          step={1}
                          value={item.separatedQuantityValue}
                          onChange={(event) => updateItemQuantity(item.compositeId, event.target.value)}
                          readOnly={item.isKit}
                          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-primary-500/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        />
                      </label>

                      <div className="space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                          Status
                        </span>
                        <div
                          className={`flex h-12 items-center rounded-xl border px-4 text-sm font-bold transition-all ${
                            missingQuantity > 0
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {missingQuantity > 0 ? `Faltam ${missingQuantity} ${item.unit}` : "Completo"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {nextRouteLine ? (
                    <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/8 px-4 py-3">
                      <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                        <ListOrdered className="h-4 w-4" />
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em]">
                          Proxima acao
                        </p>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        Ir para {nextRouteLine.addressCode} e coletar {nextRouteLine.quantity} {item.unit}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                        {nextRouteLine.area} - {nextRouteLine.routeLabel}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-5 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                      Enderecos sugeridos
                    </p>
                    {item.isKit && item.kitComponents.length ? (
                      <div className="rounded-2xl border border-primary-500/20 bg-primary-500/5 px-4 py-3 text-sm">
                        <p className="font-bold text-slate-900 dark:text-white">Componentes do kit</p>
                        <div className="mt-2 space-y-2">
                          {item.kitComponents.map((component) => (
                            <div
                              key={`${item.compositeId}-${component.componentProductId}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 dark:bg-zinc-900/70"
                            >
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{component.sku}</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                  GTIN {component.barcode || "-"}
                                </p>
                              </div>
                              <p className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                {component.separatedQuantity}/{component.requestedQuantity}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : item.routeLines.length ? (
                      item.routeLines.map((line) => (
                        <div
                          key={`${item.compositeId}-${line.stockId}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/40"
                        >
                          <div className="font-bold text-slate-900 dark:text-white">
                            {line.addressCode} <span className="px-1 font-medium text-slate-400">-</span> {line.area}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
                            {line.routeLabel}
                          </div>
                          <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            Coletar {line.quantity} {item.unit} - lote {line.lot}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-3 text-center text-sm font-medium text-amber-700 dark:text-amber-400">
                        Sem endereco sugerido.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-4 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-2xl backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/85">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {summary.pendingUnits > 0
                    ? `${summary.pendingUnits} unidade(s) pendente(s)`
                    : "Tudo pronto para concluir a separacao"}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  Ao concluir, os pedidos seguem para a proxima etapa da expedicao.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {summary.orderCount} pedidos
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {summary.itemCount} itens
                  </span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">
                    {summary.separatedUnits} coletadas
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => resetWaveToQueue("cancelado")}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-progress disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  disabled={isSubmitting || isResetting}
                >
                  {isResetting ? "Cancelando..." : "Cancelar separacao"}
                </button>

                <button
                  type="submit"
                  name="intent"
                  value="complete"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-6 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition-all hover:-translate-y-0.5 hover:bg-primary-600 disabled:cursor-progress disabled:opacity-70"
                  disabled={isSubmitting || isResetting}
                >
                  <PackageCheck className="h-4 w-4" />
                  {isSubmitting ? "Concluindo..." : "Concluir separacao"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

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

function buildConsolidatedStops(items: WavePickingItemState[]) {
  const grouped = new Map<string, ConsolidatedStop>();

  for (const item of items) {
    for (const line of item.routeLines) {
      const key = `${line.area}::${line.addressCode}`;
      const current =
        grouped.get(key) ??
        ({
          key,
          addressCode: line.addressCode,
          area: line.area,
          routeLabel: line.routeLabel,
          totalQuantity: 0,
          pendingQuantity: 0,
          lines: [],
        } satisfies ConsolidatedStop);

      current.totalQuantity += line.quantity;
      if (item.remainingQuantity > 0) {
        current.pendingQuantity += Math.min(line.quantity, item.remainingQuantity);
      }
      current.lines.push({
        compositeId: item.compositeId,
        orderExternalNumber: item.orderExternalNumber,
        sku: line.componentSku,
        name: line.componentName,
        barcode: line.componentBarcode,
        quantity: line.quantity,
        unit: item.unit,
        lot: line.lot,
        expiry: line.expiry,
      });

      grouped.set(key, current);
    }
  }

  return [...grouped.values()].sort(compareConsolidatedStops);
}

function serializeKitProgress(item: WavePickingItemState) {
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

function matchesItemScan(item: WavePickingItemState, normalizedScan: string) {
  const scanTargets = item.scanTargets.map(normalizeScanValue).filter(Boolean);
  return scanTargets.includes(normalizedScan);
}

function findMatchingKitComponent(item: WavePickingItemState, normalizedScan: string) {
  return item.kitComponents.find((component) => {
    const scanTargets = [component.barcode, component.sku].map(normalizeScanValue).filter(Boolean);
    return scanTargets.includes(normalizedScan);
  });
}

function normalizeScanValue(value: string) {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

function normalizeQuantity(value: string) {
  const numeric = Number(value.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, numeric);
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function compareWaveItemsForPicking(a: WavePickingItemState, b: WavePickingItemState) {
  const aPending = Math.max(a.requestedQuantity - normalizeQuantity(a.separatedQuantityValue), 0);
  const bPending = Math.max(b.requestedQuantity - normalizeQuantity(b.separatedQuantityValue), 0);

  if (aPending > 0 && bPending <= 0) {
    return -1;
  }

  if (bPending > 0 && aPending <= 0) {
    return 1;
  }

  const firstRouteA = a.routeLines[0];
  const firstRouteB = b.routeLines[0];

  if (firstRouteA && firstRouteB) {
    const areaCompare = firstRouteA.area.localeCompare(firstRouteB.area, "pt-BR");
    if (areaCompare !== 0) {
      return areaCompare;
    }

    const labelCompare = firstRouteA.routeLabel.localeCompare(firstRouteB.routeLabel, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
    if (labelCompare !== 0) {
      return labelCompare;
    }
  }

  return a.orderExternalNumber.localeCompare(b.orderExternalNumber, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

function compareConsolidatedStops(a: ConsolidatedStop, b: ConsolidatedStop) {
  if (a.pendingQuantity > 0 && b.pendingQuantity <= 0) {
    return -1;
  }

  if (b.pendingQuantity > 0 && a.pendingQuantity <= 0) {
    return 1;
  }

  const areaCompare = a.area.localeCompare(b.area, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
  if (areaCompare !== 0) {
    return areaCompare;
  }

  return a.routeLabel.localeCompare(b.routeLabel, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

function ProductThumb({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  if (imageUrl) {
    return (
      <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <Image src={imageUrl} alt={name} fill className="object-cover" sizes="64px" />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
      Sem foto
    </div>
  );
}
