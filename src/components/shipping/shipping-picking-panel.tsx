"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Barcode, Focus, Map, ScanSearch, Volume2 } from "lucide-react";
import { savePickingProgressAction } from "@/app/(dashboard)/expedicao/separacao/actions";
import { Button } from "@/components/ui/button";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { PickingOperatorOption, ShippingPickingOrder } from "@/lib/shipping-picking";

type ShippingPickingPanelProps = {
  order: ShippingPickingOrder;
  operators: PickingOperatorOption[];
  currentUserId: string;
  redirectBase?: string;
  orderBasePath?: string;
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
  orderBasePath = "/expedicao",
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
    if (!operatorMode) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(focusTimer);
  }, [operatorMode]);

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

    const matchedItem = items.find((item) =>
      [item.barcode, item.code, item.sku]
        .filter(Boolean)
        .some((value) => normalizeScanValue(value) === normalizedScan),
    );

    if (!matchedItem) {
      setActiveItemId(null);
      setFeedback("Código não encontrado nesta separação.", "error");
      return false;
    }

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
    setScanValue("");
    resetTimer();

    requestAnimationFrame(() => {
      quantityInputRefs.current[matchedItem.id]?.focus();
      quantityInputRefs.current[matchedItem.id]?.select();

      if (operatorMode) {
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                {order.statusLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {order.depositante}
              </span>
              {pendingUnits > 0 ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  Pendentes: {pendingUnits} un
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Pronto para concluir
                </span>
              )}
            </div>

            <h2 className="mt-3 text-lg font-semibold text-slate-950">{order.externalNumber}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {order.customer} • {order.destination}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Código interno {order.code}</span>
              <span>{order.totalItems} item(ns)</span>
              <span>{order.totalUnits} unidade(s)</span>
              <span>{order.routeStopCount} parada(s)</span>
              <span>{completionPercent}% concluído</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Operador</p>
            <p className="mt-1 font-medium text-slate-900">
              {order.assignedOperatorName ?? "Não atribuído"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Operador responsável
              </span>
              <select
                value={selectedOperatorId}
                onChange={(event) => {
                  resetTimer();
                  setSelectedOperatorId(event.target.value);
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Selecionar operador</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <InfoMini label="Início" value={formatDateTime(order.startedAt) || "Ainda não iniciado"} />
              <InfoMini
                label="Última atualização"
                value={formatDateTime(order.updatedAt) || "Sem apontamento"}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <form onSubmit={handleScanSubmit} className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">
                Leitura de código de barras
              </span>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-2">
                <Barcode className="h-4 w-4 text-slate-500" />
                <input
                  ref={scanInputRef}
                  value={scanValue}
                  onChange={(event) => {
                    resetTimer();
                    setScanValue(event.target.value);
                  }}
                  onBlur={() => {
                    if (operatorMode) {
                      window.setTimeout(() => {
                        scanInputRef.current?.focus();
                      }, 40);
                    }
                  }}
                  placeholder="Leia EAN/GTIN, SKU ou código interno"
                  className="h-10 w-full border-0 bg-transparent px-1 text-sm text-slate-950 outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <ScanSearch className="h-4 w-4" />
                  Ler
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Funciona com leitor USB no modo teclado: o código cai no campo e o item é apontado.
              </p>
              {scanMessage ? (
                <p className={`text-sm ${scanTone === "success" ? "text-emerald-700" : "text-rose-700"}`}>
                  {scanMessage}
                </p>
              ) : null}
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOperatorMode((current) => !current)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  operatorMode
                    ? "bg-sky-600 text-white hover:bg-sky-700"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Volume2 className="h-4 w-4" />
                {soundEnabled ? "Som ativo" : "Ativar som"}
              </button>

              <button
                type="button"
                onClick={focusScanInput}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Focus className="h-4 w-4" />
                Focar leitura
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <Map className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Rota sugerida no armazém</h3>
            </div>

            <div className="mt-4 space-y-3">
              {order.routeStops.length ? (
                order.routeStops.map((stop, index) => (
                  <div key={stop.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Parada {index + 1}
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-950">{stop.addressCode}</p>
                    <p className="text-sm text-slate-600">
                      {stop.area} • {stop.routeLabel}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {stop.totalQuantity} unidade(s) para coletar
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                  Ainda não encontramos saldo sugerido para este pedido. Revise estoque, picking ou
                  endereçamento antes de iniciar a coleta.
                </div>
              )}
            </div>
          </div>
        </div>

        <form action={savePickingProgressAction} className="space-y-4">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="operatorId" value={selectedOperatorId} />
          <input type="hidden" name="redirectBase" value={redirectBase} />

          <div className="space-y-3 lg:hidden">
            {items.map((item) => {
              const missingQuantity = Math.max(
                item.requestedQuantity - normalizeQuantity(item.separatedQuantityValue),
                0,
              );

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    activeItemId === item.id
                      ? "border-sky-300 bg-sky-50/60"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <input type="hidden" name="itemId" value={item.id} />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">
                        {item.sku} • {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Código {item.code} • Ref. {item.externalReference || "-"}
                      </p>
                      <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
                          EAN/GTIN esperado
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">
                          {item.barcode || "-"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {item.requestedQuantity} {item.unit}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                      />
                    </label>

                    <div className="space-y-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Status
                      </span>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                        {missingQuantity > 0 ? (
                          <span className="font-medium text-amber-700">
                            Faltam {missingQuantity} {item.unit}.
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-700">Item completo.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Endereços sugeridos
                    </p>
                    {item.routeLines.length ? (
                      item.routeLines.map((line) => (
                        <div
                          key={`${item.id}-${line.stockId}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="font-medium text-slate-900">
                            {line.addressCode} • {line.area}
                          </div>
                          <div className="text-xs text-slate-500">{line.routeLabel}</div>
                          <div className="text-sm text-slate-700">
                            Coletar {line.quantity} {item.unit} • lote {line.lot}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Sem endereço sugerido.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU / produto</th>
                  <th className="px-4 py-3 font-medium">Solicitado</th>
                  <th className="px-4 py-3 font-medium">Separado</th>
                  <th className="px-4 py-3 font-medium">Sugestão</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 align-top ${
                      activeItemId === item.id ? "bg-sky-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-4 text-slate-900">
                      <input type="hidden" name="itemId" value={item.id} />
                      <div className="font-medium">
                        {item.sku} • {item.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        Cod. {item.code} • Ref. {item.externalReference || "-"}
                      </div>
                      <div className="mt-3 inline-block rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
                          EAN/GTIN esperado
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">
                          {item.barcode || "-"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {item.requestedQuantity} {item.unit}
                    </td>
                    <td className="px-4 py-4">
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
                        className="h-11 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                      />
                      {Math.max(item.requestedQuantity - normalizeQuantity(item.separatedQuantityValue), 0) > 0 ? (
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          Faltam{" "}
                          {Math.max(item.requestedQuantity - normalizeQuantity(item.separatedQuantityValue), 0)}{" "}
                          {item.unit}.
                        </p>
                      ) : (
                        <p className="mt-2 text-xs font-medium text-emerald-700">Item completo.</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.routeLines.length ? (
                        <div className="space-y-2">
                          {item.routeLines.map((line) => (
                            <div
                              key={`${item.id}-${line.stockId}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                            >
                              <div className="font-medium text-slate-900">
                                {line.addressCode} • {line.area}
                              </div>
                              <div className="text-xs text-slate-500">{line.routeLabel}</div>
                              <div className="text-sm">
                                Coletar {line.quantity} {item.unit} • lote {line.lot}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-700">Sem endereço sugerido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-20 z-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg lg:bottom-4">
            {isWarningVisible ? (
              <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Sem atividade nesta separação. O pedido volta para a fila em{" "}
                <span className="font-semibold">{countdownSeconds}s</span> se não houver nova
                interação.
              </div>
            ) : null}

            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                {completionPercent}% concluído
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                {pendingUnits} unidade(s) pendente(s)
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                name="intent"
                value="complete"
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => setIsSubmitting(true)}
              >
                Concluir separação
              </Button>
              <Link
                href={`${orderBasePath}/${order.id}`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Ver pedido
              </Link>
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
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
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
