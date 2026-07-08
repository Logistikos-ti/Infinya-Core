"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Barcode, Focus, Search, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReceivingOrderDetail } from "@/lib/receiving";

type AddressOption = {
  id: string;
  codigo: string;
  area: string;
};

type MobileReceivingPanelProps = {
  orderId: string;
  initialItems: ReceivingOrderDetail["items"];
  addresses: AddressOption[];
};

type ReceivingItemState = {
  id: string;
  sku: string;
  description: string;
  barcode: string;
  internalCode: string;
  unitLabel: string;
  expectedQuantity: number;
  receivedQuantityValue: string;
  lotValue: string;
  expiryValue: string;
  requireLot: boolean;
  requireExpiry: boolean;
};

type ScanFeedbackTone = "success" | "error";

export function MobileReceivingPanel({
  orderId,
  initialItems,
  addresses,
}: MobileReceivingPanelProps) {
  const router = useRouter();
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [items, setItems] = useState<ReceivingItemState[]>(
    initialItems.map((item) => ({
      id: item.id,
      sku: item.sku,
      description: item.description,
      barcode: item.barcode,
      internalCode: item.internalCode,
      unitLabel: item.unitLabel,
      expectedQuantity: item.expectedQuantity,
      receivedQuantityValue: String(item.receivedQuantity || ""),
      lotValue: item.lotValue,
      expiryValue: item.expiryValue,
      requireLot: item.requireLot,
      requireExpiry: item.requireExpiry,
    })),
  );
  const [enderecoId, setEnderecoId] = useState(addresses[0]?.id ?? "");
  const [scanValue, setScanValue] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanTone, setScanTone] = useState<ScanFeedbackTone>("success");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    const expected = items.reduce((sum, item) => sum + item.expectedQuantity, 0);
    const received = items.reduce(
      (sum, item) => sum + normalizeQuantity(item.receivedQuantityValue),
      0,
    );
    const pending = Math.max(expected - received, 0);
    const percent = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0;

    return { expected, received, pending, percent };
  }, [items]);

  const nextItem = useMemo(
    () =>
      items.find(
        (item) => normalizeQuantity(item.receivedQuantityValue) < item.expectedQuantity,
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

  function setFeedback(text: string, tone: ScanFeedbackTone) {
    setScanMessage(text);
    setScanTone(tone);
    playFeedbackTone(tone);
  }

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
  }

  function updateItem(
    itemId: string,
    field: keyof Pick<ReceivingItemState, "receivedQuantityValue" | "lotValue" | "expiryValue">,
    value: string,
  ) {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    );
    setError(null);
    setMessage(null);
  }

  function applyScan(rawValue: string) {
    const normalizedScan = normalizeScan(rawValue);

    if (!normalizedScan) {
      setFeedback("Leia ou digite um cÃ³digo para localizar o item.", "error");
      return;
    }

    const matchedItem = items.find((item) =>
      [item.barcode, item.internalCode, item.sku]
        .filter(Boolean)
        .some((value) => normalizeScan(value) === normalizedScan),
    );

    if (!matchedItem) {
      setActiveItemId(null);
      setFeedback("CÃ³digo nÃ£o encontrado neste recebimento.", "error");
      focusScanInput();
      return;
    }

    const nextQuantity = normalizeQuantity(matchedItem.receivedQuantityValue) + 1;

    setItems((current) =>
      current.map((item) =>
        item.id === matchedItem.id
          ? { ...item, receivedQuantityValue: String(nextQuantity) }
          : item,
      ),
    );

    setActiveItemId(matchedItem.id);
    setScanValue("");
    setFeedback(
      `${matchedItem.sku}: ${nextQuantity}/${matchedItem.expectedQuantity} recebido(s).`,
      "success",
    );
    setError(null);
    setMessage(null);
    focusScanInput();
  }

  async function submitConference(finalizar: boolean) {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/recebimento/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enderecoId,
          finalizar,
          items: items.map((item) => ({
            id: item.id,
            quantidadeRecebida: normalizeQuantity(item.receivedQuantityValue),
            lote: item.lotValue || undefined,
            validadeEm: item.expiryValue || undefined,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "NÃ£o foi possÃ­vel salvar a conferÃªncia.");
        playFeedbackTone("error");
        return;
      }

      setMessage(result.message ?? "ConferÃªncia atualizada com sucesso.");
      playFeedbackTone("success");

      if (finalizar) {
        router.push("/m/recebimento?feedback=concluido");
        return;
      }
    } catch {
      setError("Falha de comunicaÃ§Ã£o com a API do recebimento.");
      playFeedbackTone("error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              ConferÃªncia inbound
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Lance quantidade, lote e validade direto no celular.
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
            {progress.percent}%
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniInfo label="Previsto" value={String(progress.expected)} />
          <MiniInfo label="Recebido" value={String(progress.received)} />
          <MiniInfo label="Pendente" value={String(progress.pending)} />
        </div>
      </section>

      {nextItem ? (
        <section className="rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            PrÃ³ximo item sugerido
          </p>
          <p className="mt-2 text-base font-semibold text-white">{nextItem.sku}</p>
          <p className="mt-1 text-sm text-slate-300">{nextItem.description}</p>
          <p className="mt-2 text-sm text-slate-200">
            Falta{" "}
            {Math.max(
              nextItem.expectedQuantity - normalizeQuantity(nextItem.receivedQuantityValue),
              0,
            )}{" "}
            {nextItem.unitLabel.toLowerCase()}
          </p>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            EndereÃ§o destino
          </span>
          <select
            value={enderecoId}
            onChange={(event) => setEnderecoId(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none"
          >
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.codigo} â€¢ {formatArea(address.area)}
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
              onChange={(event) => setScanValue(event.target.value)}
              onBlur={() => {
                window.setTimeout(() => {
                  scanInputRef.current?.focus();
                }, 40);
              }}
              placeholder="Leia EAN, SKU ou cÃ³digo"
              className="h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => applyScan(scanValue)}
              className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950"
            >
              <Search className="h-4 w-4" />
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
          const received = normalizeQuantity(item.receivedQuantityValue);
          const missing = Math.max(item.expectedQuantity - received, 0);
          const hasDivergence = received !== item.expectedQuantity;

          return (
            <div
              key={item.id}
              ref={(element) => {
                itemRefs.current[item.id] = element;
              }}
              className={`rounded-[24px] border p-4 ${
                activeItemId === item.id
                  ? "border-emerald-400 bg-emerald-500/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{item.sku}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    CÃ³digo {item.internalCode || "-"} â€¢ EAN {item.barcode || "-"}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200">
                  {item.expectedQuantity} {item.unitLabel.toLowerCase()}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <InfoBadge label="Previsto" value={`${item.expectedQuantity}`} />
                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Recebido
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={item.receivedQuantityValue}
                    onChange={(event) =>
                      updateItem(item.id, "receivedQuantityValue", event.target.value)
                    }
                    className="h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none"
                  />
                </label>
                <InfoBadge label="Status" value={hasDivergence ? "A validar" : "OK"} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Lote {item.requireLot ? "*" : ""}
                  </span>
                  <input
                    value={item.lotValue}
                    onChange={(event) => updateItem(item.id, "lotValue", event.target.value)}
                    placeholder={item.requireLot ? "ObrigatÃ³rio" : "Opcional"}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Validade {item.requireExpiry ? "*" : ""}
                  </span>
                  <input
                    type="date"
                    value={item.expiryValue}
                    onChange={(event) => updateItem(item.id, "expiryValue", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none"
                  />
                </label>
              </div>

              <p className={`mt-3 text-sm ${missing > 0 ? "text-amber-200" : "text-emerald-300"}`}>
                {missing > 0
                  ? `Faltam ${missing} ${item.unitLabel.toLowerCase()}.`
                  : "Item recebido conforme previsto."}
              </p>
            </div>
          );
        })}
      </section>

      {message ? (
        <section className="rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {message}
        </section>
      ) : null}

      {error ? (
        <section className="rounded-[24px] border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-20 z-20 rounded-[24px] border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>{progress.percent}% concluÃ­do</span>
          <span>{progress.pending} un pendente(s)</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button
            type="button"
            onClick={() => void submitConference(false)}
            disabled={isSaving || !enderecoId}
            className="h-11 bg-slate-100 text-slate-950 hover:bg-white"
          >
            {isSaving ? "Salvando..." : "Salvar conferÃªncia"}
          </Button>
          <Button
            type="button"
            onClick={() => void submitConference(true)}
            disabled={isSaving || !enderecoId}
            className="h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          >
            {isSaving ? "Concluindo..." : "Concluir e lanÃ§ar no estoque"}
          </Button>
        </div>
      </div>
    </div>
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

function formatArea(area: string) {
  switch (area) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Armazenagem";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "ExpediÃ§Ã£o";
    default:
      return area;
  }
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


