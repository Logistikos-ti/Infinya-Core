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
  MobileButtonSpinner,
  MobileIcon,
  MobileScanConfirmPrompt,
  MobileScanOverlay,
  type ScanConfirmPromptState,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";
import { resolveCycleCountScan } from "@/lib/cycle-count-scan";

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

const FLASH_DURATION_MS = 1300;

/**
 * O produto + endereço já foram confirmados antes de chegar aqui -- bipados
 * na tela anterior (inventario-scan-client.tsx), que resolveu (ou abriu,
 * para uma contagem cega) esse estoqueId exato. Aqui a câmera abre sozinha
 * e o operador bipa unidade por unidade do MESMO produto (mesma
 * câmera/configuração do recebimento: requirePresenceGap + confirmReads) até
 * bater a quantidade esperada -- sem digitação manual. "Confirmar contagem"
 * mantém a mesma lógica de sempre (cria a contagem, grava o item, conclui),
 * só muda de onde `count` vem.
 */
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
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [confirmPrompt, setConfirmPrompt] = useState<ScanConfirmPromptState>(null);
  const [count, setCount] = useState(0);
  const [framePulse, setFramePulse] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [match, setMatch] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayTimerRef = useRef<number | null>(null);
  const framePulseTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scanBusyRef = useRef(false);
  const pendingSurplusNextCountRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
      if (framePulseTimerRef.current) window.clearTimeout(framePulseTimerRef.current);
      void audioContextRef.current?.close();
    };
  }, []);

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

  /** Confirma uma unidade intermediária: borda verde + beep, câmera continua. */
  function pulseFrame() {
    playFeedback("ok");
    setFramePulse(true);
    if (framePulseTimerRef.current) window.clearTimeout(framePulseTimerRef.current);
    framePulseTimerRef.current = window.setTimeout(() => setFramePulse(false), 420);
  }

  function applyScan(rawValue: string) {
    const code = rawValue.trim();
    if (!code || scanBusyRef.current || confirmPrompt || isSaving) return;

    scanBusyRef.current = true;
    try {
      const decision = resolveCycleCountScan(code, {
        product: { barcode: produtoBarcode, codigoInterno: produtoCodigoInterno, sku: produtoSku },
        currentCount: count,
        quantidadeSistema,
      });

      if (decision.kind === "not-found") {
        flash({ type: "err", title: "Não encontrado", code, sub: "Este código não pertence a este produto." });
        return;
      }

      if (decision.kind === "surplus-prompt") {
        pendingSurplusNextCountRef.current = count + 1;
        setConfirmPrompt({
          title: "Confirmar unidade extra",
          code: produtoSku,
          sub: `Esse produto já tem as ${quantidadeSistema} unidades esperadas. Confirma mais 1 unidade (${count + 1} no total)?`,
          confirmLabel: "Confirmar unidade extra",
          dismissLabel: "Foi engano, não contar",
        });
        return;
      }

      // decision.kind === "increment"
      setCount(decision.nextCount);
      if (decision.complete) {
        flash({ type: "ok", title: "Contagem completa", code: produtoSku, sub: `${decision.nextCount}/${quantidadeSistema} contado(s).` });
      } else {
        pulseFrame();
      }
    } finally {
      scanBusyRef.current = false;
    }
  }

  function confirmSurplus() {
    const nextCount = pendingSurplusNextCountRef.current;
    pendingSurplusNextCountRef.current = null;
    setConfirmPrompt(null);
    if (nextCount === null) return;
    setCount(nextCount);
    flash({ type: "ok", title: "Unidade extra registrada", code: produtoSku, sub: `${nextCount}/${quantidadeSistema} contado(s).` });
  }

  function dismissSurplusPrompt() {
    pendingSurplusNextCountRef.current = null;
    setConfirmPrompt(null);
  }

  const applyScanRef = useRef<(code: string) => void>(() => {});
  useEffect(() => {
    applyScanRef.current = applyScan;
  });
  const handleDetected = useCallback((code: string) => applyScanRef.current(code), []);

  const {
    videoRef,
    cameraStarting,
    cameraMessage,
    startCamera,
    stopCamera,
    captureFallbackActive,
    captureBusy,
    captureFromPhoto,
  } = useCameraBarcodeScanner({
    onDetected: handleDetected,
    requirePresenceGap: true,
    confirmReads: 2,
  });

  useEffect(() => {
    void startCamera();
    return () => stopCamera(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        stopCamera(null);
        setConfirmed(true);
      }, 1300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar a contagem.");
    } finally {
      setIsSaving(false);
    }
  }

  if (confirmed) {
    return (
      <div className="relative flex flex-col" style={{ flex: 1, minHeight: 0 }}>
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
            style={{ background: hexAlpha(mobileColors.green, 0.16), color: mobileColors.green }}
          >
            Contado
          </span>
        </div>

        <div className="app-scroll flex flex-1 flex-col items-center justify-center gap-4 px-[18px] pb-[18px] text-center">
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
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }}>
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
          background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.65) 100%)",
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
            Bipe o produto — {enderecoCodigo}
          </span>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, lineHeight: 1.15, ...headingFont }}>
            {produtoNome}
          </span>
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, ...headingFont }}>
            {produtoSku}
          </span>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/m/estoque/inventarios/${depositanteId}`)}
          style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
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
            border: `2.5px ${framePulse ? "solid" : "dashed"} ${framePulse ? mobileColors.green : hexAlpha("#ffffff", 0.7)}`,
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
          padding: "0 24px 16px",
          textAlign: "center",
        }}
      >
        {produtoImagemUrl ? (
          <Image
            src={produtoImagemUrl}
            alt={produtoNome}
            width={44}
            height={44}
            unoptimized
            style={{ borderRadius: 12, objectFit: "contain", background: "#fff", marginBottom: 2 }}
          />
        ) : null}
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, ...headingFont }}>
          {count} de {quantidadeSistema} unidades
        </span>
        {quantidadeSistema > 0 && quantidadeSistema <= 12 ? (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 7, maxWidth: 260 }}>
            {Array.from({ length: quantidadeSistema }).map((_, index) => {
              const collected = index < count;
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
        ) : quantidadeSistema > 0 ? (
          <div style={{ width: 220, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: mobileColors.green,
                width: `${Math.min(100, Math.round((count / quantidadeSistema) * 100))}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        ) : null}
        {count < quantidadeSistema ? (
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12.5 }}>
            Faltam {quantidadeSistema - count} {quantidadeSistema - count === 1 ? "unidade" : "unidades"}
          </span>
        ) : null}
        {!cameraStarting && !captureFallbackActive ? (
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11.5 }}>{cameraMessage ?? "Posicione o código dentro da moldura"}</span>
        ) : null}
        {captureFallbackActive ? (
          <button
            type="button"
            disabled={captureBusy}
            onClick={captureFromPhoto}
            style={{
              height: 48,
              padding: "0 22px",
              borderRadius: 15,
              border: "none",
              background: mobileGradient,
              color: "#fff",
              fontWeight: 800,
              fontSize: 14.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: captureBusy ? 0.7 : 1,
            }}
          >
            <MobileIcon name="scan" size={17} strokeWidth={2} />
            {captureBusy ? "Lendo foto..." : "Tirar foto do código"}
          </button>
        ) : null}
        {error ? (
          <div
            className="rounded-2xl p-3 text-[12.5px]"
            style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.3)}`, background: hexAlpha(mobileColors.red, 0.08), color: mobileColors.redLight, marginTop: 4 }}
          >
            {error}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "0 18px calc(18px + env(safe-area-inset-bottom))",
        }}
      >
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSaving}
          style={{
            height: 58,
            width: "100%",
            border: "none",
            borderRadius: 17,
            background: mobileGradient,
            color: "#fff",
            fontSize: 15.5,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: isSaving ? "wait" : "pointer",
            opacity: isSaving ? 0.75 : 1,
            boxShadow: "0 10px 26px rgba(99,102,241,0.4)",
          }}
        >
          {isSaving ? <MobileButtonSpinner /> : "Confirmar contagem"}
        </button>
      </div>

      <MobileScanOverlay overlay={overlay} />
      <MobileScanConfirmPrompt state={confirmPrompt} onConfirm={confirmSurplus} onDismiss={dismissSurplusPrompt} />
    </div>
  );
}
