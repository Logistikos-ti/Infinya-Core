"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Barcode, Focus, Search, Volume2 } from "lucide-react";
import type { ReceivingOrderDetail } from "@/lib/receiving";
import {
  mobileColors,
  hexAlpha,
  headingFont,
  MobilePrimaryButton,
  MobileScanOverlay,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

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

export function MobileReceivingPanel({
  orderId,
  initialItems,
  addresses,
}: MobileReceivingPanelProps) {
  const router = useRouter();
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const overlayTimerRef = useRef<number | null>(null);
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
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
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

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) {
        window.clearTimeout(overlayTimerRef.current);
      }
    };
  }, []);

  function flash(next: ScanOverlayState) {
    setOverlay(next);
    if (overlayTimerRef.current) {
      window.clearTimeout(overlayTimerRef.current);
    }
    overlayTimerRef.current = window.setTimeout(() => setOverlay(null), 700);

    if (!soundEnabled || typeof window === "undefined" || !next) {
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

    oscillator.type = next.type === "ok" ? "sine" : "square";
    oscillator.frequency.value = next.type === "ok" ? 880 : 220;
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
      flash({ type: "err", title: "Código vazio", code: "—", sub: "Leia ou digite um código para localizar o item." });
      return;
    }

    const matchedItem = items.find((item) =>
      [item.barcode, item.internalCode, item.sku]
        .filter(Boolean)
        .some((value) => normalizeScan(value) === normalizedScan),
    );

    if (!matchedItem) {
      setActiveItemId(null);
      flash({ type: "err", title: "Não encontrado", code: rawValue, sub: "Código não encontrado neste recebimento." });
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
    flash({
      type: "ok",
      title: "Volume recebido",
      code: matchedItem.sku,
      sub: `${nextQuantity}/${matchedItem.expectedQuantity} recebido(s).`,
    });
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
        setError(result.error ?? "Não foi possível salvar a conferência.");
        flash({ type: "err", title: "Falha ao salvar", code: "—", sub: result.error ?? "Tente novamente." });
        return;
      }

      setMessage(result.message ?? "Conferência atualizada com sucesso.");
      flash({ type: "ok", title: "Salvo", code: "—", sub: result.message ?? "Conferência atualizada." });

      if (finalizar) {
        router.push("/m/recebimento?feedback=concluido");
        return;
      }
    } catch {
      setError("Falha de comunicação com a API do recebimento.");
      flash({ type: "err", title: "Falha de rede", code: "—", sub: "Falha de comunicação com a API do recebimento." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative space-y-4">
      <MobileScanOverlay overlay={overlay} />

      <section className="rounded-[24px] p-4" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mobileColors.violetLight }}>
              Conferência inbound
            </p>
            <p className="mt-2 text-sm" style={{ color: mobileColors.muted }}>
              Lance quantidade, lote e validade direto no celular.
            </p>
          </div>
          <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: hexAlpha(mobileColors.violet, 0.15), color: mobileColors.violetLight }}>
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
        <section
          className="rounded-[24px] p-4"
          style={{ border: `1px solid ${hexAlpha(mobileColors.violet, 0.3)}`, background: hexAlpha(mobileColors.violet, 0.1) }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mobileColors.violetLight }}>
            Próximo item sugerido
          </p>
          <p className="mt-2 text-base font-semibold" style={headingFont}>{nextItem.sku}</p>
          <p className="mt-1 text-sm" style={{ color: mobileColors.muted }}>{nextItem.description}</p>
          <p className="mt-2 text-sm" style={{ color: mobileColors.text }}>
            Falta{" "}
            {Math.max(
              nextItem.expectedQuantity - normalizeQuantity(nextItem.receivedQuantityValue),
              0,
            )}{" "}
            {nextItem.unitLabel.toLowerCase()}
          </p>
        </section>
      ) : null}

      <section className="rounded-[24px] p-4" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) }}>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mobileColors.muted }}>
            Endereço destino
          </span>
          <select
            value={enderecoId}
            onChange={(event) => setEnderecoId(event.target.value)}
            className="h-12 w-full rounded-2xl px-3 text-sm outline-none"
            style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "#0B1424", color: mobileColors.text }}
          >
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.codigo} • {formatArea(address.area)}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mobileColors.muted }}>
            Leitura
          </span>
          <div className="flex items-center gap-2 rounded-2xl p-2" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "#0B1424" }}>
            <Barcode className="h-4 w-4" style={{ color: mobileColors.muted }} />
            <input
              ref={scanInputRef}
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
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
              className="h-10 w-full bg-transparent text-sm outline-none"
              style={{ color: mobileColors.text }}
            />
            <button
              type="button"
              onClick={() => applyScan(scanValue)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
              style={{ background: mobileColors.violet }}
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={focusScanInput}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, color: mobileColors.text }}
            >
              <Focus className="h-4 w-4" />
              Focar
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, color: mobileColors.text }}
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
          const isActive = activeItemId === item.id;

          return (
            <div
              key={item.id}
              ref={(element) => {
                itemRefs.current[item.id] = element;
              }}
              className="rounded-[24px] p-4 transition-colors"
              style={{
                border: `1px solid ${hexAlpha(isActive ? mobileColors.violet : "#94A3B8", isActive ? 0.5 : 0.14)}`,
                background: hexAlpha(isActive ? mobileColors.violet : "#94A3B8", isActive ? 0.1 : 0.045),
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: mobileColors.text, ...headingFont }}>{item.sku}</p>
                  <p className="mt-1 text-sm" style={{ color: mobileColors.muted }}>{item.description}</p>
                  <p className="mt-1 text-xs" style={{ color: mobileColors.dim }}>
                    Código {item.internalCode || "-"} • EAN {item.barcode || "-"}
                  </p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: hexAlpha("#94A3B8", 0.1), color: mobileColors.text }}>
                  {item.expectedQuantity} {item.unitLabel.toLowerCase()}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <InfoBadge label="Previsto" value={`${item.expectedQuantity}`} />
                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: mobileColors.muted }}>
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
                    className="h-11 w-full rounded-2xl px-3 text-sm outline-none"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "#0B1424", color: mobileColors.text }}
                  />
                </label>
                <InfoBadge label="Status" value={hasDivergence ? "A validar" : "OK"} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                    Lote {item.requireLot ? "*" : ""}
                  </span>
                  <input
                    value={item.lotValue}
                    onChange={(event) => updateItem(item.id, "lotValue", event.target.value)}
                    placeholder={item.requireLot ? "Obrigatório" : "Opcional"}
                    className="h-11 w-full rounded-2xl px-3 text-sm outline-none"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "#0B1424", color: mobileColors.text }}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                    Validade {item.requireExpiry ? "*" : ""}
                  </span>
                  <input
                    type="date"
                    value={item.expiryValue}
                    onChange={(event) => updateItem(item.id, "expiryValue", event.target.value)}
                    className="h-11 w-full rounded-2xl px-3 text-sm outline-none"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "#0B1424", color: mobileColors.text }}
                  />
                </label>
              </div>

              <p className="mt-3 text-sm" style={{ color: missing > 0 ? mobileColors.amber : mobileColors.green }}>
                {missing > 0
                  ? `Faltam ${missing} ${item.unitLabel.toLowerCase()}.`
                  : "Item recebido conforme previsto."}
              </p>
            </div>
          );
        })}
      </section>

      {message ? (
        <section
          className="rounded-[24px] p-4 text-sm"
          style={{ border: `1px solid ${hexAlpha(mobileColors.green, 0.3)}`, background: hexAlpha(mobileColors.green, 0.1), color: mobileColors.green }}
        >
          {message}
        </section>
      ) : null}

      {error ? (
        <section
          className="rounded-[24px] p-4 text-sm"
          style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.3)}`, background: hexAlpha(mobileColors.red, 0.1), color: mobileColors.redLight }}
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      <div
        className="sticky bottom-20 z-20 rounded-[24px] p-4 shadow-2xl"
        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "rgba(10,17,32,0.95)" }}
      >
        <div className="mb-3 flex items-center justify-between gap-3 text-sm" style={{ color: mobileColors.muted }}>
          <span>{progress.percent}% concluído</span>
          <span>{progress.pending} un pendente(s)</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => void submitConference(false)}
            disabled={isSaving || !enderecoId}
            className="h-11 rounded-xl text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: hexAlpha("#94A3B8", 0.1), color: mobileColors.text, border: `1px solid ${hexAlpha("#94A3B8", 0.16)}` }}
          >
            {isSaving ? "Salvando..." : "Salvar conferência"}
          </button>
          <MobilePrimaryButton onClick={() => void submitConference(true)} disabled={isSaving || !enderecoId} style={{ height: 44 }}>
            {isSaving ? "Concluindo..." : "Concluir e lançar no estoque"}
          </MobilePrimaryButton>
        </div>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-3 py-3" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05) }}>
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: mobileColors.muted }}>{label}</p>
      <p className="mt-2 text-lg font-semibold" style={{ color: mobileColors.text, ...headingFont }}>{value}</p>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-3 py-2" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: "#0B1424" }}>
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: mobileColors.muted }}>{label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: mobileColors.text }}>{value}</p>
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
      return "Expedição";
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
