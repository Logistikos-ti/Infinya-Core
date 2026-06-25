"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Barcode, Focus, Volume2 } from "lucide-react";
import { saveShippingConferenceAction } from "@/app/(dashboard)/expedicao/conferencia/actions";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { Button } from "@/components/ui/button";
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wrongProductScans, setWrongProductScans] = useState(order.wrongProductScans);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
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

  useEffect(() => {
    const timer = window.setTimeout(() => scanInputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
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

  function updateQuantity(itemId: string, value: string) {
    resetTimer();
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, confirmedQuantityValue: value } : item,
      ),
    );
  }

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
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
      setWrongProductScans((current) => current + 1);
      setFeedback("Código não encontrado neste pedido.", "error");
      return;
    }

    const currentConfirmed = normalizeQuantity(matchedItem.confirmedQuantityValue);
    if (currentConfirmed >= matchedItem.requestedQuantity) {
      setActiveItemId(matchedItem.id);
      setFeedback(`O item ${matchedItem.sku} já foi totalmente conferido.`, "error");
      focusScanInput();
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

    setActiveItemId(matchedItem.id);
    setScanValue("");
    setFeedback(
      `${matchedItem.sku}: ${nextConfirmed}/${matchedItem.requestedQuantity} conferido(s).`,
      "success",
    );
    resetTimer();
    focusScanInput();
  }

  return (
    <form action={saveShippingConferenceAction} className="space-y-4">
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="Conferência pausada por inatividade"
        description="O operador ficou sem interação nesta conferência. Se a atividade não for retomada, o pedido será devolvido automaticamente para a fila."
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
            <h1 className="mt-2 text-xl font-semibold text-white">{order.externalNumber}</h1>
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
        <section className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
            Próximo item sugerido
          </p>
          <p className="mt-2 text-base font-semibold text-white">{nextItem.sku}</p>
          <p className="mt-1 text-sm text-slate-300">{nextItem.name}</p>
          <p className="mt-2 text-sm text-slate-200">
            Falta{" "}
            {Math.max(
              nextItem.requestedQuantity - normalizeQuantity(nextItem.confirmedQuantityValue),
              0,
            )}{" "}
            {nextItem.unit}
          </p>
          <div className="mt-3 rounded-2xl border border-amber-400/30 bg-slate-950/40 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              EAN/GTIN esperado
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{nextItem.barcode || "-"}</p>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <InfoBadge label="Pedido" value={`${nextItem.requestedQuantity}`} />
            <InfoBadge label="Separado" value={`${nextItem.separatedQuantity}`} />
            <InfoBadge
              label="Conferido"
              value={`${normalizeQuantity(nextItem.confirmedQuantityValue)}`}
            />
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
            <p className={`text-sm ${scanTone === "success" ? "text-emerald-300" : "text-rose-300"}`}>
              {scanMessage}
            </p>
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
        {items.map((item) => {
          const missing = Math.max(
            item.requestedQuantity - normalizeQuantity(item.confirmedQuantityValue),
            0,
          );
          const hasDivergence =
            normalizeQuantity(item.confirmedQuantityValue) !== item.requestedQuantity;

          return (
            <div
              key={item.id}
              ref={(element) => {
                itemRefs.current[item.id] = element;
              }}
              className={`rounded-[24px] border p-4 ${
                activeItemId === item.id
                  ? "border-amber-400 bg-amber-500/10"
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

              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-slate-950/40 px-3 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  EAN/GTIN esperado
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{item.barcode || "-"}</p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
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
                    className="h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">Ref. externa: {item.externalReference}</p>
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

              <p className={`mt-3 text-sm ${missing > 0 ? "text-amber-200" : "text-emerald-300"}`}>
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

        <div className="grid grid-cols-1 gap-2">
          <Button
            type="submit"
            name="intent"
            value="complete"
            className="h-11 bg-amber-500 text-slate-950 hover:bg-amber-400"
            onClick={() => setIsSubmitting(true)}
          >
            Concluir conferência
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
