"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Barcode,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  ChevronDown,
  FileDown,
  IdCard,
  List,
  Loader2,
  PackageCheck,
  RotateCcw,
  Sparkles,
  Truck,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  completeRomaneioWithDoubleCheckAction,
  uploadRomaneioPhotoAction,
} from "@/app/(dashboard)/romaneio/actions";
import { mobileColors, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { getCarrierBrand } from "@/lib/carrier-branding";
import type { RomaneioRecordDetail, SavedDriver } from "@/lib/romaneio-records";

type FecharRomaneioClientProps = {
  romaneio: RomaneioRecordDetail;
  savedDrivers: SavedDriver[];
  currentUserName: string;
};

type Step = "double_check" | "motorista" | "fotos" | "concluido";

export function FecharRomaneioClient({
  romaneio,
  savedDrivers,
  currentUserName,
}: FecharRomaneioClientProps) {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<Step>("double_check");

  // Double check state
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [scanInput, setScanInput] = useState("");
  const [scanFeedback, setScanFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [framePulse, setFramePulse] = useState<"success" | "error" | null>(null);
  const [showOrderListModal, setShowOrderListModal] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Driver state
  const [selectedDriverKey, setSelectedDriverKey] = useState<string>("");
  const [driverName, setDriverName] = useState(romaneio.driverName || "");
  const [driverDoc, setDriverDoc] = useState(romaneio.driverDocument || "");
  const [vehiclePlate, setVehiclePlate] = useState(romaneio.vehiclePlate || "");
  const [vehicleModel, setVehicleModel] = useState(romaneio.vehicleModel || "");

  // Photo state
  const [operadorPhoto, setOperadorPhoto] = useState<string | null>(null);
  const [motoristaPhoto, setMotoristaPhoto] = useState<string | null>(null);
  const [activePhotoTarget, setActivePhotoTarget] = useState<"operador" | "motorista" | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalOrders = romaneio.orders.length;
  const scannedCount = scannedIds.size;
  const isDoubleCheckComplete = totalOrders > 0 && scannedCount >= totalOrders;
  const carrierBrand = getCarrierBrand(romaneio.carrierName);

  // Sound effects
  function playBeep(success: boolean) {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(850, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1250, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(240, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioContext not supported
    }
  }

  // Handle barcode/DANFE scan in double check
  const handleDoubleCheckScan = useCallback((rawCode?: string) => {
    const code = (rawCode || scanInput).trim();
    if (!code) return;

    setScanInput("");

    // Normalize for matching
    const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Find match in romaneio orders
    const matched = romaneio.orders.find((order) => {
      const targets = [
        order.id,
        order.code,
        order.externalNumber,
        (order as any).invoiceNumber,
        (order as any).danfe_simplificada,
        (order as any).numero_nota,
        (order as any).chave_nfe,
        (order as any).chave_acesso,
        (order as any).tracking_code,
        (order as any).payload_origem?.danfe_simplificada,
        (order as any).payload_origem?.chave_nfe,
        (order as any).payload_origem?.chave_acesso,
        (order as any).payload_origem?.numero_nota,
        (order as any).payload_origem?.nota_fiscal?.numero,
        (order as any).payload_origem?.nota_fiscal?.chave,
        (order as any).payload_origem?.codigo_rastreamento,
      ]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, ""));

      return targets.some((t) => t === clean || t.includes(clean) || clean.includes(t));
    });

    if (matched) {
      if (scannedIds.has(matched.id)) {
        playBeep(true);
        setFramePulse("success");
        setScanFeedback({
          type: "success",
          message: `Volume ${matched.externalNumber || matched.code} já conferido anteriormente.`,
        });
      } else {
        playBeep(true);
        setFramePulse("success");
        const nextSet = new Set(scannedIds);
        nextSet.add(matched.id);
        setScannedIds(nextSet);

        const isLastOne = nextSet.size >= totalOrders;
        setScanFeedback({
          type: "success",
          message: isLastOne
            ? `✔ Todos os ${totalOrders} volumes conferidos!`
            : `✔ Volume ${matched.externalNumber || matched.code} conferido com sucesso!`,
        });

        if (isLastOne) {
          // Auto advance to driver step after 1.2s
          if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = setTimeout(() => {
            setStep("motorista");
          }, 1200);
        }
      }
    } else {
      playBeep(false);
      setFramePulse("error");
      setScanFeedback({
        type: "error",
        message: `❌ Código não pertence a esta carga (${romaneio.carrierName})!`,
      });
    }

    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setFramePulse(null);
    }, 600);

    scanInputRef.current?.focus();
  }, [scanInput, romaneio.orders, romaneio.carrierName, scannedIds, totalOrders]);

  // Camera barcode scanner
  const {
    videoRef,
    cameraSupported,
    cameraEnabled,
    cameraStarting,
    cameraMessage,
    startCamera,
    stopCamera,
    toggleCamera,
  } = useCameraBarcodeScanner({
    onDetected: handleDoubleCheckScan,
    requirePresenceGap: true,
    confirmReads: 1,
    presenceGapMs: 500,
  });

  // Auto start camera on double_check step
  useEffect(() => {
    if (step === "double_check") {
      void startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [step, startCamera, stopCamera]);

  // Handle selecting a saved driver
  function handleSelectSavedDriver(key: string) {
    setSelectedDriverKey(key);
    if (!key) {
      setDriverName("");
      setDriverDoc("");
      setVehiclePlate("");
      setVehicleModel("");
      return;
    }

    const found = savedDrivers.find((d) => `${d.nome}|${d.documento}` === key);
    if (found) {
      setDriverName(found.nome);
      setDriverDoc(found.documento);
      setVehiclePlate(found.veiculoPlaca);
      setVehicleModel(found.veiculoModelo);
    }
  }

  // Trigger file input for photo capture
  function triggerPhotoCapture(target: "operador" | "motorista") {
    setActivePhotoTarget(target);
    photoInputRef.current?.click();
  }

  // Handle photo file selected
  function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activePhotoTarget) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (activePhotoTarget === "operador") {
        setOperadorPhoto(dataUrl);
      } else if (activePhotoTarget === "motorista") {
        setMotoristaPhoto(dataUrl);
      }
      setActivePhotoTarget(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  }

  // Final submission
  async function handleFinalSubmit() {
    if (!driverName.trim()) {
      setSubmitError("Informe o nome do motorista.");
      return;
    }
    if (!driverDoc.trim()) {
      setSubmitError("Informe o documento (CPF ou RG) do motorista.");
      return;
    }
    if (!vehiclePlate.trim()) {
      setSubmitError("Informe a placa do veículo.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let opUrl: string | null = null;
      let motUrl: string | null = null;

      if (operadorPhoto) {
        const res = await uploadRomaneioPhotoAction({
          romaneioId: romaneio.id,
          type: "operador",
          base64Data: operadorPhoto,
        });
        opUrl = res.url;
      }

      if (motoristaPhoto) {
        const res = await uploadRomaneioPhotoAction({
          romaneioId: romaneio.id,
          type: "motorista",
          base64Data: motoristaPhoto,
        });
        motUrl = res.url;
      }

      await completeRomaneioWithDoubleCheckAction({
        romaneioId: romaneio.id,
        driverData: {
          nome: driverName,
          documento: driverDoc,
          veiculoModelo: vehicleModel,
          veiculoPlaca: vehiclePlate,
        },
        photos: {
          operadorUrl: opUrl,
          motoristaUrl: motUrl,
        },
        scannedOrderIds: Array.from(scannedIds),
      });

      setStep("concluido");
    } catch (err: any) {
      setSubmitError(err?.message || "Falha ao finalizar o romaneio.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const cardStyle = {
    border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`,
    background: hexAlpha("#94A3B8", 0.045),
  };

  // =========================================================================
  // STEP 1: DOUBLE CHECK / BIPAGEM FULLSCREEN COM CÂMERA AUTOMÁTICA
  // =========================================================================
  if (step === "double_check") {
    const progressPercent = totalOrders > 0 ? Math.round((scannedCount / totalOrders) * 100) : 0;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 300,
          background: "#000",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Live Camera Video */}
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Cinematic Vignette Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 25%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.85) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Top Header HUD */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px",
            paddingTop: "calc(16px + env(safe-area-inset-top))",
            gap: 10,
          }}
        >
          <Link
            href="/m/romaneio"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              textDecoration: "none",
            }}
          >
            &#8249;
          </Link>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  backgroundColor: carrierBrand.bg,
                  color: carrierBrand.color,
                }}
              >
                {carrierBrand.init}
              </span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, ...headingFont }}>
                {romaneio.code}
              </span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
              {romaneio.carrierName}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowOrderListModal(true)}
            style={{
              height: 38,
              padding: "0 12px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <List className="h-4 w-4 text-amber-400" />
            <span>Lista</span>
          </button>
        </div>

        {/* Center Scanner Reticle */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 260,
              height: 170,
              borderRadius: 24,
              border: `3px ${framePulse ? "solid" : "dashed"} ${
                framePulse === "success"
                  ? mobileColors.green
                  : framePulse === "error"
                  ? mobileColors.red
                  : "rgba(255,255,255,0.85)"
              }`,
              boxShadow:
                framePulse === "success"
                  ? `0 0 28px ${hexAlpha(mobileColors.green, 0.75)}`
                  : framePulse === "error"
                  ? `0 0 28px ${hexAlpha(mobileColors.red, 0.75)}`
                  : "0 0 20px rgba(0,0,0,0.4)",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {cameraStarting && (
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>
                Iniciando câmera...
              </span>
            )}
            {!cameraSupported && (
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, textAlign: "center", padding: 12 }}>
                Câmera indisponível. Use o leitor ou digite o código abaixo.
              </span>
            )}
          </div>

          <span
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 13,
              fontWeight: 600,
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            Aponte para a DANFE / Etiqueta do pacote
          </span>
        </div>

        {/* Bottom HUD - Progress & Feedback */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "0 20px calc(20px + env(safe-area-inset-bottom))",
            textAlign: "center",
          }}
        >
          {/* Scan Feedback Banner */}
          {scanFeedback && (
            <div
              style={{
                width: "100%",
                maxWidth: 360,
                padding: "10px 14px",
                borderRadius: 16,
                fontSize: 12.5,
                fontWeight: 700,
                backgroundColor:
                  scanFeedback.type === "success"
                    ? "rgba(16, 185, 129, 0.25)"
                    : "rgba(239, 68, 68, 0.25)",
                border: `1px solid ${
                  scanFeedback.type === "success" ? mobileColors.green : mobileColors.red
                }`,
                color: scanFeedback.type === "success" ? "#6EE7B7" : "#FCA5A5",
                backdropFilter: "blur(12px)",
                animation: "fade-in 0.2s ease",
              }}
            >
              {scanFeedback.message}
            </div>
          )}

          {/* Progress Section: Bolinhas (<= 10) OU Barrinha (> 10) */}
          <div
            style={{
              width: "100%",
              maxWidth: 360,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 20,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 13,
                fontWeight: 800,
                ...headingFont,
              }}
            >
              <span style={{ color: "#fff" }}>Conferência de Carga</span>
              <span style={{ color: isDoubleCheckComplete ? mobileColors.green : mobileColors.amber }}>
                {scannedCount} de {totalOrders} {totalOrders === 1 ? "pedido" : "pedidos"} ({progressPercent}%)
              </span>
            </div>

            {/* IF <= 10 PEDIDOS: EXIBE BOLINHAS */}
            {totalOrders <= 10 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "4px 0",
                }}
              >
                {Array.from({ length: totalOrders }).map((_, idx) => {
                  const isChecked = idx < scannedCount;
                  return (
                    <div
                      key={idx}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        backgroundColor: isChecked ? mobileColors.green : "rgba(255,255,255,0.12)",
                        border: `2px solid ${
                          isChecked ? mobileColors.green : "rgba(255,255,255,0.35)"
                        }`,
                        boxShadow: isChecked
                          ? `0 0 10px ${hexAlpha(mobileColors.green, 0.6)}`
                          : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#000",
                        fontSize: 12,
                        fontWeight: 900,
                        transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        transform: isChecked ? "scale(1.08)" : "scale(1)",
                      }}
                    >
                      {isChecked && <Check className="h-3.5 w-3.5 stroke-[3.5]" />}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* IF > 10 PEDIDOS: EXIBE BARRINHA DE PROGRESSÃO */
              <div
                style={{
                  width: "100%",
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${mobileColors.amber} 0%, ${mobileColors.green} 100%)`,
                    width: `${Math.min(100, progressPercent)}%`,
                    transition: "width 0.3s ease",
                    boxShadow: `0 0 12px ${hexAlpha(mobileColors.green, 0.5)}`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Quick Manual Input / Gun Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDoubleCheckScan();
            }}
            style={{
              width: "100%",
              maxWidth: 360,
              display: "flex",
              gap: 8,
            }}
          >
            <div style={{ position: "relative", flex: 1 }}>
              <div
                style={{
                  position: "absolute",
                  insetY: 0,
                  left: 12,
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                <Barcode className="h-4 w-4" />
              </div>
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Digitar / bipar leitor..."
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(14px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  paddingLeft: 38,
                  paddingRight: 12,
                  fontSize: 13,
                  color: "#fff",
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!scanInput.trim()}
              style={{
                height: 44,
                padding: "0 16px",
                borderRadius: 14,
                backgroundColor: scanInput.trim() ? mobileColors.amber : "rgba(255,255,255,0.1)",
                color: scanInput.trim() ? "#000" : "rgba(255,255,255,0.4)",
                fontWeight: 800,
                fontSize: 13,
                border: "none",
                cursor: scanInput.trim() ? "pointer" : "default",
              }}
            >
              Bipar
            </button>
          </form>

          {/* Action button if complete */}
          {isDoubleCheckComplete && (
            <button
              type="button"
              onClick={() => setStep("motorista")}
              style={{
                width: "100%",
                maxWidth: 360,
                height: 48,
                borderRadius: 16,
                backgroundColor: mobileColors.green,
                color: "#000",
                fontSize: 14,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: `0 8px 24px ${hexAlpha(mobileColors.green, 0.4)}`,
                border: "none",
                cursor: "pointer",
                animation: "pulse 1.5s infinite",
              }}
            >
              <span>Avançar para Motorista</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Modal: Lista de Pedidos no Romaneio */}
        {showOrderListModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 400,
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                maxHeight: "80vh",
                background: "#0A1120",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                border: "1px solid rgba(255,255,255,0.15)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div>
                  <h3 style={{ color: "#fff", fontWeight: 800, fontSize: 16, ...headingFont }}>
                    Volumes do Romaneio ({scannedCount}/{totalOrders})
                  </h3>
                  <span style={{ color: mobileColors.muted, fontSize: 12 }}>
                    Toque para marcar manualmente se necessário
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOrderListModal(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                  }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }} className="space-y-2">
                {romaneio.orders.map((order) => {
                  const isScanned = scannedIds.has(order.id);
                  return (
                    <div
                      key={order.id}
                      onClick={() => {
                        setScannedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(order.id)) next.delete(order.id);
                          else next.add(order.id);
                          return next;
                        });
                      }}
                      style={{
                        padding: 12,
                        borderRadius: 16,
                        border: `1px solid ${
                          isScanned ? hexAlpha(mobileColors.green, 0.4) : "rgba(255,255,255,0.1)"
                        }`,
                        background: isScanned
                          ? hexAlpha(mobileColors.green, 0.1)
                          : "rgba(255,255,255,0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                            {order.externalNumber || order.code}
                          </span>
                          <span style={{ color: mobileColors.amber, fontSize: 12, fontWeight: 600 }}>
                            {order.invoiceNumber}
                          </span>
                        </div>
                        <p style={{ color: mobileColors.muted, fontSize: 12, marginTop: 2 }}>
                          {order.customer} • {order.destination}
                        </p>
                      </div>

                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          backgroundColor: isCheckedStyle(isScanned),
                          border: `1.5px solid ${
                            isScanned ? mobileColors.green : "rgba(255,255,255,0.3)"
                          }`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#000",
                        }}
                      >
                        {isScanned && <Check className="h-4 w-4 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <button
                  type="button"
                  onClick={() => setShowOrderListModal(false)}
                  style={{
                    width: "100%",
                    height: 46,
                    borderRadius: 14,
                    background: mobileColors.amber,
                    color: "#000",
                    fontWeight: 800,
                    fontSize: 14,
                    border: "none",
                  }}
                >
                  Confirmar e Voltar para a Câmera
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STEPS 2, 3 & 4 (MOTORISTA, FOTOS, CONCLUÍDO)
  // =========================================================================
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Hidden file input for photo capture */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoFileChange}
        className="hidden"
      />

      {/* Header */}
      <div style={{ flexShrink: 0, padding: "18px 18px 14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => {
            if (step === "motorista") setStep("double_check");
            else if (step === "fotos") setStep("motorista");
            else router.push("/m/romaneio");
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
            background: hexAlpha("#94A3B8", 0.06),
            color: mobileColors.text,
            cursor: "pointer",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          &#8249;
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Fechar Romaneio</span>
          <span style={{ fontSize: 12, color: mobileColors.muted }}>
            {romaneio.code} • {romaneio.carrierName}
          </span>
        </div>
        <span
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 800,
            background: hexAlpha(mobileColors.amber, 0.15),
            color: mobileColors.amber,
            flexShrink: 0,
          }}
        >
          {step === "motorista" ? "2. Motorista" : step === "fotos" ? "3. Fotos" : "Concluído"}
        </span>
      </div>

      <div className="app-scroll space-y-4 px-[18px] pb-[32px]" style={{ flex: 1, overflowY: "auto" }}>
        {/* ========================================================================= */}
        {/* STEP 2: DADOS DO MOTORISTA */}
        {/* ========================================================================= */}
        {step === "motorista" && (
          <div className="space-y-4">
            {/* Quick saved driver selector */}
            {savedDrivers.length > 0 && (
              <div className="rounded-[24px] p-4" style={cardStyle}>
                <label className="block text-xs font-semibold text-slate-300">
                  Selecionar Motorista Frequente ({savedDrivers.length} salvos)
                </label>
                <select
                  value={selectedDriverKey}
                  onChange={(e) => handleSelectSavedDriver(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="">-- Selecione ou preencha novo abaixo --</option>
                  {savedDrivers.map((d, i) => (
                    <option key={i} value={`${d.nome}|${d.documento}`}>
                      {d.nome} {d.documento ? `(Doc: ${d.documento})` : ""} {d.veiculoPlaca ? `[Placa: ${d.veiculoPlaca}]` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Manual Form */}
            <div className="rounded-[24px] p-4 space-y-3" style={cardStyle}>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <IdCard className="h-4 w-4 text-amber-400" />
                Dados do Motorista e Veículo
              </h3>

              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase">Nome Completo do Motorista *</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo da Silva"
                  className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase">Documento (CPF / RG / CNH) *</label>
                <input
                  type="text"
                  value={driverDoc}
                  onChange={(e) => setDriverDoc(e.target.value)}
                  placeholder="Ex: 123.456.789-00"
                  className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 uppercase">Placa do Veículo *</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="Ex: ABC-1D23"
                    className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 uppercase">Modelo do Veículo</label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Ex: Fiorino / HR"
                    className="mt-1 h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("double_check")}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 font-semibold text-slate-300 hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar à Câmera
              </button>
              <button
                type="button"
                onClick={() => setStep("fotos")}
                disabled={!driverName.trim() || !driverDoc.trim() || !vehiclePlate.trim()}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-40"
              >
                Avançar para Fotos
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: AUDITORIA FOTOGRÁFICA */}
        {/* ========================================================================= */}
        {step === "fotos" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
              Tire a foto do operador responsável e a foto do motorista / comprovante de carga para auditoria.
            </div>

            {/* Foto Operador */}
            <div className="rounded-[24px] p-4 space-y-3" style={cardStyle}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-400" />
                  Foto do Operador ({currentUserName})
                </span>
                {operadorPhoto && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Capturada
                  </span>
                )}
              </div>

              {operadorPhoto ? (
                <div className="relative overflow-hidden rounded-2xl border border-white/15">
                  <img src={operadorPhoto} alt="Foto Operador" className="aspect-video w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => triggerPhotoCapture("operador")}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/90"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Tirar novamente
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => triggerPhotoCapture("operador")}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 text-slate-300 hover:border-amber-400 hover:bg-white/10"
                >
                  <Camera className="h-8 w-8 text-amber-400" />
                  <span className="text-xs font-semibold">Tirar Foto do Operador</span>
                </button>
              )}
            </div>

            {/* Foto Motorista */}
            <div className="rounded-[24px] p-4 space-y-3" style={cardStyle}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-400" />
                  Foto do Motorista / Carga
                </span>
                {motoristaPhoto && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Capturada
                  </span>
                )}
              </div>

              {motoristaPhoto ? (
                <div className="relative overflow-hidden rounded-2xl border border-white/15">
                  <img src={motoristaPhoto} alt="Foto Motorista" className="aspect-video w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => triggerPhotoCapture("motorista")}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/90"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Tirar novamente
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => triggerPhotoCapture("motorista")}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 text-slate-300 hover:border-amber-400 hover:bg-white/10"
                >
                  <Camera className="h-8 w-8 text-amber-400" />
                  <span className="text-xs font-semibold">Tirar Foto do Motorista / Carga</span>
                </button>
              )}
            </div>

            {submitError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {submitError}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("motorista")}
                disabled={isSubmitting}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 font-semibold text-slate-300 hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    <PackageCheck className="h-4 w-4" />
                    Finalizar Romaneio
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: CONCLUÍDO COM SUCESSO */}
        {/* ========================================================================= */}
        {step === "concluido" && (
          <div className="space-y-5 rounded-[28px] border border-emerald-500/30 bg-emerald-950/20 p-6 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <div>
              <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
                Carga Expedida com Sucesso
              </span>
              <h2 className="mt-2 text-2xl font-bold text-white">Romaneio Finalizado!</h2>
              <p className="mt-1 text-sm font-semibold text-amber-300">{romaneio.code}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/5 bg-slate-900/80 p-4 text-left">
              <div>
                <p className="text-[11px] font-medium uppercase text-slate-400">Transportadora</p>
                <p className="mt-0.5 text-sm font-bold text-white">{romaneio.carrierName}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase text-slate-400">Volumes Expedidos</p>
                <p className="mt-0.5 text-sm font-bold text-emerald-300">{totalOrders} volumes</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase text-slate-400">Motorista</p>
                <p className="mt-0.5 text-sm font-bold text-white">{driverName}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase text-slate-400">Placa</p>
                <p className="mt-0.5 text-sm font-bold text-white">{vehiclePlate}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-3">
              <Link
                href={`/api/romaneio/${romaneio.id}/pdf`}
                target="_blank"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400"
              >
                <FileDown className="h-4 w-4" />
                Abrir / Imprimir PDF do Romaneio
              </Link>
              <Link
                href="/m/romaneio"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Voltar para Romaneios
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function isCheckedStyle(scanned: boolean) {
  return scanned ? mobileColors.green : "transparent";
}
