"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Focus, MapPinned, Volume2 } from "lucide-react";
import { savePickingProgressAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { Button } from "@/components/ui/button";
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
    const timer = window.setTimeout(() => scanInputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, []);

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
        item.id === itemId ? { ...item, separatedQuantityValue: value } : item,
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
      focusScanInput();
      return;
    }

    const matchedItem = items.find((item) =>
      [item.barcode, item.code, item.sku]
        .filter(Boolean)
        .some((value) => normalizeScan(value) === normalizedScan),
    );

    if (!matchedItem) {
      setActiveItemId(null);
      const message = "Código não encontrado nesta separação.";
      setFeedback(message, "error");
      pushScanHistory(message, "error");
      focusScanInput();
      return;
    }

    const currentSeparated = normalizeQuantity(matchedItem.separatedQuantityValue);
    const nextSeparated = Math.min(currentSeparated + 1, matchedItem.requestedQuantity);

    setItems((current) =>
      current.map((item) =>
        item.id === matchedItem.id
          ? { ...item, separatedQuantityValue: String(nextSeparated) }
          : item,
      ),
    );

    setActiveItemId(matchedItem.id);
    highlightScannedItem(matchedItem.id);
    setScanValue("");
    const message = `${matchedItem.sku}: ${nextSeparated}/${matchedItem.requestedQuantity} separado(s).`;
    setFeedback(message, "success");
    pushScanHistory(message, "success");
    resetTimer();
    focusScanInput();
  }

  return (
    <form action={savePickingProgressAction} className="space-y-4">
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

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              Separação em andamento
            </p>
            <h1 className="mt-2 text-xl font-semibold text-white">{order.externalNumber}</h1>
            <p className="mt-1 text-sm text-slate-300">
              {order.customer} • {order.destination}
            </p>
          </div>
          <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300">
            {completionPercent}%
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniInfo label="Pendentes" value={`${pendingUnits} un`} />
          <MiniInfo label="Operador" value={selectedOperatorId ? "Definido" : "Pendente"} />
        </div>
      </section>

      {nextItem ? (
        <section className="rounded-[28px] border border-sky-400/35 bg-gradient-to-br from-sky-500/18 via-sky-500/10 to-slate-950 p-4 shadow-lg shadow-sky-950/20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
            Item em foco
          </p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-white">{nextItem.sku}</p>
              <p className="mt-1 text-sm text-slate-200">{nextItem.name}</p>
            </div>
            <span className="rounded-full border border-sky-300/25 bg-sky-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100">
              Prioridade
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
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
          <div className="mt-3 rounded-2xl border border-sky-400/30 bg-slate-950/50 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              EAN/GTIN esperado
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{nextItem.barcode || "-"}</p>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sky-300 transition-all"
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
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-100">
                {nextItem.routeLines[0]
                  ? `Coleta sugerida em ${nextItem.routeLines[0].addressCode}`
                  : "Sem endereço sugerido."}
              </p>
              {nextItem.routeLines[0] ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-full bg-white/8 px-2 py-1 text-[11px] font-medium text-slate-200">
                    {nextItem.routeLines[0].area}
                  </span>
                  <span>{nextItem.routeLines[0].routeLabel}</span>
                </div>
              ) : null}
            </div>
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
              className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white"
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
        </div>
      </section>

      <section className="space-y-3">
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
              className={`border ${
                isCurrentItem
                  ? "rounded-[24px] border-sky-400/40 bg-gradient-to-br from-sky-500/18 via-sky-500/8 to-slate-950 p-4 shadow-lg shadow-sky-950/20"
                  : isCompleted
                    ? "rounded-[20px] border-emerald-400/25 bg-emerald-500/10 p-3.5"
                    : isActiveItem
                      ? "rounded-[20px] border-sky-300/30 bg-sky-500/10 p-3.5"
                      : "rounded-[20px] border-white/10 bg-white/5 p-3.5"
              } ${isRecentlyScanned ? "mobile-scan-flash mobile-scan-flash-sky" : ""}`}
            >
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
                          ? "bg-sky-400/15 text-sky-100"
                          : isCompleted
                            ? "bg-emerald-400/15 text-emerald-100"
                            : "bg-amber-400/15 text-amber-100"
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
                    {separatedQuantity}/{item.requestedQuantity} {item.unit}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCompleted ? "bg-emerald-300" : isCurrentItem ? "bg-sky-300" : "bg-amber-300"
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
                className={`rounded-2xl border border-sky-400/20 bg-slate-950/40 ${isCurrentItem ? "mt-3 px-3 py-3" : "mt-2 px-3 py-2.5"}`}
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

              <div className={`${isCurrentItem ? "mt-4" : "mt-3"} grid grid-cols-2 gap-2`}>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Separado
                  </span>
                  <input
                    type="number"
                    name="separatedQuantity"
                    min={0}
                    max={item.requestedQuantity}
                    step={1}
                    value={item.separatedQuantityValue}
                    onChange={(event) => updateQuantity(item.id, event.target.value)}
                    className={`h-11 w-full rounded-2xl border px-3 text-sm text-white outline-none ${
                      isCurrentItem ? "border-sky-300/40 bg-sky-950/30" : "border-white/10 bg-slate-900"
                    }`}
                  />
                </label>

                <div className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Status
                  </span>
                  <div className="flex h-11 items-center rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white">
                    {missing > 0 ? `Faltam ${missing}` : "Completo"}
                  </div>
                </div>
              </div>

              <div className={`${isCurrentItem ? "mt-4" : "mt-3"} space-y-2`}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Endereços sugeridos
                </p>
                {item.routeLines.length ? (
                  item.routeLines.map((line) => (
                    <div
                      key={`${item.id}-${line.stockId}`}
                      className={`rounded-2xl border border-white/10 bg-slate-900/80 ${isCurrentItem ? "px-3 py-3" : "px-3 py-2.5"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-slate-100">
                            <MapPinned className="h-4 w-4 shrink-0 text-sky-300" />
                            <span className={`${isCurrentItem ? "text-sm" : "text-[13px]"} font-semibold`}>
                              {line.addressCode}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span className="rounded-full bg-sky-400/10 px-2 py-1 font-medium text-sky-100">
                              {line.area}
                            </span>
                            <span>{line.routeLabel}</span>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-2.5 py-2 text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-100/80">
                            Coletar
                          </p>
                          <p className="mt-1 text-sm font-semibold text-sky-100">
                            {line.quantity} {item.unit}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white/5 px-2.5 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Lote
                          </p>
                          <p className="mt-1 text-[13px] font-medium text-white">{line.lot}</p>
                        </div>
                        <div className="rounded-xl bg-white/5 px-2.5 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Validade
                          </p>
                          <p className="mt-1 text-[13px] font-medium text-white">{line.expiry}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-amber-400/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
                    Sem endereço sugerido.
                  </div>
                )}
              </div>
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
              Retome a separação em até <span className="font-bold">{countdownSeconds}s</span>.
            </p>
          </div>
        ) : null}

        <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>{completionPercent}% concluído</span>
          <span>{pendingUnits} un pendente(s)</span>
        </div>

        <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-sky-300 transition-all"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button
            type="submit"
            name="intent"
            value="complete"
            className="h-11 bg-sky-500 text-white hover:bg-sky-400"
            onClick={() => setIsSubmitting(true)}
          >
            Concluir separação
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

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2">
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
