"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Barcode, Camera, CameraOff, Focus, Map, ScanSearch, Volume2 } from "lucide-react";
import { savePickingProgressAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { Button } from "@/components/ui/button";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { PickingOperatorOption, ShippingPickingOrder } from "@/lib/shipping-picking";

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
  operators,
  currentUserId,
  redirectBase = "/expedicao/separacao",
}: ShippingPickingPanelProps) {
  const router = useRouter();
  const defaultOperatorId = order.assignedOperatorId ?? currentUserId;
  const [selectedOperatorId, setSelectedOperatorId] = useState(defaultOperatorId);
  const [items, setItems] = useState<PickingItemState[]>(
    order.items.map((item) => ({
      ...item,
      separatedQuantityValue: String(item.separatedQuantity),
    })),
  );
  const [scanValue, setScanValue] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanTone, setScanTone] = useState<ScanFeedbackTone>("success");
  const [operatorMode, setOperatorMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
      items.reduce((sum, item) => {
        const separated = normalizeQuantity(item.separatedQuantityValue);
        return sum + Math.max(item.requestedQuantity - separated, 0);
      }, 0),
    [items],
  );

  useEffect(() => {
    if (!operatorMode || cameraEnabled) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(focusTimer);
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

  function updateItemQuantity(itemId: string, value: string) {
    resetTimer();
    setItems((current) =>
      current.map((item) =>
        item.id === itemId && !item.isKit
          ? {
              ...item,
              separatedQuantityValue: value,
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
      setFeedback("Código não encontrado nesta separação.", "error");
      return false;
    }

    if (matchedItem.isKit && matchedItem.kitComponents.length > 0) {
      const matchedComponent = findMatchingKitComponent(matchedItem, normalizedScan);

      if (!matchedComponent) {
        setActiveItemId(matchedItem.id);
        setFeedback(`O kit ${matchedItem.sku} foi localizado, mas o componente lido não está mapeado.`, "error");
        return false;
      }

      if (matchedComponent.separatedQuantity >= matchedComponent.requestedQuantity) {
        setActiveItemId(matchedItem.id);
        setFeedback(
          `O componente ${matchedComponent.sku} já atingiu ${matchedComponent.requestedQuantity}/${matchedComponent.requestedQuantity}.`,
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

      setActiveItemId(matchedItem.id);
      setFeedback(
        `Kit ${matchedItem.sku}: componente ${matchedComponent.sku} ${nextComponentQuantity}/${matchedComponent.requestedQuantity}. Total do kit: ${nextTotalSeparated}/${matchedItem.requestedQuantity}.`,
        "success",
      );
    } else {
      const currentSeparated = normalizeQuantity(matchedItem.separatedQuantityValue);
      if (currentSeparated >= matchedItem.requestedQuantity) {
        setActiveItemId(matchedItem.id);
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

      setActiveItemId(matchedItem.id);
      setFeedback(
        `Leitura aplicada em ${matchedItem.sku}. +1 ${matchedItem.unit.toLowerCase()} separado(a). Total: ${nextSeparated}/${matchedItem.requestedQuantity}.`,
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

  return (
    <div className="space-y-5">
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="Separação pausada por inatividade"
        description="O operador ficou sem interação nesta separação. Se a atividade não for retomada, o pedido será devolvido automaticamente para a fila."
        mobileDescription="Sem interação na separação. Retome agora ou o pedido volta para a fila."
      />

      {/* Header Info Card */}
      <div className="glass-card rounded-3xl p-6 shadow-sm border border-slate-200/50 dark:border-zinc-800/50 transition-all hover:border-primary-500/30">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide border ${
                  order.status === 'NOVO' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' : 
                  order.status === 'EM_SEPARACAO' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}>
                {order.statusLabel}
              </span>
              <span className="rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                {order.depositante}
              </span>
              {pendingUnits > 0 ? (
                <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  Pendentes: {pendingUnits} un
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Pronto para concluir
                </span>
              )}
            </div>

            <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{order.externalNumber}</h2>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
              {order.customer} <span className="px-1 text-slate-300 dark:text-zinc-600">•</span> {order.destination}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-zinc-500">
              <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">Código int {order.code}</span>
              <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">{order.totalItems} item(ns)</span>
              <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">{order.totalUnits} unidade(s)</span>
              <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">{order.routeStopCount} parada(s)</span>
              <span className="bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 px-2 py-1 rounded-md">{completionPercent}% concluído</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/50 px-5 py-4 text-sm shadow-sm backdrop-blur-sm min-w-[200px]">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">Operador Responsável</p>
            <p className="mt-1.5 font-bold text-slate-900 dark:text-white">
              {order.assignedOperatorName ?? "Não atribuído"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left Column Tools */}
        <div className="space-y-5">
          <div className="glass-card rounded-3xl border border-slate-200/50 dark:border-zinc-800/50 p-5 shadow-sm">
            <label className="space-y-2 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Alterar operador
              </span>
              <select
                value={selectedOperatorId}
                onChange={(event) => {
                  resetTimer();
                  setSelectedOperatorId(event.target.value);
                }}
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
              >
                <option value="">Selecionar operador</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-zinc-400">
              <InfoMini label="Início" value={formatDateTime(order.startedAt) || "Ainda não iniciado"} />
              <InfoMini
                label="Última atualização"
                value={formatDateTime(order.updatedAt) || "Sem apontamento"}
              />
            </div>
          </div>

          {/* Scanner Tool */}
          <div className="glass-card rounded-3xl border border-slate-200/50 dark:border-zinc-800/50 p-5 shadow-sm">
            <form onSubmit={handleScanSubmit} className="space-y-3">
              <span className="block text-sm font-bold text-slate-700 dark:text-zinc-300">
                Leitura de código de barras
              </span>
              <div className="flex items-center gap-2 rounded-2xl border-2 border-primary-500/30 bg-white dark:bg-zinc-900 p-2 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all shadow-inner">
                <Barcode className="h-5 w-5 ml-2 text-primary-500" />
                <input
                  ref={scanInputRef}
                  value={scanValue}
                  onChange={(event) => {
                    resetTimer();
                    setScanValue(event.target.value);
                  }}
                  onBlur={() => {
                    if (operatorMode && !cameraEnabled) {
                      window.setTimeout(() => {
                        scanInputRef.current?.focus();
                      }, 40);
                    }
                  }}
                  placeholder="Leia EAN/GTIN ou SKU"
                  className="h-10 w-full border-0 bg-transparent px-2 text-sm font-medium text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 text-sm font-bold text-white dark:text-slate-900 shadow-md transition hover:bg-slate-800 dark:hover:bg-slate-200"
                >
                  <ScanSearch className="h-4 w-4" />
                  Ler
                </button>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 leading-relaxed">
                Funciona com leitor USB no modo teclado: o código cai no campo e o item é apontado.
              </p>
              {scanMessage ? (
                <div className={`mt-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                  scanTone === "success" 
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" 
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                }`}>
                  {scanMessage}
                </div>
              ) : null}
            </form>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleCamera}
                disabled={!cameraSupported}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all flex-1 ${
                  cameraEnabled
                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/20 hover:bg-rose-600"
                    : "bg-primary-500 text-white shadow-md shadow-primary-500/20 hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
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
                onClick={() => setOperatorMode((current) => !current)}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all flex-1 ${
                  operatorMode
                    ? "bg-primary-500 text-white shadow-md shadow-primary-500/20 hover:bg-primary-600"
                    : "border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700"
                }`}
              >
                {operatorMode ? "Modo operador ativo" : "Ativar modo operador"}
              </button>

              <button
                type="button"
                onClick={() => setSoundEnabled((current) => !current)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all flex-1 ${
                  soundEnabled
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600"
                    : "border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700"
                }`}
              >
                <Volume2 className="h-4 w-4" />
                {soundEnabled ? "Som ativo" : "Ativar som"}
              </button>

              <button
                type="button"
                onClick={focusScanInput}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-300 transition-all hover:bg-slate-50 dark:hover:bg-zinc-700 mt-1"
              >
                <Focus className="h-4 w-4" />
                Focar leitura
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-950">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`aspect-video w-full object-cover transition ${
                  cameraEnabled || cameraStarting ? "opacity-100" : "opacity-35"
                }`}
              />
            </div>

            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-zinc-500 leading-relaxed">
              {cameraMessage ??
                (cameraSupported
                  ? "Compatível com celular e notebook. Abra a câmera e aponte para o EAN/GTIN do produto."
                  : "Seu navegador atual não liberou leitura por câmera. O leitor USB e o campo manual continuam disponíveis.")}
            </p>
          </div>

          <div className="glass-card rounded-3xl border border-slate-200/50 dark:border-zinc-800/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
              <Map className="h-5 w-5" />
              <h3 className="text-sm font-bold">Rota sugerida no armazém</h3>
            </div>

            <div className="mt-5 space-y-3">
              {order.routeStops.length ? (
                order.routeStops.map((stop, index) => (
                  <div key={stop.key} className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                      Parada {index + 1}
                    </p>
                    <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">{stop.addressCode}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-600 dark:text-zinc-400">
                      {stop.area} • {stop.routeLabel}
                    </p>
                    <p className="mt-3 inline-block rounded-xl bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 text-xs font-bold text-primary-600 dark:text-primary-400">
                      {stop.totalQuantity} unidade(s)
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 p-4 text-sm font-medium text-amber-800 dark:text-amber-400 text-center leading-relaxed">
                  Ainda não encontramos saldo sugerido para este pedido. Revise estoque, picking ou
                  endereçamento antes de iniciar a coleta.
                </div>
              )}
            </div>
          </div>
        </div>

        <form action={savePickingProgressAction} className="space-y-5" aria-busy={isSubmitting}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="operatorId" value={selectedOperatorId} />
          <input type="hidden" name="redirectBase" value={redirectBase} />
          <input type="hidden" name="completeRedirectTo" value={`/expedicao/conferencia/${order.id}`} />

          <div className="space-y-4 lg:hidden">
            {items.map((item) => {
              const missingQuantity = Math.max(
                item.requestedQuantity - normalizeQuantity(item.separatedQuantityValue),
                0,
              );

              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-5 shadow-sm transition-all ${
                    activeItemId === item.id
                      ? "border-primary-500/40 bg-gradient-to-br from-primary-500/5 to-transparent"
                      : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  }`}
                >
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="itemKitProgress" value={serializeKitProgress(item)} />
                  <ProductThumb imageUrl={item.imageUrl} name={item.name} size="mobile" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <ProductThumb imageUrl={item.imageUrl} name={item.name} size="mobile" />
                      <div className="min-w-0">
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {item.sku}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
                        {item.name}
                      </p>
                      <p className="mt-2 text-xs font-medium text-slate-500 dark:text-zinc-500">
                        Código {item.code} • Ref. {item.externalReference || "-"}
                      </p>
                      <div className="mt-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                          EAN/GTIN esperado
                        </p>
                        <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                          {item.barcode || "-"}
                        </p>
                      </div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-xl bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                      {item.requestedQuantity} {item.unit}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                        Separado
                      </span>
                      <input
                        ref={(element) => {
                          quantityInputRefs.current[item.id] = element;
                        }}
                        type="number"
                        name="separatedQuantity"
                        min={0}
                        max={item.requestedQuantity}
                        step={1}
                        value={item.separatedQuantityValue}
                        onChange={(event) => updateItemQuantity(item.id, event.target.value)}
                        readOnly={item.isKit}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                      />
                    </label>

                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                        Status
                      </span>
                      <div className={`flex h-12 items-center rounded-xl border px-4 text-sm font-bold transition-all ${
                        missingQuantity > 0 
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" 
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      }`}>
                        {missingQuantity > 0 ? `Faltam ${missingQuantity} ${item.unit}` : "Completo"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                      Endereços sugeridos
                    </p>
                    {item.isKit && item.kitComponents.length ? (
                      <div className="rounded-2xl border border-primary-500/20 bg-primary-500/5 px-4 py-3 text-sm">
                        <p className="font-bold text-slate-900 dark:text-white">Componentes do kit</p>
                        <div className="mt-2 space-y-2">
                          {item.kitComponents.map((component) => (
                            <div
                              key={`${item.id}-${component.componentProductId}`}
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
                          key={`${item.id}-${line.stockId}`}
                          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-4 py-3 shadow-sm"
                        >
                          <div className="font-bold text-slate-900 dark:text-white">
                            {line.addressCode} <span className="text-slate-400 font-medium px-1">•</span> {line.area}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-500 dark:text-zinc-400">{line.routeLabel}</div>
                          <div className="mt-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
                            Coletar {line.quantity} {item.unit} <span className="text-slate-300 dark:text-zinc-600 px-1">•</span> lote {line.lot}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-400 text-center">
                        Sem endereço sugerido.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-5 py-4 font-bold text-slate-600 dark:text-zinc-300">SKU / produto</th>
                  <th className="px-5 py-4 font-bold text-slate-600 dark:text-zinc-300">Solicitado</th>
                  <th className="px-5 py-4 font-bold text-slate-600 dark:text-zinc-300">Separado</th>
                  <th className="px-5 py-4 font-bold text-slate-600 dark:text-zinc-300">Sugestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {items.map((item) => {
                  const isCurrentItem = activeItemId === item.id;
                  const missingQuantity = Math.max(item.requestedQuantity - normalizeQuantity(item.separatedQuantityValue), 0);
                  
                  return (
                  <tr
                    key={item.id}
                    className={`align-top transition-colors ${
                      isCurrentItem ? "bg-primary-500/5" : "hover:bg-slate-50/50 dark:hover:bg-zinc-800/30"
                    }`}
                  >
                    <td className="px-5 py-5 text-slate-900 dark:text-white">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="itemKitProgress" value={serializeKitProgress(item)} />
                      <div className="mb-4">
                        <ProductThumb imageUrl={item.imageUrl} name={item.name} size="desktop" />
                      </div>
                      <div className="font-bold text-base mb-1">
                        {item.sku}
                      </div>
                      <div className="font-medium text-sm text-slate-600 dark:text-zinc-400">
                        {item.name}
                      </div>
                      <div className="mt-2 text-xs font-medium text-slate-500 dark:text-zinc-500">
                        Cod. {item.code} <span className="px-1">•</span> Ref. {item.externalReference || "-"}
                      </div>
                      <div className="mt-4 inline-block rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 px-4 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                          EAN/GTIN esperado
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                          {item.barcode || "-"}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-5">
                      <span className="rounded-xl bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 text-sm font-bold text-slate-700 dark:text-zinc-300">
                        {item.requestedQuantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <input
                        ref={(element) => {
                          quantityInputRefs.current[item.id] = element;
                        }}
                        type="number"
                        name="separatedQuantity"
                        min={0}
                        max={item.requestedQuantity}
                        step={1}
                        value={item.separatedQuantityValue}
                        onChange={(event) => updateItemQuantity(item.id, event.target.value)}
                        readOnly={item.isKit}
                        className={`h-11 w-28 rounded-xl border px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/50 transition-all ${
                          isCurrentItem ? "border-primary-500/40 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white" : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white"
                        }`}
                      />
                      {missingQuantity > 0 ? (
                        <p className="mt-3 text-xs font-bold text-amber-600 dark:text-amber-400">
                          Faltam {missingQuantity} {item.unit}.
                        </p>
                      ) : (
                        <p className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">Item completo.</p>
                      )}
                    </td>
                    <td className="px-5 py-5">
                      {item.isKit && item.kitComponents.length ? (
                        <div className="space-y-3">
                          {item.kitComponents.map((component) => (
                            <div
                              key={`${item.id}-${component.componentProductId}`}
                              className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 px-4 py-3 shadow-sm"
                            >
                              <div className="font-bold text-slate-900 dark:text-white mb-1">
                                {component.sku}
                              </div>
                              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-2">
                                GTIN {component.barcode || "-"}
                              </div>
                              <div className="inline-block rounded-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                Bipar {component.requestedQuantity} vez(es) <span className="text-slate-300 dark:text-zinc-600 px-1">•</span> andamento {component.separatedQuantity}/{component.requestedQuantity}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : item.routeLines.length ? (
                        <div className="space-y-3">
                          {item.routeLines.map((line) => (
                            <div
                              key={`${item.id}-${line.stockId}`}
                              className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 px-4 py-3 shadow-sm"
                            >
                              <div className="font-bold text-slate-900 dark:text-white mb-1">
                                {line.addressCode} <span className="text-slate-400 font-medium px-1">•</span> {line.area}
                              </div>
                              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-2">{line.routeLabel}</div>
                              <div className="inline-block rounded-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                Coletar {line.quantity} {item.unit} <span className="text-slate-300 dark:text-zinc-600 px-1">•</span> lote {line.lot}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-400">Sem endereço sugerido</span>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {/* Sticky Desktop Actions */}
          <div className="sticky bottom-4 z-20 mt-6 rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 p-5 shadow-xl backdrop-blur-xl transition-all">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-xl bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 font-bold text-primary-700 dark:text-primary-400">
                {completionPercent}% concluído
              </span>
              <span className="rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 font-semibold text-slate-700 dark:text-zinc-300">
                {pendingUnits} unidade(s) pendente(s)
              </span>
            </div>

            <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-infinya-gradient transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                name="intent"
                value="complete"
                className="h-12 rounded-xl bg-infinya-gradient text-white hover:opacity-90 shadow-md shadow-primary-500/20 transition-all font-bold px-6"
                disabled={isSubmitting}
                onClick={() => setIsSubmitting(true)}
              >
                {isSubmitting ? "Processando separação..." : "Concluir Separação"}
              </Button>
            </div>
          </div>
        </form>
      </div>
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

function matchesItemScan(item: PickingItemState, normalizedScan: string) {
  return item.scanTargets
    .filter(Boolean)
    .some((value) => normalizeScanValue(value) === normalizedScan);
}

function findMatchingKitComponent(item: PickingItemState, normalizedScan: string) {
  return item.kitComponents.find((component) =>
    [component.barcode, component.sku]
      .filter(Boolean)
      .some((value) => normalizeScanValue(value) === normalizedScan),
  );
}

function serializeKitProgress(item: PickingItemState) {
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
  size,
}: {
  imageUrl: string | null;
  name: string;
  size: "mobile" | "desktop";
}) {
  const dimensions = size === "desktop" ? "h-20 w-20 rounded-2xl" : "mb-4 h-16 w-16 rounded-2xl";

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
