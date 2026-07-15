"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Barcode, Camera, CameraOff, Focus, Volume2 } from "lucide-react";
import { saveShippingConferenceAction } from "@/app/(dashboard)/expedicao/conferencia/actions";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { Button } from "@/components/ui/button";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { PickingOperatorOption } from "@/lib/shipping-picking";
import type { ShippingConferenceOrder } from "@/lib/shipping-conference";

type MobileConferencePanelProps = {
  order: ShippingConferenceOrder;
  operators: PickingOperatorOption[];
  currentUserId: string;
  feedback?: string;
};

type ConferenceItemState = ShippingConferenceOrder["items"][number] & {
  confirmedQuantityValue: string;
};

type ScanFeedbackTone = "success" | "error";

type ScanHistoryEntry = {
  id: string;
  text: string;
  tone: ScanFeedbackTone;
};

export function MobileConferencePanel({
  order,
  operators,
  currentUserId,
  feedback,
}: MobileConferencePanelProps) {
  const router = useRouter();
  const [selectedOperatorId, setSelectedOperatorId] = useState(
    order.assignedOperatorId ?? currentUserId,
  );
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
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wrongProductScans, setWrongProductScans] = useState(order.wrongProductScans);
  const [recentScannedItemId, setRecentScannedItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
      router.replace("/m/conferencia?feedback=inatividade");
    },
  });

  const completionPercent = useMemo(() => {
    const requested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
    const confirmed = items.reduce(
      (sum, item) => sum + normalizeQuantity(item.confirmedQuantityValue),
      0,
    );
    return requested > 0 ? Math.min(100, Math.round((confirmed / requested) * 100)) : 0;
  }, [items]);

  const pendingUnits = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Math.max(item.requestedQuantity - normalizeQuantity(item.confirmedQuantityValue), 0),
        0,
      ),
    [items],
  );

  const quantityDivergentItems = useMemo(
    () =>
      items.filter(
        (item) => normalizeQuantity(item.confirmedQuantityValue) !== item.requestedQuantity,
      ).length,
    [items],
  );

  const nextItem = useMemo(
    () =>
      items.find(
        (item) => normalizeQuantity(item.confirmedQuantityValue) < item.requestedQuantity,
      ) ?? null,
    [items],
  );

  const orderedItems = useMemo(() => {
    return [...items]
      .filter((item) => !nextItem || item.id !== nextItem.id)
      .sort((left, right) => {
      const leftConfirmed = normalizeQuantity(left.confirmedQuantityValue);
      const rightConfirmed = normalizeQuantity(right.confirmedQuantityValue);
      const leftPending = leftConfirmed < left.requestedQuantity;
      const rightPending = rightConfirmed < right.requestedQuantity;

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

  useEffect(() => {
    if (!activeItemId) {
      return;
    }

    itemRefs.current[activeItemId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeItemId]);

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
    oscillator.stop(context.currentTime + 0.12);
    oscillator.onended = () => void context.close();
  }

  function setFeedback(message: string, tone: ScanFeedbackTone) {
    setScanMessage(message);
    setScanTone(tone);
    playFeedbackTone(tone);
  }

  function pushScanHistory(text: string, tone: ScanFeedbackTone) {
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
        item.id === itemId && !item.isKit ? { ...item, confirmedQuantityValue: value } : item,
      ),
    );
  }

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
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
      setWrongProductScans((current) => current + 1);
      const message = "Código não encontrado neste pedido.";
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
        setWrongProductScans((current) => current + 1);
        message = `Kit ${matchedItem.sku} localizado, mas o componente lido não está mapeado.`;
        setFeedback(message, "error");
        pushScanHistory(message, "error");
        if (!cameraEnabled) {
          focusScanInput();
        }
        return;
      }

      if (matchedComponent.confirmedQuantity >= matchedComponent.requestedQuantity) {
        setActiveItemId(matchedItem.id);
        message = `Componente ${matchedComponent.sku} já conferido por completo.`;
        setFeedback(message, "error");
        pushScanHistory(message, "error");
        if (!cameraEnabled) {
          focusScanInput();
        }
        return;
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

      message = `${matchedItem.sku}: ${matchedComponent.sku} ${nextComponentQuantity}/${matchedComponent.requestedQuantity}. Total ${nextTotalConfirmed}/${matchedItem.requestedQuantity}.`;
    } else {
      const currentConfirmed = normalizeQuantity(matchedItem.confirmedQuantityValue);
      if (currentConfirmed >= matchedItem.requestedQuantity) {
        setActiveItemId(matchedItem.id);
        message = `O item ${matchedItem.sku} já foi totalmente conferido.`;
        setFeedback(message, "error");
        pushScanHistory(message, "error");
        if (!cameraEnabled) {
          focusScanInput();
        }
        return;
      }

      const nextConfirmed = Math.min(currentConfirmed + 1, matchedItem.requestedQuantity);

      setItems((current) =>
        current.map((item) =>
          item.id === matchedItem.id
            ? { ...item, confirmedQuantityValue: String(nextConfirmed) }
            : item,
        ),
      );

      message = `${matchedItem.sku}: ${nextConfirmed}/${matchedItem.requestedQuantity} conferido(s).`;
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
    <form action={saveShippingConferenceAction} className="space-y-4" aria-busy={isSubmitting}>
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="Conferência pausada por inatividade"
        description="O operador ficou sem interação nesta conferência. Se a atividade não for retomada, o pedido será devolvido automaticamente para a fila."
        mobileDescription="Sem interação na conferência. Retome agora ou o pedido volta para a fila."
      />

      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="operatorId" value={selectedOperatorId} />
      <input type="hidden" name="wrongProductScans" value={String(wrongProductScans)} />
      <input type="hidden" name="redirectBase" value="/m/conferencia" />
      <input type="hidden" name="completeRedirectTo" value="/m/conferencia?feedback=concluido" />

      {feedback ? (
        <section
          className={`rounded-[24px] border p-4 text-sm ${
            feedback === "concluido"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-400/30 bg-amber-500/10 text-amber-100"
          }`}
        >
          {feedback === "concluido"
            ? "Conferência concluída com sucesso."
            : feedback === "incompleto"
              ? "Ainda existem itens pendentes. O pedido voltou para a fila."
              : feedback === "inatividade"
                ? "Pedido devolvido para a fila por inatividade do operador."
                : "Não foi possível concluir a operação solicitada."}
        </section>
      ) : null}

      {(wrongProductScans > 0 || quantityDivergentItems > 0) && (
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Alertas de divergência</p>
              {wrongProductScans > 0 ? (
                <p>Produto errado lido: {wrongProductScans} ocorrência(s).</p>
              ) : null}
              {quantityDivergentItems > 0 ? (
                <p>Itens com divergência de quantidade: {quantityDivergentItems}.</p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              Conferência em andamento
            </p>
            <h1 className="mt-2 text-xl font-semibold text-white">{order.displayNumber}</h1>
            <p className="mt-1 text-sm text-slate-300">
              {order.customer} • {order.destination}
            </p>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
            {completionPercent}%
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniInfo label="Pendentes" value={`${pendingUnits} un`} />
          <MiniInfo label="Divergências" value={String(quantityDivergentItems)} />
        </div>
      </section>

      {nextItem ? (
        <section className="rounded-[28px] border border-amber-400/35 bg-gradient-to-br from-amber-500/18 via-amber-500/10 to-slate-950 p-4 shadow-lg shadow-amber-950/20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
            Item em foco
          </p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-white">{nextItem.sku}</p>
              <p className="mt-1 text-sm text-slate-200">{nextItem.name}</p>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
              Prioridade
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <InfoBadge label="Pedido" value={`${nextItem.requestedQuantity}`} />
            <InfoBadge label="Separado" value={`${nextItem.separatedQuantity}`} />
            <InfoBadge
              label="Falta"
              value={`${Math.max(
                nextItem.requestedQuantity - normalizeQuantity(nextItem.confirmedQuantityValue),
                0,
              )}`}
            />
          </div>
          <div className="mt-3 rounded-2xl border border-amber-400/30 bg-slate-950/40 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              EAN/GTIN esperado
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{nextItem.barcode || "-"}</p>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-300 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (normalizeQuantity(nextItem.confirmedQuantityValue) /
                        Math.max(nextItem.requestedQuantity, 1)) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
            <p className="text-sm text-slate-100">
              Confira este item antes de seguir para os demais.
            </p>
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Operador
          </span>
          <select
            value={selectedOperatorId}
            onChange={(event) => {
              resetTimer();
              setSelectedOperatorId(event.target.value);
            }}
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none"
          >
            <option value="">Selecionar operador</option>
            {operators.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Leitura
          </span>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 p-2">
            <Barcode className="h-4 w-4 text-slate-400" />
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
              className="h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => applyScan(scanValue)}
              className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950"
            >
              Ler
            </button>
          </div>

          {scanMessage ? (
            <div
              className={`rounded-2xl border px-3 py-3 text-sm ${
                scanTone === "success"
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-400/25 bg-rose-500/10 text-rose-200"
              }`}
            >
              {scanMessage}
            </div>
          ) : null}

          {scanHistory.length ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Últimos scans
              </p>
              <div className="mt-2 space-y-2">
                {scanHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-xl px-3 py-2 text-xs ${
                      entry.tone === "success"
                        ? "bg-emerald-500/10 text-emerald-200"
                        : "bg-rose-500/10 text-rose-200"
                    }`}
                  >
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleCamera}
              disabled={!cameraSupported}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                cameraEnabled
                  ? "bg-rose-500 text-white"
                  : "bg-amber-500 text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
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
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200"
            >
              <Focus className="h-4 w-4" />
              Focar
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200"
            >
              <Volume2 className="h-4 w-4" />
              {soundEnabled ? "Som ativo" : "Som desligado"}
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`aspect-video w-full object-cover transition ${
                cameraEnabled || cameraStarting ? "opacity-100" : "opacity-35"
              }`}
            />
          </div>

          <p className="text-xs text-slate-400">
            {cameraMessage ??
              (cameraSupported
                ? "Abra a câmera para conferir pelo celular ou notebook sem depender do teclado."
                : "Seu navegador atual não liberou leitura por câmera. O leitor USB e o campo manual continuam disponíveis.")}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        {orderedItems.map((item) => {
          const confirmedQuantity = normalizeQuantity(item.confirmedQuantityValue);
          const missing = Math.max(item.requestedQuantity - confirmedQuantity, 0);
          const hasDivergence = confirmedQuantity !== item.requestedQuantity;
          const isCurrentItem = nextItem?.id === item.id;
          const isCompleted = !hasDivergence && missing === 0;
          const isActiveItem = activeItemId === item.id;
          const isRecentlyScanned = recentScannedItemId === item.id;

          return (
            <div
              key={item.id}
              ref={(element) => {
                itemRefs.current[item.id] = element;
              }}
              className={`border ${
                isCurrentItem
                  ? "rounded-[24px] border-amber-400/40 bg-gradient-to-br from-amber-500/18 via-amber-500/8 to-slate-950 p-4 shadow-lg shadow-amber-950/20"
                  : isCompleted
                    ? "rounded-[20px] border-emerald-400/25 bg-emerald-500/10 p-3.5"
                    : isActiveItem
                      ? "rounded-[20px] border-amber-300/30 bg-amber-500/10 p-3.5"
                      : "rounded-[20px] border-white/10 bg-white/5 p-3.5"
              } ${isRecentlyScanned ? "mobile-scan-flash mobile-scan-flash-amber" : ""}`}
            >
              <input type="hidden" name="itemKitProgress" value={serializeKitProgress(item)} />
              <input type="hidden" name="itemId" value={item.id} />

              <div className={`flex items-start justify-between ${isCurrentItem ? "gap-3" : "gap-2.5"}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`${isCurrentItem ? "text-sm" : "text-[13px]"} font-semibold text-white`}>
                      {item.sku}
                    </p>
                    <span
                      className={`rounded-full ${isCurrentItem ? "px-2.5 py-1" : "px-2 py-0.5"} text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        isCurrentItem
                          ? "bg-amber-400/15 text-amber-100"
                          : isCompleted
                            ? "bg-emerald-400/15 text-emerald-100"
                            : "bg-rose-400/15 text-rose-100"
                      }`}
                    >
                      {isRecentlyScanned
                        ? "Lido agora"
                        : isCurrentItem
                          ? "Em foco"
                          : isCompleted
                            ? "Completo"
                            : "Conferir"}
                    </span>
                  </div>
                  <p className={`mt-1 ${isCurrentItem ? "text-sm" : "line-clamp-2 text-[13px]"} text-slate-300`}>
                    {item.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                    <span>Cod. {item.code}</span>
                    {!isCurrentItem ? <span>/</span> : null}
                    {!isCurrentItem ? (
                      <span>
                        {item.requestedQuantity} {item.unit}
                      </span>
                    ) : null}
                  </div>
                </div>
                {isCurrentItem ? (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200">
                    {item.requestedQuantity} {item.unit}
                  </span>
                ) : null}
              </div>

              <div className={`${isCurrentItem ? "mt-3" : "mt-2"} space-y-2`}>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Progresso do item</span>
                  <span>
                    {confirmedQuantity}/{item.requestedQuantity} {item.unit}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCompleted ? "bg-emerald-300" : isCurrentItem ? "bg-amber-300" : "bg-rose-300"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((confirmedQuantity / Math.max(item.requestedQuantity, 1)) * 100),
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div
                className={`rounded-2xl border border-amber-400/20 bg-slate-950/40 ${isCurrentItem ? "mt-3 px-3 py-3" : "mt-2 px-3 py-2.5"}`}
              >
                <div className={`flex ${isCurrentItem ? "flex-col" : "items-center justify-between gap-3"}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    EAN/GTIN esperado
                  </p>
                  <p className={`${isCurrentItem ? "mt-1 text-sm" : "text-[13px]"} font-semibold text-white`}>
                    {item.barcode || "-"}
                  </p>
                </div>
              </div>
              {item.isKit && item.kitComponents.length ? (
                <div className="mt-3 space-y-2">
                  {item.kitComponents.map((component) => (
                    <div
                      key={`${item.id}-${component.componentProductId}`}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{component.sku}</p>
                          <p className="text-[11px] text-slate-400">GTIN {component.barcode || "-"}</p>
                        </div>
                        <p className="text-xs font-semibold text-amber-200">
                          {component.confirmedQuantity}/{component.requestedQuantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={`${isCurrentItem ? "mt-4" : "mt-3"} grid grid-cols-3 gap-2`}>
                <InfoBadge label="Pedido" value={`${item.requestedQuantity}`} />
                <InfoBadge label="Separado" value={`${item.separatedQuantity}`} />
                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Conferido
                  </span>
                  <input
                    type="number"
                    name="confirmedQuantity"
                    min={0}
                    max={item.requestedQuantity}
                    step={1}
                    value={item.confirmedQuantityValue}
                    onChange={(event) => updateQuantity(item.id, event.target.value)}
                    readOnly={item.isKit}
                    className={`h-11 w-full rounded-2xl border px-3 text-sm text-white outline-none ${
                      isCurrentItem
                        ? "border-amber-300/40 bg-amber-950/30"
                        : "border-white/10 bg-slate-900"
                    }`}
                  />
                </label>
              </div>

              <div className={`${isCurrentItem ? "mt-3" : "mt-2.5"} flex items-center justify-between gap-3`}>
                <p className={`text-slate-400 ${isCurrentItem ? "text-xs" : "text-[11px]"}`}>
                  Ref. externa: {item.externalReference}
                </p>
                {hasDivergence ? (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                    Divergência
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                    OK
                  </span>
                )}
              </div>

              <p
                className={`${isCurrentItem ? "mt-3 text-sm" : "mt-2 text-[13px]"} ${missing > 0 ? "text-amber-200" : "text-emerald-300"}`}
              >
                {missing > 0 ? `Faltam ${missing} ${item.unit}.` : "Item conferido."}
              </p>
            </div>
          );
        })}
      </section>

      <div className="sticky bottom-20 z-20 rounded-[24px] border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
        {isWarningVisible ? (
          <div className="mb-3 rounded-2xl border border-rose-400/30 bg-gradient-to-r from-rose-500/15 to-amber-500/10 px-4 py-3 text-sm text-rose-50">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-200">
              Atenção operacional
            </p>
            <p className="mt-1 font-semibold">Pedido em risco de voltar para a fila.</p>
            <p className="mt-1 text-rose-100/90">
              Retome a conferência em até <span className="font-bold">{countdownSeconds}s</span>.
            </p>
          </div>
        ) : null}

        <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>{completionPercent}% concluído</span>
          <span>{pendingUnits} un pendente(s)</span>
        </div>

        <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-300 transition-all"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button
            type="submit"
            name="intent"
            value="complete"
            className="h-11 bg-amber-500 text-slate-950 hover:bg-amber-400"
            disabled={isSubmitting}
            onClick={() => setIsSubmitting(true)}
          >
            {isSubmitting ? "Processando conferência..." : "Concluir conferência"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
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

function matchesItemScan(item: ConferenceItemState, normalizedScan: string) {
  return item.scanTargets
    .filter(Boolean)
    .some((value) => normalizeScan(value) === normalizedScan);
}

function findMatchingKitComponent(item: ConferenceItemState, normalizedScan: string) {
  return item.kitComponents.find((component) =>
    [component.barcode, component.sku]
      .filter(Boolean)
      .some((value) => normalizeScan(value) === normalizedScan),
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
