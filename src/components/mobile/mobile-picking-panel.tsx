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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    const timer = window.setTimeout(() => scanInputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, []);

  function setFeedback(message: string, tone: "success" | "error") {
    setScanMessage(message);

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

  function updateQuantity(itemId: string, value: string) {
    resetTimer();
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, separatedQuantityValue: value } : item,
      ),
    );
  }

  function applyScan(rawValue: string) {
    const normalizedScan = normalizeScan(rawValue);

    if (!normalizedScan) {
      setFeedback("Leia ou digite um código para localizar o item.", "error");
      return;
    }

    const matchedItem = items.find((item) =>
      [item.barcode, item.code, item.sku]
        .filter(Boolean)
        .some((value) => normalizeScan(value) === normalizedScan),
    );

    if (!matchedItem) {
      setActiveItemId(null);
      setFeedback("Código não encontrado nesta separação.", "error");
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
    setScanValue("");
    setFeedback(
      `${matchedItem.sku}: ${nextSeparated}/${matchedItem.requestedQuantity} separado(s).`,
      "success",
    );
    resetTimer();
    requestAnimationFrame(() => scanInputRef.current?.focus());
  }

  return (
    <form action={savePickingProgressAction} className="space-y-4">
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="Separação pausada por inatividade"
        description="O operador ficou sem interação nesta separação. Se a atividade não for retomada, o pedido será devolvido automaticamente para a fila."
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
          <MiniInfo label="Paradas" value={String(order.routeStopCount)} />
        </div>
      </section>

      {nextItem ? (
        <section className="rounded-[24px] border border-sky-400/30 bg-sky-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
            Próximo item sugerido
          </p>
          <p className="mt-2 text-base font-semibold text-white">{nextItem.sku}</p>
          <p className="mt-1 text-sm text-slate-300">{nextItem.name}</p>
          <p className="mt-2 text-sm text-slate-200">
            Falta{" "}
            {Math.max(
              nextItem.requestedQuantity - normalizeQuantity(nextItem.separatedQuantityValue),
              0,
            )}{" "}
            {nextItem.unit}
          </p>
          <div className="mt-3 rounded-2xl border border-sky-400/30 bg-slate-950/40 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              EAN/GTIN esperado
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{nextItem.barcode || "-"}</p>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {nextItem.routeLines[0]
              ? `${nextItem.routeLines[0].addressCode} • ${nextItem.routeLines[0].routeLabel}`
              : "Sem endereço sugerido."}
          </p>
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

          {scanMessage ? <p className="text-sm text-slate-300">{scanMessage}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => scanInputRef.current?.focus()}
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
        {items.map((item) => {
          const missing = Math.max(
            item.requestedQuantity - normalizeQuantity(item.separatedQuantityValue),
            0,
          );

          return (
            <div
              key={item.id}
              className={`rounded-[24px] border p-4 ${
                activeItemId === item.id
                  ? "border-sky-400 bg-sky-500/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <input type="hidden" name="itemId" value={item.id} />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{item.sku}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">Código {item.code}</p>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200">
                  {item.requestedQuantity} {item.unit}
                </span>
              </div>

              <div className="mt-3 rounded-2xl border border-sky-400/20 bg-slate-950/40 px-3 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  EAN/GTIN esperado
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{item.barcode || "-"}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
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
                    className="h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none"
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

              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Endereços sugeridos
                </p>
                {item.routeLines.length ? (
                  item.routeLines.map((line) => (
                    <div
                      key={`${item.id}-${line.stockId}`}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-3"
                    >
                      <div className="flex items-center gap-2 text-slate-200">
                        <MapPinned className="h-4 w-4 text-sky-300" />
                        <span className="font-medium">{line.addressCode}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {line.area} • {line.routeLabel}
                      </p>
                      <p className="mt-2 text-sm text-white">
                        Coletar {line.quantity} {item.unit} • lote {line.lot}
                      </p>
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
