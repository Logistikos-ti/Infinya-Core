"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  mobileColors,
  MobileFlowShell,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";

const FLASH_DURATION_MS = 1300;

type Props = {
  depositanteId: string;
  depositanteNome: string;
  estoqueId: string;
  produtoNome: string;
  produtoSku: string;
  enderecoCodigo: string;
  enderecoArea: string;
  quantidadeSistema: number;
};

export function MobileCycleCountPanel({
  depositanteId,
  depositanteNome,
  estoqueId,
  produtoNome,
  produtoSku,
  enderecoCodigo,
  enderecoArea,
  quantidadeSistema,
}: Props) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [match, setMatch] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const overlayTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  function playFeedback(feedbackType: "ok" | "warn") {
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
      beep(440, "square", now, 0.09);
      beep(440, "square", now + 0.13, 0.09);
    }
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
      playFeedback(isMatch ? "ok" : "warn");
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

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", minHeight: 0 }}>
      <MobileFlowShell
      title="Inventário"
      subtitle={depositanteNome}
      tag={confirmed ? "Contado" : enderecoCodigo}
      tagColor={mobileColors.amber}
      progressPct={confirmed ? "100%" : "60%"}
      progressLabel={confirmed ? "Produto contado" : "Conte e confirme a quantidade"}
      onBack={() => router.push(`/m/estoque/inventarios/${depositanteId}`)}
      done={confirmed}
      doneTitle={match ? "Contagem confere!" : "Divergência registrada"}
      doneSub={
        match
          ? "A quantidade contada bate com o sistema. Item validado."
          : "A contagem diverge do sistema. A divergência foi registrada para auditoria do supervisor."
      }
      card={{
        border: "rgba(245,158,11,0.3)",
        stepNum: "1",
        stepColor: mobileColors.amber,
        action: "Conte o produto no endereço",
        showProduct: true,
        name: produtoNome,
        sku: produtoSku,
        thumbColor: mobileColors.amber,
        targetBorder: "rgba(245,158,11,0.4)",
        targetIcon: "loc",
        targetIconColor: mobileColors.amber,
        targetLabel: "Endereço a contar",
        targetValue: enderecoCodigo,
        showQty: false,
      }}
      inventoryCounter={{
        count,
        system: quantidadeSistema,
        onInc: () => setCount((current) => current + 1),
        onDec: () => setCount((current) => Math.max(0, current - 1)),
      }}
      primaryLabel={isSaving ? "Confirmando..." : "Confirmar contagem"}
      onPrimary={handleConfirm}
      overlay={overlay}
      />
      {error ? (
        <div
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            bottom: 90,
            zIndex: 90,
            borderRadius: 14,
            border: "1px solid rgba(239,68,68,0.3)",
            background: "#1a0e0e",
            color: mobileColors.redLight,
            padding: 12,
            fontSize: 12.5,
            boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
