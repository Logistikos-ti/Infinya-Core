"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import {
  mobileColors,
  mobileGradient,
  hexAlpha,
  headingFont,
  MobileBackButton,
  MobileScanOverlay,
  MobileIcon,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

const FLASH_DURATION_MS = 1300;

function normalizeScan(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

type Props = {
  depositanteId: string;
  depositanteNome: string;
  estoqueId: string;
  produtoNome: string;
  produtoSku: string;
  produtoBarcode: string | null;
  produtoCodigoInterno: string | null;
  produtoImagemUrl: string | null;
  enderecoCodigo: string;
  enderecoArea: string;
  quantidadeSistema: number;
};

type ScanPhase = "address" | "product" | "count";

export function MobileCycleCountPanel({
  depositanteId,
  depositanteNome,
  estoqueId,
  produtoNome,
  produtoSku,
  produtoBarcode,
  produtoCodigoInterno,
  produtoImagemUrl,
  enderecoCodigo,
  enderecoArea,
  quantidadeSistema,
}: Props) {
  const router = useRouter();
  const [scanPhase, setScanPhase] = useState<ScanPhase>("address");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [count, setCount] = useState(0);
  const [editingCount, setEditingCount] = useState(false);
  const [countInputValue, setCountInputValue] = useState("0");
  const [confirmed, setConfirmed] = useState(false);
  const [match, setMatch] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const countInputRef = useRef<HTMLInputElement | null>(null);

  const applyScanRef = useRef<(code: string) => void>(() => {});
  const handleDetected = useCallback((code: string) => applyScanRef.current(code), []);

  const { videoRef, cameraStarting, cameraMessage, startCamera, stopCamera } = useCameraBarcodeScanner({
    onDetected: handleDetected,
    requirePresenceGap: true,
    confirmReads: 2,
  });

  // The scanner opens on its own as soon as the operator lands on a product:
  // there is nothing else to do here before bipping the address, so making
  // them tap a button first would just be an extra step.
  useEffect(() => {
    setScannerOpen(true);
  }, []);

  useEffect(() => {
    if (scannerOpen) void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (editingCount) countInputRef.current?.focus();
  }, [editingCount]);

  function playFeedback(feedbackType: "ok" | "err") {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(feedbackType === "ok" ? 60 : [70, 60, 70]);
    }

    const AudioContextRef =
      typeof window === "undefined"
        ? undefined
        : window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextRef) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextRef();
    }
    const context = audioContextRef.current;
    if (context.state === "suspended") void context.resume();

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
    if (next) playFeedback(next.type === "err" ? "err" : "ok");
  }

  function applyScan(rawValue: string) {
    const normalized = normalizeScan(rawValue);
    if (!normalized) return;

    if (scanPhase === "address") {
      const expected = normalizeScan(enderecoCodigo);
      if (!expected || normalized !== expected) {
        flash({ type: "err", title: "Endereço incorreto", code: rawValue, sub: "Bipe o endereço indicado na tela." });
        return;
      }
      flash({ type: "ok", title: "Endereço OK", code: enderecoCodigo, sub: produtoNome });
      setScanPhase("product");
      return;
    }

    if (scanPhase === "product") {
      const candidates = [produtoBarcode, produtoCodigoInterno, produtoSku].filter(Boolean) as string[];
      const matches = candidates.some((value) => normalizeScan(value) === normalized);
      if (!matches) {
        flash({ type: "err", title: "Produto incorreto", code: rawValue, sub: "Este código não pertence a este produto." });
        return;
      }
      flash({ type: "ok", title: "Produto OK", code: produtoSku, sub: "Informe a quantidade contada" });
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        setScanPhase("count");
        stopCamera(null);
        setScannerOpen(false);
      }, FLASH_DURATION_MS);
    }
  }

  useEffect(() => {
    applyScanRef.current = applyScan;
  });

  function commitCountInput() {
    const parsed = Number(countInputValue.replace(",", "."));
    setCount(Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0);
    setEditingCount(false);
  }

  async function handleConfirm() {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const createResponse = await fetch("/api/estoque/inventarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositanteId,
          titulo: `Contagem rápida — ${produtoNome} (${produtoSku})`,
          area: enderecoArea,
          estoqueId,
        }),
      });
      const createBody = await createResponse.json();
      if (!createResponse.ok) throw new Error(createBody.error ?? "Não foi possível abrir a contagem.");
      const cycleCountId: string = createBody.result.id;
      const itemId: string = createBody.result.itemIds[0];

      const updateResponse = await fetch(`/api/estoque/inventarios/itens/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedQuantity: count }),
      });
      const updateBody = await updateResponse.json();
      if (!updateResponse.ok) throw new Error(updateBody.error ?? "Não foi possível registrar a contagem.");
      const isMatch: boolean = updateBody.result.status === "CONTADO";

      const completeResponse = await fetch("/api/estoque/inventarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "concluir", cycleCountId }),
      });
      const completeBody = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completeBody.error ?? "Não foi possível concluir a contagem.");

      setMatch(isMatch);
      playFeedback(isMatch ? "ok" : "err");
      setOverlay(
        isMatch
          ? { type: "ok", title: "Confere!", code: `${count} un`, sub: "Contagem igual ao sistema" }
          : { type: "warn", title: "Divergência", code: `${count} un (sistema: ${quantidadeSistema})`, sub: "Registrado para auditoria" },
      );
      overlayTimerRef.current = window.setTimeout(() => {
        setOverlay(null);
        setConfirmed(true);
      }, FLASH_DURATION_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar a contagem.");
    } finally {
      setIsSaving(false);
    }
  }

  const phaseColor = mobileColors.amber;
  const scanTitle =
    scanPhase === "address" ? "Bipe o endereço" : scanPhase === "product" ? "Bipe o produto" : "Confirme a contagem";

  return (
    <div className="relative flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      <MobileScanOverlay overlay={scannerOpen ? null : overlay} />

      <div className="flex shrink-0 items-center gap-3 px-[18px] pb-3 pt-[18px]">
        <MobileBackButton onClick={() => router.push(`/m/estoque/inventarios/${depositanteId}`)} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[16px] font-extrabold" style={headingFont}>
            Inventário
          </span>
          <span className="text-[12px]" style={{ color: mobileColors.muted }}>
            {depositanteNome}
          </span>
        </div>
        <span
          className="rounded-full px-[11px] py-[5px] text-[11.5px] font-extrabold"
          style={{
            background: hexAlpha(confirmed ? mobileColors.green : phaseColor, 0.16),
            color: confirmed ? mobileColors.green : phaseColor,
          }}
        >
          {confirmed ? "Contado" : enderecoCodigo}
        </span>
      </div>

      <div
        className="app-scroll flex flex-1 flex-col gap-4 overflow-y-auto px-[18px]"
        style={{ paddingBottom: !confirmed && scanPhase === "count" ? 158 : 18 }}
      >
        {confirmed ? (
          <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  border: `2px solid ${match ? mobileColors.green : mobileColors.amber}`,
                  animation: "mobileRingPulse 1.6s ease-out infinite",
                }}
              />
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  background: hexAlpha(match ? mobileColors.green : mobileColors.amber, 0.16),
                  color: match ? mobileColors.green : mobileColors.amber,
                }}
              >
                <MobileIcon name={match ? "check" : "clip"} size={40} strokeWidth={2.6} />
              </span>
            </div>
            <span className="text-[21px] font-bold" style={headingFont}>
              {match ? "Contagem confere!" : "Divergência registrada"}
            </span>
            <span className="max-w-[260px] text-[13.5px] leading-relaxed" style={{ color: mobileColors.muted }}>
              {match
                ? "A quantidade contada bate com o sistema. Item validado."
                : "A contagem diverge do sistema. A divergência foi registrada para auditoria do supervisor."}
            </span>
          </div>
        ) : (
          <div
            className="flex flex-col gap-3.5 rounded-[20px] p-[18px]"
            style={{ border: `1px solid ${hexAlpha(phaseColor, 0.3)}`, background: hexAlpha("#94A3B8", 0.04) }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] text-[13px] font-extrabold"
                style={{ background: hexAlpha(phaseColor, 0.18), color: phaseColor, ...headingFont }}
              >
                {scanPhase === "address" ? "1" : scanPhase === "product" ? "2" : "3"}
              </span>
              <span className="text-[13px] font-extrabold uppercase tracking-wide" style={{ color: phaseColor }}>
                {scanTitle}
              </span>
            </div>

            <div className="flex items-center gap-[13px]">
              <div
                className="flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
                style={{
                  background: produtoImagemUrl
                    ? "#fff"
                    : `linear-gradient(140deg, ${phaseColor} 0%, ${hexAlpha(phaseColor, 0.55)} 100%)`,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {produtoImagemUrl ? (
                  <Image
                    src={produtoImagemUrl}
                    alt={produtoNome}
                    width={54}
                    height={54}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <MobileIcon name="box" size={24} />
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[16px] font-extrabold leading-tight">{produtoNome}</span>
                <span className="text-[12.5px]" style={{ color: mobileColors.muted, ...headingFont }}>
                  {produtoSku}
                </span>
              </div>
            </div>

            {scanPhase !== "count" ? (
              <div
                className="flex items-center gap-3 rounded-[15px] p-4"
                style={{ background: "rgba(5,7,13,0.5)", border: `1px dashed ${hexAlpha(phaseColor, 0.4)}` }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]"
                  style={{ background: hexAlpha(phaseColor, 0.16), color: phaseColor }}
                >
                  <MobileIcon name={scanPhase === "address" ? "loc" : "code"} size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[11px] uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                    {scanPhase === "address" ? "Endereço a contar" : "Código de barras"}
                  </span>
                  <span className="truncate text-[24px] font-bold tracking-wide" style={{ color: mobileColors.text, ...headingFont }}>
                    {scanPhase === "address" ? enderecoCodigo : produtoBarcode || produtoSku}
                  </span>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col gap-3 rounded-[15px] p-4"
                style={{ background: "rgba(5,7,13,0.5)", border: `1px dashed ${hexAlpha(mobileColors.green, 0.4)}` }}
              >
                <span className="text-center text-[12.5px] font-bold" style={{ color: mobileColors.muted }}>
                  Quantidade contada
                </span>
                <div className="flex items-center justify-center gap-[18px]">
                  <button
                    type="button"
                    onClick={() => setCount((current) => Math.max(0, current - 1))}
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] text-[26px] font-bold"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: hexAlpha("#94A3B8", 0.08), color: mobileColors.text }}
                  >
                    &minus;
                  </button>
                  {editingCount ? (
                    <input
                      ref={countInputRef}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={countInputValue}
                      onChange={(event) => setCountInputValue(event.target.value)}
                      onBlur={commitCountInput}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitCountInput();
                        }
                      }}
                      className="w-[100px] rounded-xl border-0 bg-transparent text-center text-[38px] font-bold outline-none"
                      style={{ color: mobileColors.text, ...headingFont }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCountInputValue(String(count));
                        setEditingCount(true);
                      }}
                      className="min-w-[90px] text-center text-[46px] font-bold"
                      style={{ color: mobileColors.text, ...headingFont }}
                    >
                      {count}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCount((current) => current + 1)}
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] text-[26px] font-bold"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: hexAlpha("#94A3B8", 0.08), color: mobileColors.text }}
                  >
                    +
                  </button>
                </div>
                <span className="text-center text-[11.5px]" style={{ color: mobileColors.dim }}>
                  Sistema registra {quantidadeSistema} un neste endereço · toque no número para digitar
                </span>
              </div>
            )}
          </div>
        )}

        {error ? (
          <div
            className="rounded-2xl p-3 text-[12.5px]"
            style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.3)}`, background: hexAlpha(mobileColors.red, 0.08), color: mobileColors.redLight }}
          >
            {error}
          </div>
        ) : null}
      </div>

      {!confirmed && scanPhase === "count" ? (
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
            onClick={handleConfirm}
            disabled={isSaving || editingCount}
            className="flex h-[62px] items-center justify-center gap-2 rounded-[17px] text-[16.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
          >
            {isSaving ? "Confirmando..." : "Confirmar contagem"}
          </button>
        </div>
      ) : null}

      {scannerOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "#000",
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
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              padding: "18px",
              paddingTop: "calc(18px + env(safe-area-inset-top))",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 800, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {scanPhase === "address" ? "Bipe o endereço" : "Bipe o produto"}
              </span>
              <span
                style={{
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: scanPhase === "address" ? 22 : 17,
                  lineHeight: 1.15,
                  display: "-webkit-box",
                  WebkitLineClamp: scanPhase === "address" ? 1 : 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  ...headingFont,
                }}
              >
                {scanPhase === "address" ? enderecoCodigo : produtoNome}
              </span>
              {scanPhase === "product" ? (
                <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, ...headingFont }}>{produtoSku}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => router.push(`/m/estoque/inventarios/${depositanteId}`)}
              style={{
                width: 38,
                height: 38,
                flexShrink: 0,
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

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "0 24px calc(36px + env(safe-area-inset-bottom))",
              textAlign: "center",
            }}
          >
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
