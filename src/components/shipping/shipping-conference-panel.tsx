"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Barcode, Camera, CameraOff, Focus, ScanSearch, Volume2 } from "lucide-react";
import { saveShippingConferenceAction } from "@/app/(dashboard)/expedicao/conferencia/actions";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { Button } from "@/components/ui/button";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { PickingOperatorOption } from "@/lib/shipping-picking";
import type { ShippingConferenceOrder } from "@/lib/shipping-conference";

type ShippingConferencePanelProps = {
  order: ShippingConferenceOrder;
  operators: PickingOperatorOption[];
  currentUserId: string;
  feedback?: string;
  redirectBase?: string;
  orderBasePath?: string;
};

type ConferenceItemState = ShippingConferenceOrder["items"][number] & {
  confirmedQuantityValue: string;
};

type ScanFeedbackTone = "success" | "error";

export function ShippingConferencePanel({
  order,
  operators,
  currentUserId,
  feedback,
  redirectBase = "/expedicao/conferencia",
  orderBasePath = "/expedicao",
}: ShippingConferencePanelProps) {
  const router = useRouter();
  const defaultOperatorId = order.assignedOperatorId ?? currentUserId;
  const [selectedOperatorId, setSelectedOperatorId] = useState(defaultOperatorId);
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
  const [operatorMode, setOperatorMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wrongProductScans, setWrongProductScans] = useState(order.wrongProductScans);
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
    const confirmed = items.reduce((sum, item) => sum + normalizeQuantity(item.confirmedQuantityValue), 0);
    return requested > 0 ? Math.min(100, Math.round((confirmed / requested) * 100)) : 0;
  }, [items]);

  const pendingUnits = useMemo(
    () =>
      items.reduce((sum, item) => {
        const confirmed = normalizeQuantity(item.confirmedQuantityValue);
        return sum + Math.max(item.requestedQuantity - confirmed, 0);
      }, 0),
    [items],
  );

  const quantityDivergentItems = useMemo(
    () =>
      items.filter(
        (item) => normalizeQuantity(item.confirmedQuantityValue) !== item.requestedQuantity,
      ).length,
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
        item.id === itemId
          ? {
              ...item,
              confirmedQuantityValue: value,
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

    const matchedItem = items.find((item) =>
      [item.barcode, item.code, item.sku]
        .filter(Boolean)
        .some((value) => normalizeScanValue(value) === normalizedScan),
    );

    if (!matchedItem) {
      setActiveItemId(null);
      setWrongProductScans((current) => current + 1);
      setFeedback("Código não encontrado neste pedido.", "error");
      return false;
    }

    const currentConfirmed = normalizeQuantity(matchedItem.confirmedQuantityValue);
    if (currentConfirmed >= matchedItem.requestedQuantity) {
      setActiveItemId(matchedItem.id);
      setFeedback(`O item ${matchedItem.sku} já foi totalmente conferido.`, "error");
      return false;
    }

    const nextConfirmed = Math.min(currentConfirmed + 1, matchedItem.requestedQuantity);

    setItems((current) =>
      current.map((item) =>
        item.id === matchedItem.id
          ? {
              ...item,
              confirmedQuantityValue: String(nextConfirmed),
            }
          : item,
      ),
    );

    setActiveItemId(matchedItem.id);
    setFeedback(
      `Conferência aplicada em ${matchedItem.sku}. Total conferido: ${nextConfirmed}/${matchedItem.requestedQuantity}.`,
      "success",
    );
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
    <div className="space-y-6">
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="Conferência pausada por inatividade"
        description="O operador ficou sem interação nesta conferência. Se a atividade não for retomada, o pedido será devolvido automaticamente para a fila."
        mobileDescription="Sem interação na conferência. Retome agora ou o pedido volta para a fila."
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "concluido"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          }`}
        >
          {feedback === "concluido"
            ? "Conferência concluída e pedido movido para o próximo passo."
            : feedback === "incompleto"
              ? "Ainda existem itens pendentes. O pedido permanece na fila para nova conferência."
              : feedback === "inatividade"
                ? "Pedido devolvido para a fila por inatividade do operador."
                : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      {wrongProductScans > 0 || quantityDivergentItems > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">Alertas de divergência na conferência</p>
              {wrongProductScans > 0 ? (
                <p>Produto errado lido: {wrongProductScans} ocorrência(s).</p>
              ) : null}
              {quantityDivergentItems > 0 ? (
                <p>Itens com divergência de quantidade: {quantityDivergentItems}.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                {order.statusLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {order.depositante}
              </span>
              {pendingUnits > 0 ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                  Pendentes: {pendingUnits} un
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                  Pedido conferido
                </span>
              )}
            </div>

            <h2 className="mt-3 text-xl font-semibold text-slate-950 dark:text-slate-100">{order.externalNumber}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {order.customer} • {order.destination}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Código interno {order.code} • {order.totalItems} item(ns) • {order.totalUnits} unidade(s)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Conferido</p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{completionPercent}%</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {quantityDivergentItems
                ? `${quantityDivergentItems} item(ns) com divergência`
                : "Sem divergência de quantidade"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Operador responsável
                </span>
                <select
                  value={selectedOperatorId}
                  onChange={(event) => {
                    resetTimer();
                    setSelectedOperatorId(event.target.value);
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Selecionar operador</option>
                  {operators.map((operator) => (
                    <option key={operator.id} value={operator.id}>
                      {operator.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                <InfoMini label="Início" value={formatDateTime(order.startedAt) || "Ainda não iniciado"} />
                <InfoMini
                  label="Última atualização"
                  value={formatDateTime(order.updatedAt) || "Sem apontamento"}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <form onSubmit={handleScanSubmit} className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Leitura de código de barras
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
                  <Barcode className="h-4 w-4 text-slate-500 dark:text-slate-400" />
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
                    placeholder="Leia EAN/GTIN, SKU ou código interno"
                    className="h-10 w-full border-0 bg-transparent px-1 text-sm text-slate-950 outline-none dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                  >
                    <ScanSearch className="h-4 w-4" />
                    Ler
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Faça a leitura item a item para validar o pedido real antes da expedição.
                </p>
                {scanMessage ? (
                  <p
                    className={`text-sm ${
                      scanTone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {scanMessage}
                  </p>
                ) : null}
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleCamera}
                  disabled={!cameraSupported}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    cameraEnabled
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "bg-sky-600 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
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
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    operatorMode
                      ? "bg-sky-600 text-white hover:bg-sky-700"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  }`}
                >
                  {operatorMode ? "Modo operador ativo" : "Ativar modo operador"}
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled((current) => !current)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    soundEnabled
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  }`}
                >
                  <Volume2 className="h-4 w-4" />
                  {soundEnabled ? "Som ativo" : "Ativar som"}
                </button>

                <button
                  type="button"
                  onClick={focusScanInput}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <Focus className="h-4 w-4" />
                  Focar leitura
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-slate-800">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`aspect-video w-full object-cover transition ${
                    cameraEnabled || cameraStarting ? "opacity-100" : "opacity-35"
                  }`}
                />
              </div>

              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {cameraMessage ??
                  (cameraSupported
                    ? "Compatível com celular e notebook. Abra a câmera e escaneie o EAN/GTIN do item."
                    : "Seu navegador atual não liberou leitura por câmera. O leitor USB e o campo manual continuam disponíveis.")}
              </p>
            </div>
          </div>

          <form action={saveShippingConferenceAction} className="space-y-5" aria-busy={isSubmitting}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="operatorId" value={selectedOperatorId} />
            <input type="hidden" name="wrongProductScans" value={String(wrongProductScans)} />
            <input type="hidden" name="redirectBase" value={redirectBase} />

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/70 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">SKU / produto</th>
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Separado</th>
                    <th className="px-4 py-3 font-medium">Conferido</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-t border-slate-100 align-top dark:border-slate-800 ${
                        activeItemId === item.id ? "bg-sky-50/60 dark:bg-sky-500/10" : "dark:bg-slate-950/30"
                      }`}
                    >
                      <td className="px-4 py-4 text-slate-900 dark:text-slate-100">
                        <input type="hidden" name="itemId" value={item.id} />
                        <div className="font-medium">
                          {item.sku} • {item.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Cod. {item.code} • Ref. {item.externalReference}
                        </div>
                        <div className="mt-3 inline-block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-200">
                            EAN/GTIN esperado
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">
                            {item.barcode || "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-200">
                        {item.requestedQuantity} {item.unit}
                      </td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-200">
                        {item.separatedQuantity} {item.unit}
                      </td>
                      <td className="px-4 py-4">
                        {normalizeQuantity(item.confirmedQuantityValue) !== item.requestedQuantity ? (
                          <div className="mb-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                            Divergência
                          </div>
                        ) : null}
                        <input
                          ref={(element) => {
                            quantityInputRefs.current[item.id] = element;
                          }}
                          type="number"
                          name="confirmedQuantity"
                          min={0}
                          max={item.requestedQuantity}
                          step={1}
                          value={item.confirmedQuantityValue}
                          onChange={(event) => updateItemQuantity(item.id, event.target.value)}
                          className="h-11 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        {Math.max(item.requestedQuantity - normalizeQuantity(item.confirmedQuantityValue), 0) > 0 ? (
                          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                            Faltam{" "}
                            {Math.max(item.requestedQuantity - normalizeQuantity(item.confirmedQuantityValue), 0)}{" "}
                            {item.unit}.
                          </p>
                        ) : (
                          <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">Item conferido.</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  name="intent"
                  value="complete"
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                  disabled={isSubmitting}
                  onClick={() => setIsSubmitting(true)}
                >
                  {isSubmitting ? "Processando conferência..." : "Concluir conferência"}
                </Button>
                <Link
                  href={`${orderBasePath}/${order.id}`}
                  className={`inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 ${isSubmitting ? "pointer-events-none opacity-50" : ""}`}
                >
                  Ver pedido
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
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
