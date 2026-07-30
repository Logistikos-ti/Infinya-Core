"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import type { ReceivingOrderDetail } from "@/lib/receiving";
import {
  mobileColors,
  mobileGradient,
  hexAlpha,
  headingFont,
  MobileBackButton,
  MobilePrimaryButton,
  MobileScanOverlay,
  MobileIcon,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

type AddressOption = {
  id: string;
  codigo: string;
  area: string;
};

type MobileReceivingPanelProps = {
  orderId: string;
  orderCode: string;
  depositante: string;
  supplier: string;
  status: string;
  eta: string;
  noteNumber: string;
  volumes: number;
  skuCount: number;
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

const FLASH_DURATION_MS = 1800;

export function MobileReceivingPanel({
  orderId,
  orderCode,
  depositante,
  supplier,
  status,
  eta,
  noteNumber,
  volumes,
  skuCount,
  initialItems,
  addresses,
}: MobileReceivingPanelProps) {
  const router = useRouter();
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const overlayTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
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
  // The operator no longer picks a destination here: addressing is handled as
  // its own step (finalizing creates an "ENDERECAMENTO" task). We still need a
  // destination for the stock entry, so default to the first address the page
  // resolved (receiving/staging areas when they exist).
  const [enderecoId] = useState(addresses[0]?.id ?? "");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
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

  const applyScanRef = useRef<(code: string) => void>(() => {});
  const handleDetected = useCallback((code: string) => applyScanRef.current(code), []);

  const { videoRef, cameraStarting, cameraMessage, startCamera, stopCamera } = useCameraBarcodeScanner({
    onDetected: handleDetected,
    requirePresenceGap: true,
    confirmReads: 2,
    confirmMisses: 4,
  });

  useEffect(() => {
    if (scannerOpen) void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  useEffect(() => {
    if (!activeItemId) return;
    itemRefs.current[activeItemId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeItemId]);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
      void audioContextRef.current?.close();
    };
  }, []);

  function unlockAudio() {
    if (typeof window === "undefined") return;
    const AudioContextRef =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextRef) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextRef();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
  }

  function openScanner() {
    // Must run inside this direct tap handler: mobile browsers only allow
    // an AudioContext to unlock/resume during a genuine user gesture, and
    // the barcode-detection callback that later triggers flash()/beep()
    // runs async, well outside any gesture, so it can't unlock audio itself.
    unlockAudio();
    setScannerOpen(true);
  }

  function closeScanner() {
    stopCamera(null);
    setScannerOpen(false);
  }

  function flash(next: ScanOverlayState) {
    setOverlay(next);
    if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = window.setTimeout(() => setOverlay(null), FLASH_DURATION_MS);

    if (!next) return;

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(next.type === "ok" ? 60 : [70, 60, 70]);
    }

    const context = audioContextRef.current;
    if (!context) return;
    if (context.state === "suspended") {
      void context.resume();
    }

    const beep = (freq: number, type: OscillatorType, startTime: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = freq;
      gain.gain.value = 0.05;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    const now = context.currentTime;
    if (next.type === "ok") {
      beep(880, "sine", now, 0.12);
    } else {
      beep(220, "square", now, 0.1);
      beep(180, "square", now + 0.14, 0.12);
    }
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
    if (!normalizedScan) return;

    const matchedItem = items.find((item) =>
      [item.barcode, item.internalCode, item.sku]
        .filter(Boolean)
        .some((value) => normalizeScan(value) === normalizedScan),
    );

    if (!matchedItem) {
      setActiveItemId(null);
      flash({ type: "err", title: "Não encontrado", code: rawValue, sub: "Código não encontrado neste recebimento." });
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
    // Auto-open items that still need lot/expiry, so the operator fills them
    // while holding the product instead of hunting for them before submitting.
    if (
      (matchedItem.requireLot && !matchedItem.lotValue.trim()) ||
      (matchedItem.requireExpiry && !matchedItem.expiryValue.trim())
    ) {
      setExpandedItemId(matchedItem.id);
    }
    flash({
      type: "ok",
      title: "Volume recebido",
      code: matchedItem.sku,
      sub: `${nextQuantity}/${matchedItem.expectedQuantity} recebido(s).`,
    });
    setError(null);
    setMessage(null);
  }

  useEffect(() => {
    applyScanRef.current = applyScan;
  });

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
        return;
      }

      setMessage(result.message ?? "Conferência atualizada com sucesso.");

      if (finalizar) {
        router.push("/m/recebimento?feedback=concluido");
        return;
      }
    } catch {
      setError("Falha de comunicação com a API do recebimento.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      <MobileScanOverlay overlay={overlay} />

      <div className="flex shrink-0 items-center gap-3 px-[18px] pb-3 pt-[18px]">
        <MobileBackButton onClick={() => router.push("/m/recebimento")} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[16px] font-extrabold" style={headingFont}>
            Recebimento
          </span>
          <span className="truncate text-[12px]" style={{ color: mobileColors.muted }}>
            {orderCode} · {depositante}
          </span>
        </div>
        <span
          className="rounded-full px-[11px] py-[5px] text-[11.5px] font-extrabold"
          style={{ background: hexAlpha(mobileColors.violet, 0.16), color: mobileColors.violetLight }}
        >
          {progress.percent}%
        </span>
      </div>

      <div
        className="app-scroll flex flex-1 flex-col gap-3.5 overflow-y-auto px-[18px]"
        style={{ paddingBottom: 152 }}
      >
        <div
          className="flex flex-col gap-3 rounded-[20px] p-[16px]"
          style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`, background: hexAlpha("#94A3B8", 0.045) }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px]"
                style={{ background: hexAlpha(mobileColors.violet, 0.16), color: mobileColors.violetLight }}
              >
                <MobileIcon name="inbound" size={20} />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-extrabold" style={headingFont}>{supplier}</span>
                <span className="text-[12px]" style={{ color: mobileColors.muted }}>NF {noteNumber} · {eta}</span>
              </div>
            </div>
            <span
              className="shrink-0 rounded-full px-[10px] py-[4px] text-[11px] font-extrabold"
              style={{ background: hexAlpha(mobileColors.amber, 0.16), color: mobileColors.amber }}
            >
              {status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniInfo label="Previsto" value={String(progress.expected)} />
            <MiniInfo label="Recebido" value={String(progress.received)} />
            <MiniInfo label="Pendente" value={String(progress.pending)} />
          </div>
        </div>

        {!enderecoId ? (
          <div
            className="rounded-[18px] p-4 text-sm"
            style={{
              border: `1px solid ${hexAlpha(mobileColors.amber, 0.3)}`,
              background: hexAlpha(mobileColors.amber, 0.1),
              color: mobileColors.amber,
            }}
          >
            Nenhum endereço ativo cadastrado no armazém, então esta conferência não pode ser
            concluída. Fale com a operação.
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5">
          <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: mobileColors.dim }}>
            {skuCount} {skuCount === 1 ? "item" : "itens"} · {volumes} volumes previstos
          </span>
          {items.map((item) => {
            const received = normalizeQuantity(item.receivedQuantityValue);
            const missing = Math.max(item.expectedQuantity - received, 0);
            const isDone = item.expectedQuantity > 0 && received >= item.expectedQuantity;
            const isActive = activeItemId === item.id;
            const isExpanded = expandedItemId === item.id;
            // Surfaced on the collapsed row so the operator can see up front which
            // items still block finishing, instead of discovering it on submit.
            const missingRequired =
              (item.requireLot && !item.lotValue.trim()) ||
              (item.requireExpiry && !item.expiryValue.trim());

            return (
              <div
                key={item.id}
                ref={(element) => {
                  itemRefs.current[item.id] = element;
                }}
                className="overflow-hidden rounded-[16px] transition-colors"
                style={{
                  border: `1px solid ${hexAlpha(isActive ? mobileColors.violet : "#94A3B8", isActive ? 0.5 : 0.14)}`,
                  background: hexAlpha(isActive ? mobileColors.violet : "#94A3B8", isActive ? 0.1 : 0.045),
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  className="flex w-full items-center gap-3 p-[14px] text-left"
                >
                  <span
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]"
                    style={{
                      border: `2px solid ${
                        isDone
                          ? mobileColors.green
                          : isActive
                            ? mobileColors.violet
                            : hexAlpha("#94A3B8", 0.35)
                      }`,
                      background: isDone
                        ? mobileColors.green
                        : isActive
                          ? hexAlpha(mobileColors.violet, 0.35)
                          : "transparent",
                    }}
                  >
                    {isDone ? <MobileIcon name="check" size={13} strokeWidth={3} /> : null}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="truncate text-[14.5px] font-extrabold" style={{ color: mobileColors.text }}>
                      {item.description}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-semibold" style={{ color: mobileColors.blueLight, ...headingFont }}>
                        {item.sku}
                      </span>
                      {missingRequired ? (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-[1px] text-[10px] font-bold"
                          style={{ background: hexAlpha(mobileColors.amber, 0.16), color: mobileColors.amber }}
                        >
                          {item.requireLot && !item.lotValue.trim() ? "lote" : "validade"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <span
                    className="shrink-0 text-[15px] font-extrabold"
                    style={{ color: isDone ? mobileColors.green : mobileColors.text, ...headingFont }}
                  >
                    {received}/{item.expectedQuantity}
                  </span>
                </button>

                {isExpanded ? (
                  <div className="border-t px-[14px] pb-[14px] pt-3" style={{ borderColor: hexAlpha("#94A3B8", 0.14) }}>
                    <p className="mb-3 text-[11.5px]" style={{ color: mobileColors.dim }}>
                      Código {item.internalCode || "-"} · EAN {item.barcode || "-"}
                    </p>

                    <label className="flex flex-col gap-1">
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

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
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

                      <label className="flex flex-col gap-1">
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

                    <p className="mt-3 text-[12.5px]" style={{ color: missing > 0 ? mobileColors.amber : mobileColors.green }}>
                      {missing > 0
                        ? `Faltam ${missing} ${item.unitLabel.toLowerCase()}.`
                        : "Item recebido conforme previsto."}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {message ? (
          <div
            className="rounded-[18px] p-4 text-sm"
            style={{ border: `1px solid ${hexAlpha(mobileColors.green, 0.3)}`, background: hexAlpha(mobileColors.green, 0.1), color: mobileColors.green }}
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            className="rounded-[18px] p-4 text-sm"
            style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.3)}`, background: hexAlpha(mobileColors.red, 0.1), color: mobileColors.redLight }}
          >
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="left-1/2 flex w-full max-w-md -translate-x-1/2 flex-col gap-2.5 px-[18px] pt-3"
        style={{
          position: "fixed",
          bottom: 0,
          paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
          background: "linear-gradient(180deg, rgba(10,17,32,0) 0%, #0A1120 22%)",
        }}
      >
        <button
          type="button"
          onClick={openScanner}
          className="flex h-[62px] items-center justify-center gap-2 rounded-[17px] text-[16.5px] font-extrabold text-white"
          style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
        >
          <MobileIcon name="scan" size={20} strokeWidth={2} />
          Bipar item
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void submitConference(false)}
            disabled={isSaving || !enderecoId}
            className="h-12 rounded-xl text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: hexAlpha("#94A3B8", 0.1), color: mobileColors.text, border: `1px solid ${hexAlpha("#94A3B8", 0.16)}` }}
          >
            {isSaving ? "Salvando..." : "Salvar conferência"}
          </button>
          <MobilePrimaryButton onClick={() => void submitConference(true)} disabled={isSaving || !enderecoId} style={{ height: 48 }}>
            {isSaving ? "Concluindo..." : "Concluir"}
          </MobilePrimaryButton>
        </div>
      </div>

      {scannerOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.65) 100%)",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px",
              paddingTop: "calc(18px + env(safe-area-inset-top))",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, ...headingFont }}>
              Bipe qualquer item do pedido
            </span>
            <button
              type="button"
              onClick={() => closeScanner()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MobileIcon name="x" size={18} strokeWidth={2.6} />
            </button>
          </div>

          <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                width: 250,
                height: 160,
                borderRadius: 22,
                border: `2.5px dashed ${hexAlpha("#ffffff", 0.7)}`,
              }}
            />
          </div>

          <div style={{ position: "relative", zIndex: 2, padding: "0 24px calc(40px + env(safe-area-inset-bottom))", textAlign: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.78)", fontSize: 12.5 }}>
              {cameraStarting ? "Abrindo câmera..." : cameraMessage ?? "Posicione o código dentro da moldura"}
            </span>
          </div>

          <MobileScanOverlay overlay={overlay} />
        </div>
      ) : null}
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
