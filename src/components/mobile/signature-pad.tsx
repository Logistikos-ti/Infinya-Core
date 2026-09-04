"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import { mobileGradient, headingFont } from "@/components/mobile/mobile-kit-tokens";

type SignaturePadOverlayProps = {
  title: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};

export function SignaturePadOverlay({ title, onCancel, onConfirm }: SignaturePadOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasStroke, setHasStroke] = useState(false);

  // Canvas nasce transparente e em pixels de dispositivo (não CSS) --
  // ajusta pro devicePixelRatio (traço nítido em telas retina) e já
  // preenche de branco, porque toDataURL("image/png") produziria fundo
  // transparente por padrão, o que quebraria a exibição em qualquer lugar
  // de fundo escuro (o próprio card "capturado" no mobile, por exemplo).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#0F172A";
    ctx.lineWidth = 2.75;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPoint(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!hasStroke) setHasStroke(true);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPointRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasStroke(false);
  }

  function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    onConfirm(canvas.toDataURL("image/png"));
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#000", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: 18,
          paddingTop: "calc(18px + env(safe-area-inset-top))",
        }}
      >
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, ...headingFont }}>{title}</span>
        <button
          type="button"
          onClick={onCancel}
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
            border: "none",
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", gap: 14 }}>
        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, textAlign: "center" }}>
          Peça para o motorista assinar com o dedo abaixo.
        </span>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            width: "100%",
            maxWidth: 420,
            height: 240,
            borderRadius: 20,
            background: "#fff",
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            touchAction: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 12, padding: "0 20px calc(24px + env(safe-area-inset-bottom))" }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            flex: 1,
            height: 50,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!hasStroke}
          style={{
            flex: 1.4,
            height: 50,
            borderRadius: 16,
            border: "none",
            background: hasStroke ? mobileGradient : "rgba(255,255,255,0.12)",
            color: hasStroke ? "#fff" : "rgba(255,255,255,0.4)",
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          Confirmar assinatura
        </button>
      </div>
    </div>
  );
}
