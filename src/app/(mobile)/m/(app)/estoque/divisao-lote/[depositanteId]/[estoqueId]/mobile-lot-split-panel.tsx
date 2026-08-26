"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  mobileColors,
  mobileGradient,
  hexAlpha,
  headingFont,
  MobileBackButton,
  MobileScanOverlay,
  MobileIcon,
  MobileButtonSpinner,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

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
  loteOrigem: string | null;
  validadeOrigem: string | null;
  disponivel: number;
};

function formatValidade(value: string | null) {
  if (!value) return "sem validade";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function MobileLotSplitPanel({
  depositanteId,
  depositanteNome,
  estoqueId,
  produtoNome,
  produtoSku,
  produtoBarcode,
  produtoCodigoInterno,
  produtoImagemUrl,
  enderecoCodigo,
  loteOrigem,
  validadeOrigem,
  disponivel,
}: Props) {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [editingCount, setEditingCount] = useState(false);
  const [countInputValue, setCountInputValue] = useState("1");
  const [newLot, setNewLot] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedResult, setConfirmedResult] = useState<{
    novoLote: string;
    quantidadeNovoLote: number;
    quantidadeOrigemRestante: number;
  } | null>(null);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const overlayTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const countInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
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

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = feedbackType === "ok" ? "sine" : "square";
    oscillator.frequency.value = feedbackType === "ok" ? 880 : 220;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.12);
  }

  function commitCountInput() {
    const parsed = Number(countInputValue.replace(",", "."));
    const clamped = Number.isFinite(parsed) ? Math.min(disponivel, Math.max(1, Math.round(parsed))) : 1;
    setCount(clamped);
    setEditingCount(false);
  }

  const cleanNewLot = newLot.trim();
  const sameAsOrigin =
    cleanNewLot !== "" &&
    cleanNewLot === (loteOrigem ?? "") &&
    (newExpiry || null) === (validadeOrigem ? validadeOrigem.slice(0, 10) : null);

  async function handleConfirm() {
    if (isSaving || count <= 0) return;
    if (!cleanNewLot) {
      setError("Informe o código do novo lote.");
      return;
    }
    if (!newExpiry) {
      setError("Informe a validade do novo lote.");
      return;
    }
    if (sameAsOrigin) {
      setError("Informe um lote ou validade diferente do lote de origem.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/estoque/dividir-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId: estoqueId,
          quantity: count,
          newLot: cleanNewLot,
          newExpiry: newExpiry || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível dividir o lote.");

      playFeedback("ok");
      setOverlay({
        type: "ok",
        title: "Lote dividido!",
        code: `${count} un`,
        sub: `${produtoNome} — lote ${cleanNewLot}`,
      });
      overlayTimerRef.current = window.setTimeout(() => {
        setOverlay(null);
        setConfirmedResult({
          novoLote: cleanNewLot,
          quantidadeNovoLote: Number(body.result?.quantidadeNovoLote ?? count),
          quantidadeOrigemRestante: Number(body.result?.quantidadeOrigemRestante ?? disponivel - count),
        });
        setConfirmed(true);
      }, 1300);
    } catch (err) {
      playFeedback("err");
      setError(err instanceof Error ? err.message : "Falha ao dividir o lote.");
    } finally {
      setIsSaving(false);
    }
  }

  const phaseColor = mobileColors.cyan;
  const primaryCode = produtoBarcode || produtoCodigoInterno || produtoSku;

  return (
    <div className="relative flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      <MobileScanOverlay overlay={overlay} />

      <div className="flex shrink-0 items-center gap-3 px-[18px] pb-3 pt-[18px]">
        <MobileBackButton onClick={() => router.push(`/m/estoque/divisao-lote/${depositanteId}`)} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[16px] font-extrabold" style={headingFont}>
            Dividir lote
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
          {confirmed ? "Dividido" : enderecoCodigo}
        </span>
      </div>

      <div
        className="app-scroll flex flex-1 flex-col gap-4 overflow-y-auto px-[18px]"
        style={{ paddingBottom: confirmed ? 18 : 158 }}
      >
        {confirmed && confirmedResult ? (
          <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full"
                style={{ border: `2px solid ${mobileColors.green}`, animation: "mobileRingPulse 1.6s ease-out infinite" }}
              />
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{ background: hexAlpha(mobileColors.green, 0.16), color: mobileColors.green }}
              >
                <MobileIcon name="check" size={40} strokeWidth={2.6} />
              </span>
            </div>
            <span className="text-[21px] font-bold" style={headingFont}>
              Lote dividido
            </span>
            <span className="max-w-[270px] text-[13.5px] leading-relaxed" style={{ color: mobileColors.muted }}>
              {confirmedResult.quantidadeNovoLote} un de {produtoNome} agora estão no lote {confirmedResult.novoLote}.
              O lote de origem ficou com {confirmedResult.quantidadeOrigemRestante} un.
            </span>
            <div className="mt-2 flex w-full flex-col gap-2.5">
              <button
                type="button"
                onClick={() => router.push(`/m/estoque/divisao-lote/${depositanteId}`)}
                className="h-[52px] rounded-[15px] text-[14.5px] font-extrabold"
                style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.18)}`, color: mobileColors.text }}
              >
                Dividir outro lote
              </button>
              <button
                type="button"
                onClick={() => router.push("/m/estoque")}
                className="h-[52px] rounded-[15px] text-[14.5px] font-extrabold"
                style={{ background: hexAlpha(mobileColors.green, 0.14), color: mobileColors.green }}
              >
                Voltar ao estoque
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col gap-3.5 rounded-[20px] p-[18px]"
            style={{ border: `1px solid ${hexAlpha(phaseColor, 0.3)}`, background: hexAlpha("#94A3B8", 0.04) }}
          >
            <div className="flex items-center gap-[13px]">
              <div
                className="flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
                style={{
                  background: produtoImagemUrl ? "#fff" : `linear-gradient(140deg, ${phaseColor} 0%, ${hexAlpha(phaseColor, 0.55)} 100%)`,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {produtoImagemUrl ? (
                  <Image src={produtoImagemUrl} alt={produtoNome} width={54} height={54} unoptimized className="h-full w-full object-contain" />
                ) : (
                  <MobileIcon name="box" size={24} />
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[16px] font-extrabold leading-tight">{produtoNome}</span>
                <span className="text-[12.5px]" style={{ color: mobileColors.muted, ...headingFont }}>
                  {produtoSku} {primaryCode ? `• ${primaryCode}` : ""}
                </span>
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-[14px] px-4 py-3"
              style={{ background: "rgba(5,7,13,0.5)", border: `1px dashed ${hexAlpha(phaseColor, 0.35)}` }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: mobileColors.dim }}>
                  Lote de origem
                </span>
                <span className="text-[14.5px] font-bold" style={headingFont}>
                  {loteOrigem || "sem lote"}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: mobileColors.dim }}>
                  Validade
                </span>
                <span className="text-[14.5px] font-bold" style={headingFont}>
                  {formatValidade(validadeOrigem)}
                </span>
              </div>
            </div>

            <div
              className="flex flex-col gap-3 rounded-[15px] p-4"
              style={{ background: "rgba(5,7,13,0.5)", border: `1px dashed ${hexAlpha(phaseColor, 0.4)}` }}
            >
              <span className="text-center text-[12.5px] font-bold" style={{ color: mobileColors.muted }}>
                Quantidade para o novo lote
              </span>
              <div className="flex items-center justify-center gap-[18px]">
                <button
                  type="button"
                  onClick={() => setCount((current) => Math.max(1, current - 1))}
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
                    min={1}
                    max={disponivel}
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
                  onClick={() => setCount((current) => Math.min(disponivel, current + 1))}
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] text-[26px] font-bold"
                  style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: hexAlpha("#94A3B8", 0.08), color: mobileColors.text }}
                >
                  +
                </button>
              </div>
              <span className="text-center text-[11.5px]" style={{ color: mobileColors.dim }}>
                Disponível: {disponivel} un • toque no número para digitar
              </span>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                Código do novo lote
              </span>
              <input
                type="text"
                value={newLot}
                onChange={(event) => setNewLot(event.target.value)}
                placeholder="Ex.: Lote 2"
                className="h-[52px] rounded-[15px] px-4 text-[15px] outline-none"
                style={{
                  background: "rgba(5,7,13,0.5)",
                  border: `1px solid ${hexAlpha(cleanNewLot ? mobileColors.green : phaseColor, 0.32)}`,
                  color: mobileColors.text,
                }}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: mobileColors.muted }}>
                Validade do novo lote
              </span>
              <input
                type="date"
                value={newExpiry}
                onChange={(event) => setNewExpiry(event.target.value)}
                className="h-[52px] rounded-[15px] px-4 text-[15px] outline-none"
                style={{
                  background: "rgba(5,7,13,0.5)",
                  border: `1px solid ${hexAlpha(newExpiry ? mobileColors.green : phaseColor, 0.32)}`,
                  color: mobileColors.text,
                  colorScheme: "dark",
                }}
              />
            </label>
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

      {!confirmed ? (
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
            disabled={isSaving || editingCount || count <= 0 || !cleanNewLot || !newExpiry}
            className="flex h-[62px] items-center justify-center gap-2 rounded-[17px] text-[16.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
          >
            {isSaving ? <MobileButtonSpinner /> : "Dividir lote"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
