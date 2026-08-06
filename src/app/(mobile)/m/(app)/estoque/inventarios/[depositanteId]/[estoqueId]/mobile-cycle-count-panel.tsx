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
  enderecoArea: string;
  quantidadeSistema: number;
};

/**
 * The produto + endereço are already confirmed by the time the operator
 * lands here -- they bipped both on the previous screen
 * (inventario-scan-client.tsx), which is what resolved (or opened, for a
 * blind count) this exact estoqueId. This panel used to also ask for its
 * own address + product confirmation scan before the counted quantity;
 * that's gone now so bipping produto + endereço is two actions total for
 * the whole Inventário flow, not two per screen.
 */
export function MobileCycleCountPanel({
  depositanteId,
  depositanteNome,
  estoqueId,
  produtoNome,
  produtoSku,
  produtoImagemUrl,
  enderecoCodigo,
  enderecoArea,
  quantidadeSistema,
}: Props) {
  const router = useRouter();
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [count, setCount] = useState(0);
  const [editingCount, setEditingCount] = useState(false);
  const [countInputValue, setCountInputValue] = useState("0");
  const [confirmed, setConfirmed] = useState(false);
  const [match, setMatch] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      }, 1300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar a contagem.");
    } finally {
      setIsSaving(false);
    }
  }

  const phaseColor = mobileColors.amber;

  return (
    <div className="relative flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      <MobileScanOverlay overlay={overlay} />

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
        style={{ paddingBottom: confirmed ? 18 : 158 }}
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
            disabled={isSaving || editingCount}
            className="flex h-[62px] items-center justify-center gap-2 rounded-[17px] text-[16.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
          >
            {isSaving ? <MobileButtonSpinner /> : "Confirmar contagem"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
