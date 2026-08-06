"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import {
  hexAlpha,
  headingFont,
  MobileScanOverlay,
  MobileIcon,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

const FLASH_DURATION_MS = 1300;

type ScanPhase = "produto" | "endereco";

type ProdutoInfo = {
  produtoId: string;
  nome: string;
  sku: string;
};

/**
 * Replaces the old "pick a product from the list" step: the camera opens
 * as soon as the operator lands here (right after choosing the
 * depositante) and asks for the two scans a cycle count needs -- produto,
 * then endereço -- to resolve (or open, if nothing was counted there
 * before) the right saldo before handing off to MobileCycleCountPanel.
 */
export function InventarioScanClient({
  depositanteId,
  depositanteNome,
}: {
  depositanteId: string;
  depositanteNome: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<ScanPhase>("produto");
  const [produto, setProduto] = useState<ProdutoInfo | null>(null);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [resolving, setResolving] = useState(false);
  const overlayTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const resolvingRef = useRef(false);

  const applyScanRef = useRef<(code: string) => void>(() => {});
  const handleDetected = useCallback((code: string) => applyScanRef.current(code), []);

  const { videoRef, cameraStarting, cameraMessage, startCamera, stopCamera } = useCameraBarcodeScanner({
    onDetected: handleDetected,
    requirePresenceGap: true,
    confirmReads: 2,
  });

  useEffect(() => {
    void startCamera();
    return () => stopCamera(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
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

  async function applyScan(rawValue: string) {
    const code = rawValue.trim();
    if (!code || resolvingRef.current) return;

    resolvingRef.current = true;
    setResolving(true);

    try {
      if (phase === "produto") {
        const response = await fetch("/api/estoque/inventario-resolver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "produto", depositanteId, barcode: code }),
        });
        const body = await response.json();

        if (!response.ok) {
          flash({ type: "err", title: "Não encontrado", code, sub: body.error ?? "Produto não localizado." });
          return;
        }

        flash({ type: "ok", title: "Produto OK", code: body.sku, sub: "Bipe agora o endereço" });
        setProduto({ produtoId: body.produtoId, nome: body.nome, sku: body.sku });
        setPhase("endereco");
        return;
      }

      // phase === "endereco"
      const response = await fetch("/api/estoque/inventario-resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "endereco", depositanteId, barcode: code, produtoId: produto?.produtoId }),
      });
      const body = await response.json();

      if (!response.ok) {
        flash({ type: "err", title: "Não encontrado", code, sub: body.error ?? "Endereço não localizado." });
        return;
      }

      flash({ type: "ok", title: "Endereço OK", code: body.enderecoCodigo, sub: "Abrindo contagem..." });
      stopCamera(null);
      window.setTimeout(() => {
        router.push(`/m/estoque/inventarios/${depositanteId}/${body.estoqueId}`);
      }, FLASH_DURATION_MS);
    } catch {
      flash({ type: "err", title: "Falha na leitura", code, sub: "Tente bipar novamente." });
    } finally {
      resolvingRef.current = false;
      setResolving(false);
    }
  }

  useEffect(() => {
    applyScanRef.current = (code: string) => void applyScan(code);
  });

  const scanTitle = phase === "produto" ? "Bipe o produto" : "Bipe o endereço";

  return (
    <div className="relative flex flex-col" style={{ flex: 1, minHeight: 0 }}>
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
              {scanTitle}
            </span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, lineHeight: 1.15, ...headingFont }}>
              {phase === "produto" ? "Inventário" : produto?.nome}
            </span>
            <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12.5, ...headingFont }}>
              {phase === "produto" ? depositanteNome : produto?.sku}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/m/estoque/inventarios`)}
            style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <MobileIcon name="x" size={18} strokeWidth={2.6} />
          </button>
        </div>

        <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 250, height: 160, borderRadius: 22, border: `2.5px dashed ${hexAlpha("#ffffff", 0.7)}` }} />
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
            {cameraStarting
              ? "Abrindo câmera..."
              : resolving
                ? phase === "produto"
                  ? "Localizando produto..."
                  : "Localizando endereço..."
                : (cameraMessage ?? "Posicione o código dentro da moldura")}
          </span>
        </div>

        <MobileScanOverlay overlay={overlay} />
      </div>
    </div>
  );
}
