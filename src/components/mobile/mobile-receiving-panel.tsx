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
  MobileButtonSpinner,
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

const FLASH_DURATION_MS = 1300;

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
  const framePulseTimerRef = useRef<number | null>(null);
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
  // Item currently being counted inside the camera overlay, so the operator can
  // see how many units of it are still missing without leaving the scanner.
  const [scanItemId, setScanItemId] = useState<string | null>(null);
  // Item whose quantity just closed out and still needs lot/expiry: the scanner
  // steps aside for this form, then hands control back to the camera.
  const [lotPromptItemId, setLotPromptItemId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  // Brief green outline on the camera frame, used instead of the full-screen
  // flash while counting intermediate units of the same product.
  const [framePulse, setFramePulse] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Items short at the moment "Concluir" was pressed, shown for review before
  // the operator decides to close anyway or go back and keep scanning.
  const [divergenceReview, setDivergenceReview] = useState<ReceivingItemState[] | null>(null);

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

  const scanItem = items.find((item) => item.id === scanItemId) ?? null;
  const scanReceived = scanItem ? normalizeQuantity(scanItem.receivedQuantityValue) : 0;
  const scanMissing = scanItem ? Math.max(scanItem.expectedQuantity - scanReceived, 0) : 0;
  const lotPromptItem = items.find((item) => item.id === lotPromptItemId) ?? null;
  const isLotPromptComplete = lotPromptItem
    ? (!lotPromptItem.requireLot || Boolean(lotPromptItem.lotValue.trim())) &&
      (!lotPromptItem.requireExpiry || Boolean(lotPromptItem.expiryValue.trim()))
    : false;

  const applyScanRef = useRef<(code: string) => void>(() => {});
  const handleDetected = useCallback((code: string) => applyScanRef.current(code), []);

  const { videoRef, cameraStarting, cameraMessage, startCamera, stopCamera } = useCameraBarcodeScanner({
    onDetected: handleDetected,
    requirePresenceGap: true,
    confirmReads: 2,
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
      if (framePulseTimerRef.current) window.clearTimeout(framePulseTimerRef.current);
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

  /**
   * Vibration + beep, split out from flash() so a partial scan can confirm
   * itself without taking over the screen: mid-count units only pulse the
   * camera frame, and the full-screen flash is saved for the last unit.
   */
  function playFeedback(feedbackType: "ok" | "err" | "warn") {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(feedbackType === "ok" ? 60 : [70, 60, 70]);
    }

    const context = audioContextRef.current;
    if (!context) return;
    if (context.state === "suspended") {
      void context.resume();
    }

    const beep = (freq: number, wave: OscillatorType, startTime: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.value = freq;
      gain.gain.value = 0.05;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    const now = context.currentTime;
    if (feedbackType === "ok") {
      beep(880, "sine", now, 0.12);
    } else {
      beep(220, "square", now, 0.1);
      beep(180, "square", now + 0.14, 0.12);
    }
  }

  function flash(next: ScanOverlayState) {
    setOverlay(next);
    if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = window.setTimeout(() => setOverlay(null), FLASH_DURATION_MS);

    if (next) {
      playFeedback(next.type);
    }
  }

  /** Confirms a mid-count unit: green frame border + the usual beep/vibration. */
  function pulseFrame() {
    playFeedback("ok");
    setFramePulse(true);
    if (framePulseTimerRef.current) window.clearTimeout(framePulseTimerRef.current);
    framePulseTimerRef.current = window.setTimeout(() => setFramePulse(false), 420);
  }

  function confirmLotPrompt() {
    setLotPromptItemId(null);
    // Hand control straight back to the camera so the operator keeps the rhythm
    // instead of having to press "Bipar item" again after every lot-controlled
    // product.
    openScanner();
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
      flash({ type: "err", title: "Não encontrado", code: rawValue, sub: "Código não encontrado neste recebimento." });
      return;
    }

    const current = normalizeQuantity(matchedItem.receivedQuantityValue);

    if (current >= matchedItem.expectedQuantity) {
      flash({
        type: "warn",
        title: "Quantidade completa",
        code: matchedItem.sku,
        sub: `Este item já tem as ${matchedItem.expectedQuantity} unidades previstas.`,
      });
      return;
    }

    const nextQuantity = current + 1;
    const isComplete = nextQuantity >= matchedItem.expectedQuantity;
    const needsLotOrExpiry =
      (matchedItem.requireLot && !matchedItem.lotValue.trim()) ||
      (matchedItem.requireExpiry && !matchedItem.expiryValue.trim());

    setItems((list) =>
      list.map((item) =>
        item.id === matchedItem.id
          ? { ...item, receivedQuantityValue: String(nextQuantity) }
          : item,
      ),
    );

    setActiveItemId(matchedItem.id);
    setScanItemId(matchedItem.id);
    setError(null);
    setMessage(null);

    if (!isComplete) {
      // Mid-count unit: keep the camera visible and just pulse the frame, so
      // the operator can scan the next unit without waiting out a full-screen
      // flash between every single one.
      pulseFrame();
      return;
    }

    flash({
      type: "ok",
      title: "Item completo",
      code: matchedItem.sku,
      sub: `${nextQuantity}/${matchedItem.expectedQuantity} recebido(s).`,
    });

    // Quantity closed out: hand the screen over to the lot/expiry form when the
    // product requires it, otherwise clear the counter and keep scanning.
    if (needsLotOrExpiry) {
      window.setTimeout(() => {
        closeScanner();
        setScanItemId(null);
        setLotPromptItemId(matchedItem.id);
      }, FLASH_DURATION_MS);
      return;
    }

    window.setTimeout(() => setScanItemId(null), FLASH_DURATION_MS);
  }

  useEffect(() => {
    applyScanRef.current = applyScan;
  });

  function getShortItems() {
    return items.filter((item) => normalizeQuantity(item.receivedQuantityValue) !== item.expectedQuantity);
  }

  function handleConcluirClick() {
    const shortItems = getShortItems();
    if (shortItems.length === 0) {
      void submitConference(true);
      return;
    }
    setDivergenceReview(shortItems);
  }

  async function submitConference(finalizar: boolean, confirmarDivergencia = false) {
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
          confirmarDivergencia,
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
        setDivergenceReview(null);
        router.push(`/m/recebimento?feedback=${confirmarDivergencia ? "incompleto" : "concluido"}`);
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
            {depositante ? `${orderCode} · ${depositante}` : orderCode}
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
            const isDone = item.expectedQuantity > 0 && received >= item.expectedQuantity;
            const isActive = activeItemId === item.id;

            return (
              <div
                key={item.id}
                ref={(element) => {
                  itemRefs.current[item.id] = element;
                }}
                className="flex items-center gap-3 rounded-[16px] p-[14px] transition-colors"
                style={{
                  border: `1px solid ${hexAlpha(isActive ? mobileColors.violet : "#94A3B8", isActive ? 0.5 : 0.14)}`,
                  background: hexAlpha(isActive ? mobileColors.violet : "#94A3B8", isActive ? 0.1 : 0.045),
                }}
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
                  <span className="truncate text-[12px] font-semibold" style={{ color: mobileColors.blueLight, ...headingFont }}>
                    {item.sku}
                  </span>
                </div>

                <span
                  className="shrink-0 text-[15px] font-extrabold"
                  style={{ color: isDone ? mobileColors.green : mobileColors.text, ...headingFont }}
                >
                  {received}/{item.expectedQuantity}
                </span>
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
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openScanner}
            className="flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-white"
            style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
          >
            <MobileIcon name="scan" size={18} strokeWidth={2} />
            Bipar item
          </button>
          <MobilePrimaryButton
            onClick={handleConcluirClick}
            disabled={isSaving || !enderecoId}
            style={{
              height: 48,
              background: isSaving || !enderecoId ? undefined : mobileColors.green,
              boxShadow: isSaving || !enderecoId ? undefined : "0 10px 26px rgba(16,185,129,0.4)",
            }}
          >
            {isSaving ? <MobileButtonSpinner /> : "Concluir"}
          </MobilePrimaryButton>
        </div>
      </div>

      {scannerOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "#000",
            // Without this the middle section's `flex: 1` is inert and the
            // focus frame stacks right under the header instead of centering.
            display: "flex",
            flexDirection: "column",
          }}
        >
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

          {/* Only the frame lives in the centered area, so it stays put in the
              middle of the screen instead of being pushed up once the unit
              progress appears. */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 250,
                height: 160,
                borderRadius: 22,
                border: `2.5px ${framePulse ? "solid" : "dashed"} ${
                  framePulse ? mobileColors.green : hexAlpha("#ffffff", 0.7)
                }`,
                boxShadow: framePulse ? `0 0 22px ${hexAlpha(mobileColors.green, 0.65)}` : "none",
                transition: "border-color 0.12s ease, box-shadow 0.12s ease",
              }}
            />
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 9,
              padding: "0 24px calc(36px + env(safe-area-inset-bottom))",
              textAlign: "center",
            }}
          >
            {scanItem ? (
              <>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 800, ...headingFont }}>
                  {scanItem.description}
                </span>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, ...headingFont }}>
                  {scanReceived} de {scanItem.expectedQuantity} unidades
                </span>
                {scanItem.expectedQuantity <= 12 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 7, maxWidth: 260 }}>
                    {Array.from({ length: scanItem.expectedQuantity }).map((_, index) => {
                      const collected = index < scanReceived;
                      return (
                        <span
                          key={index}
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: "50%",
                            background: collected ? mobileColors.green : "transparent",
                            border: `2px solid ${collected ? mobileColors.green : "rgba(255,255,255,0.45)"}`,
                            transition: "background 0.2s ease",
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ width: 220, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 999,
                        background: mobileColors.green,
                        width: `${Math.round((scanReceived / scanItem.expectedQuantity) * 100)}%`,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}
                {scanMissing > 0 ? (
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5 }}>
                    Faltam {scanMissing} {scanMissing === 1 ? "unidade" : "unidades"}
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.78)", fontSize: 12.5 }}>
                {cameraStarting ? "Abrindo câmera..." : cameraMessage ?? "Posicione o código dentro da moldura"}
              </span>
            )}
          </div>

          <MobileScanOverlay overlay={overlay} />
        </div>
      ) : null}

      {lotPromptItem ? (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(5,7,13,0.75)", display: "flex", alignItems: "flex-end" }}
        >
          <div
            className="w-full"
            style={{
              background: mobileColors.bgAlt,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTop: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
              padding: "22px 18px calc(22px + env(safe-area-inset-bottom))",
            }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px]"
                style={{ background: hexAlpha(mobileColors.green, 0.16), color: mobileColors.green }}
              >
                <MobileIcon name="check" size={20} strokeWidth={2.6} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px] font-extrabold" style={{ color: mobileColors.text }}>
                  {lotPromptItem.description}
                </span>
                <span className="text-[12px]" style={{ color: mobileColors.muted }}>
                  {lotPromptItem.expectedQuantity} de {lotPromptItem.expectedQuantity} bipadas
                </span>
              </div>
            </div>

            {lotPromptItem.requireLot ? (
              <label className="mb-3 flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                  Lote *
                </span>
                <input
                  autoFocus
                  value={lotPromptItem.lotValue}
                  onChange={(event) => updateItem(lotPromptItem.id, "lotValue", event.target.value)}
                  placeholder="Informe o lote"
                  className="h-12 w-full rounded-2xl px-3.5 text-base outline-none"
                  style={{ border: `1px solid ${hexAlpha(mobileColors.violet, 0.35)}`, background: "#0B1424", color: mobileColors.text }}
                />
              </label>
            ) : null}

            {lotPromptItem.requireExpiry ? (
              <label className="mb-3 flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                  Validade *
                </span>
                <input
                  type="date"
                  value={lotPromptItem.expiryValue}
                  onChange={(event) => updateItem(lotPromptItem.id, "expiryValue", event.target.value)}
                  className="h-12 w-full rounded-2xl px-3.5 text-base outline-none"
                  style={{ border: `1px solid ${hexAlpha(mobileColors.violet, 0.35)}`, background: "#0B1424", color: mobileColors.text }}
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={confirmLotPrompt}
              disabled={!isLotPromptComplete}
              className="mt-1 flex h-[56px] w-full items-center justify-center gap-2 rounded-[17px] text-[16px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
            >
              <MobileIcon name="scan" size={19} strokeWidth={2} />
              Salvar e continuar bipando
            </button>

            <button
              type="button"
              onClick={() => setLotPromptItemId(null)}
              className="mt-2 h-11 w-full rounded-xl text-[13px] font-bold"
              style={{ color: mobileColors.muted }}
            >
              Preencher depois
            </button>
          </div>
        </div>
      ) : null}

      {divergenceReview ? (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(5,7,13,0.75)", display: "flex", alignItems: "flex-end" }}
        >
          <div
            className="w-full"
            style={{
              background: mobileColors.bgAlt,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTop: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
              padding: "22px 18px calc(22px + env(safe-area-inset-bottom))",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px]"
                style={{ background: hexAlpha(mobileColors.amber, 0.16), color: mobileColors.amber }}
              >
                <AlertTriangle className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-extrabold" style={{ color: mobileColors.text }}>
                  {divergenceReview.length === 1 ? "1 item não bateu a quantidade" : `${divergenceReview.length} itens não bateram a quantidade`}
                </span>
                <span className="text-[12px]" style={{ color: mobileColors.muted }}>
                  Confira o que falta antes de concluir.
                </span>
              </div>
            </div>

            <div className="app-scroll mb-4 flex flex-col gap-2 overflow-y-auto">
              {divergenceReview.map((item) => {
                const received = normalizeQuantity(item.receivedQuantityValue);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl px-3.5 py-3"
                    style={{ border: `1px solid ${hexAlpha(mobileColors.amber, 0.25)}`, background: hexAlpha(mobileColors.amber, 0.06) }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[13.5px] font-bold" style={{ color: mobileColors.text }}>
                        {item.description}
                      </span>
                      <span className="text-[11.5px]" style={{ color: mobileColors.muted }}>
                        {item.sku}
                      </span>
                    </div>
                    <span className="shrink-0 text-[14px] font-extrabold" style={{ color: mobileColors.amber, ...headingFont }}>
                      {received}/{item.expectedQuantity}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void submitConference(true, true)}
              disabled={isSaving}
              className="flex h-[56px] w-full items-center justify-center gap-2 rounded-[17px] text-[16px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: mobileColors.amber, boxShadow: "0 10px 26px rgba(245,158,11,0.35)" }}
            >
              {isSaving ? <MobileButtonSpinner /> : "Concluir com divergência"}
            </button>

            <button
              type="button"
              onClick={() => setDivergenceReview(null)}
              disabled={isSaving}
              className="mt-2 h-11 w-full rounded-xl text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
              style={{ color: mobileColors.muted }}
            >
              Voltar para o recebimento
            </button>
          </div>
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
