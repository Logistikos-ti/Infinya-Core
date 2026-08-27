"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  abandonShippingOrderCancellationAction,
  concludeShippingOrderCancellationAction,
  registerCancellationScanAction,
} from "@/app/(dashboard)/expedicao/cancelamento/actions";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
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

type CancellationLine = {
  id: string;
  produtoId: string;
  sku: string;
  productName: string;
  imageUrl: string | null;
  estoqueId: string | null;
  enderecoEsperadoId: string | null;
  enderecoEsperadoCodigo: string | null;
  quantidadeEsperada: number;
  quantidadeConfirmada: number;
  quantidadeConfirmadaAvariada: number;
  status: "PENDENTE" | "CONCLUIDO" | "DIVERGENTE";
};

type MobileShippingCancellationPanelProps = {
  cancelamentoId: string;
  status: string;
  motivo: string | null;
  order: {
    id: string;
    orderNumber: string;
    depositante: string;
    cliente: string;
  };
  lines: CancellationLine[];
};

type ScanPhase = "endereco" | "produto";

function normalizeScan(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

export function MobileShippingCancellationPanel({
  cancelamentoId,
  status,
  motivo,
  order,
  lines: initialLines,
}: MobileShippingCancellationPanelProps) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [phase, setPhase] = useState<ScanPhase>("endereco");
  const [condicao, setCondicao] = useState<"BOM" | "AVARIADO">("BOM");
  const [manualValue, setManualValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [showDivergenceConfirm, setShowDivergenceConfirm] = useState(false);
  const overlayTimerRef = useRef<number | null>(null);

  const currentLine = useMemo(() => lines.find((line) => line.status === "PENDENTE") ?? null, [lines]);
  const allConfirmed = lines.every((line) => line.status !== "PENDENTE");
  const pendingCount = lines.filter((line) => line.status === "PENDENTE").length;

  const flash = useCallback((next: ScanOverlayState, durationMs = 1100) => {
    setOverlay(next);
    if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = window.setTimeout(() => setOverlay(null), durationMs);
  }, []);

  const processCode = useCallback(
    async (rawCode: string) => {
      if (!currentLine || isSubmitting) return;
      const code = normalizeScan(rawCode);

      if (phase === "endereco") {
        const expected = currentLine.enderecoEsperadoCodigo ? normalizeScan(currentLine.enderecoEsperadoCodigo) : null;
        if (expected && code !== expected) {
          flash({ type: "err", title: "Endereço incorreto", code: rawCode, sub: `Esperado: ${currentLine.enderecoEsperadoCodigo}` });
          return;
        }
        flash({ type: "ok", title: "Endereço confirmado", code: rawCode, sub: "Agora bipe o produto" }, 700);
        setPhase("produto");
        return;
      }

      const expectedProduct = normalizeScan(currentLine.sku);
      if (code !== expectedProduct) {
        flash({ type: "err", title: "Produto incorreto", code: rawCode, sub: `Esperado: ${currentLine.sku}` });
        return;
      }

      setIsSubmitting(true);
      const result = await registerCancellationScanAction({
        cancelamentoItemId: currentLine.id,
        enderecoId: currentLine.enderecoEsperadoId ?? "",
        estoqueId: currentLine.estoqueId,
        produtoId: currentLine.produtoId,
        quantity: 1,
        condicao,
        scanId: crypto.randomUUID(),
      });
      setIsSubmitting(false);

      if (!result.ok) {
        flash({ type: "err", title: "Falha ao confirmar", code: rawCode, sub: result.message ?? "Tente novamente" });
        return;
      }

      flash({ type: "ok", title: "Devolução confirmada", code: rawCode, sub: currentLine.productName }, 900);
      setLines((current) =>
        current.map((line) => {
          if (line.id !== currentLine.id) return line;
          const nextConfirmada = line.quantidadeConfirmada + 1;
          return {
            ...line,
            quantidadeConfirmada: nextConfirmada,
            quantidadeConfirmadaAvariada: line.quantidadeConfirmadaAvariada + (condicao === "AVARIADO" ? 1 : 0),
            status: nextConfirmada >= line.quantidadeEsperada ? "CONCLUIDO" : "PENDENTE",
          };
        }),
      );
      setPhase("endereco");
      setCondicao("BOM");
    },
    [currentLine, phase, condicao, isSubmitting, flash],
  );

  const {
    videoRef,
    cameraSupported,
    cameraEnabled,
    cameraStarting,
    cameraMessage,
    startCamera,
    captureFallbackActive,
    captureBusy,
    captureFromPhoto,
  } = useCameraBarcodeScanner({
    onDetected: (code) => void processCode(code),
    requirePresenceGap: true,
    confirmReads: 2,
  });

  function handleManualSubmit() {
    if (!manualValue.trim()) return;
    void processCode(manualValue.trim());
    setManualValue("");
  }

  if (status === "CONCLUIDO") {
    return (
      <MobileStatusScreen
        title="Cancelamento concluído"
        description={`Pedido ${order.orderNumber} — devolução ao estoque confirmada.`}
        icon="check"
        onBack={() => router.push("/m/separacao")}
      />
    );
  }

  if (status === "ABANDONADO") {
    return (
      <MobileStatusScreen
        title="Processo abandonado"
        description={`O cancelamento do pedido ${order.orderNumber} foi abandonado.`}
        icon="x"
        onBack={() => router.push("/m/separacao")}
      />
    );
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: mobileColors.pageBg,
        color: mobileColors.text,
        ...headingFont,
      }}
    >
      <MobileScanOverlay overlay={overlay} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 18px 12px" }}>
        <MobileBackButton onClick={() => router.push("/m/separacao")} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, color: mobileColors.amber, fontWeight: 700, textTransform: "uppercase" }}>
            Cancelamento pendente
          </p>
          <p style={{ fontSize: 17, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {order.orderNumber}
          </p>
          <p style={{ fontSize: 12.5, color: mobileColors.muted }}>
            {order.depositante} · {order.cliente}
          </p>
        </div>
      </div>

      {motivo ? (
        <p style={{ margin: "0 18px 12px", fontSize: 12, color: mobileColors.dim }}>Motivo: {motivo}</p>
      ) : null}

      <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {lines.map((line) => {
          const isCurrent = line.id === currentLine?.id;
          return (
            <div
              key={line.id}
              style={{
                borderRadius: 16,
                border: `1px solid ${isCurrent ? mobileColors.blue : hexAlpha("#94A3B8", 0.14)}`,
                background: isCurrent ? hexAlpha(mobileColors.blue, 0.08) : hexAlpha("#94A3B8", 0.045),
                padding: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {line.productName}
                </p>
                <p style={{ fontSize: 11.5, color: mobileColors.muted }}>
                  SKU {line.sku} · {line.enderecoEsperadoCodigo ?? "endereço a definir"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                {line.status === "CONCLUIDO" ? (
                  <span style={{ color: mobileColors.green, display: "flex" }}>
                    <MobileIcon name="check" size={16} />
                  </span>
                ) : null}
                <span>{line.quantidadeConfirmada}/{line.quantidadeEsperada}</span>
              </div>
            </div>
          );
        })}
      </div>

      {currentLine ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 18, gap: 14 }}>
          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: 220,
              borderRadius: 20,
              overflow: "hidden",
              background: "#000",
              border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
            }}
          >
            {cameraSupported && cameraEnabled ? (
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: mobileColors.muted }}>
                  {cameraMessage ?? "Use o campo abaixo para digitar o código."}
                </p>
              </div>
            )}

            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                top: 16,
                borderRadius: 12,
                background: hexAlpha("#000000", 0.55),
                padding: "8px 12px",
              }}
            >
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>
                {phase === "endereco" ? "Bipe o endereço de devolução" : "Bipe o produto para confirmar"}
              </p>
            </div>
          </div>

          {!cameraEnabled ? (
            <MobilePrimaryButton onClick={() => void startCamera()} disabled={cameraStarting}>
              {cameraStarting ? <MobileButtonSpinner /> : "Ativar câmera"}
            </MobilePrimaryButton>
          ) : null}

          {captureFallbackActive ? (
            <button
              type="button"
              onClick={() => captureFromPhoto()}
              disabled={captureBusy}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 48,
                borderRadius: 12,
                border: `1px dashed ${hexAlpha("#94A3B8", 0.3)}`,
                fontSize: 13,
                color: mobileColors.muted,
                background: "transparent",
              }}
            >
              {captureBusy ? <MobileButtonSpinner /> : "Tirar foto do código"}
            </button>
          ) : null}

          {phase === "produto" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setCondicao("BOM")}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: `1px solid ${condicao === "BOM" ? mobileColors.green : hexAlpha("#94A3B8", 0.2)}`,
                  background: condicao === "BOM" ? hexAlpha(mobileColors.green, 0.12) : "transparent",
                  color: condicao === "BOM" ? mobileColors.green : mobileColors.muted,
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                Bom estado
              </button>
              <button
                type="button"
                onClick={() => setCondicao("AVARIADO")}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  border: `1px solid ${condicao === "AVARIADO" ? mobileColors.red : hexAlpha("#94A3B8", 0.2)}`,
                  background: condicao === "AVARIADO" ? hexAlpha(mobileColors.red, 0.12) : "transparent",
                  color: condicao === "AVARIADO" ? mobileColors.redLight : mobileColors.muted,
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                Avariado
              </button>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleManualSubmit();
                }
              }}
              placeholder={phase === "endereco" ? "Digitar código do endereço" : "Digitar SKU do produto"}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 12,
                border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`,
                background: hexAlpha("#94A3B8", 0.06),
                color: mobileColors.text,
                padding: "0 14px",
                fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              style={{
                height: 46,
                padding: "0 18px",
                borderRadius: 12,
                border: "none",
                background: mobileGradient,
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {isSubmitting ? <MobileButtonSpinner /> : "OK"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: 18 }}>
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${hexAlpha(mobileColors.green, 0.3)}`,
              background: hexAlpha(mobileColors.green, 0.08),
              padding: 16,
              fontSize: 13,
              color: mobileColors.green,
            }}
          >
            Todos os itens foram confirmados. Conclua o cancelamento abaixo.
          </div>
        </div>
      )}

      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        {!allConfirmed && !showDivergenceConfirm ? (
          <button
            type="button"
            onClick={() => setShowDivergenceConfirm(true)}
            style={{
              height: 46,
              borderRadius: 12,
              border: `1px solid ${hexAlpha(mobileColors.amber, 0.4)}`,
              background: hexAlpha(mobileColors.amber, 0.08),
              color: mobileColors.amber,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            Forçar conclusão com {pendingCount} item(ns) faltando
          </button>
        ) : null}

        {showDivergenceConfirm ? (
          <form action={concludeShippingOrderCancellationAction} style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="cancelamentoId" value={cancelamentoId} />
            <input type="hidden" name="forcarDivergencia" value="true" />
            <input type="hidden" name="motivoDivergencia" value="Itens não localizados na devolução." />
            <MobilePrimaryButton type="submit" style={{ flex: 1, background: "linear-gradient(92deg,#B45309,#F59E0B)" }}>
              Confirmar divergência
            </MobilePrimaryButton>
            <button
              type="button"
              onClick={() => setShowDivergenceConfirm(false)}
              style={{ padding: "0 16px", borderRadius: 12, border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, color: mobileColors.muted }}
            >
              Voltar
            </button>
          </form>
        ) : (
          <form action={concludeShippingOrderCancellationAction}>
            <input type="hidden" name="cancelamentoId" value={cancelamentoId} />
            <MobilePrimaryButton type="submit" disabled={!allConfirmed}>
              Concluir cancelamento
            </MobilePrimaryButton>
          </form>
        )}

        <form action={abandonShippingOrderCancellationAction}>
          <input type="hidden" name="cancelamentoId" value={cancelamentoId} />
          <button
            type="submit"
            style={{
              width: "100%",
              height: 40,
              borderRadius: 12,
              border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`,
              background: "transparent",
              color: mobileColors.muted,
              fontSize: 12.5,
            }}
          >
            Abandonar processo
          </button>
        </form>
      </div>
    </div>
  );
}

function MobileStatusScreen({
  title,
  description,
  icon,
  onBack,
}: {
  title: string;
  description: string;
  icon: "check" | "x";
  onBack: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 32,
        textAlign: "center",
        background: mobileColors.pageBg,
        color: mobileColors.text,
      }}
    >
      <span style={{ color: icon === "check" ? mobileColors.green : mobileColors.muted, display: "flex" }}>
        <MobileIcon name={icon} size={48} />
      </span>
      <p style={{ fontSize: 18, fontWeight: 800, ...headingFont }}>{title}</p>
      <p style={{ fontSize: 13.5, color: mobileColors.muted }}>{description}</p>
      <MobilePrimaryButton onClick={onBack}>Voltar</MobilePrimaryButton>
    </div>
  );
}
