"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Barcode,
  Camera,
  Check,
  CheckCircle2,
  IdCard,
  Keyboard,
  List,
  PackageCheck,
  PenLine,
  RotateCcw,
  Truck,
  User,
  X,
} from "lucide-react";
import {
  completeRomaneioWithDoubleCheckAction,
  uploadRomaneioPhotoAction,
} from "@/app/(dashboard)/romaneio/actions";
import {
  mobileColors,
  mobileGradient,
  hexAlpha,
  headingFont,
  MobileButtonSpinner,
  MobileScanOverlay,
  type ScanOverlayState,
} from "@/components/mobile/mobile-kit";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useFacePhotoCapture } from "@/hooks/use-face-photo-capture";
import { getCarrierBrand } from "@/lib/carrier-branding";
import type { RomaneioRecordDetail, SavedDriver } from "@/lib/romaneio-records";

const DownloadRomaneioPdfButton = dynamic(
  () => import("@/components/mobile/download-romaneio-pdf-button").then((m) => m.DownloadRomaneioPdfButton),
  { ssr: false },
);
const SignaturePadOverlay = dynamic(
  () => import("@/components/mobile/signature-pad").then((m) => m.SignaturePadOverlay),
  { ssr: false },
);

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
  // Mirrors scannedIds synchronously so handleDoubleCheckScan never reads a
  // stale snapshot: two barcodes scanned back-to-back (well within a single
  // React render) previously both closed over the same pre-update Set,
  // computed their own "+1" copy from it, and the second setScannedIds call
  // clobbered the first -- losing a scanned order the operator had already
  // confirmed. Reading/writing this ref instead of the state value keeps
  // every scan additive regardless of render timing.
  const scannedIdsRef = useRef<Set<string>>(new Set());
  const [overlay, setOverlay] = useState<ScanOverlayState>(null);
  const [showOrderListModal, setShowOrderListModal] = useState(false);
  // Manual entry: the DANFE simplificada's barcode encodes the 44-digit
  // chave de acesso as a single long, thin Code128 -- exactly the kind of
  // barcode that's hard to frame with a phone camera (same complaint as
  // boleto barcodes). The digits are also printed as text right next to
  // it, so typing them in is a reliable fallback, not just an emergency one.
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Enquanto o aviso verde/vermelho/amarelo está na tela, novas leituras são
  // ignoradas de propósito -- sem isso, um código ainda em frente à câmera
  // podia sofrer uma falha de leitura momentânea (tremida de mão, foco
  // ajustando) entre um frame e outro; requirePresenceGap (400ms) do
  // useCameraBarcodeScanner então tratava isso como "código saiu e voltou",
  // disparando handleDoubleCheckScan de novo por baixo do aviso ainda
  // visível -- lido pelo usuário como "fica bipando várias vezes, certo ou
  // errado". Usa timestamp (não um booleano) pra não precisar de outro
  // setState/re-render só pra isso.
  const scanLockedUntilRef = useRef(0);
  const barcodeBufferRef = useRef<string>("");
  const barcodeLastKeyTimeRef = useRef<number>(0);

  // Driver state
  const [selectedDriverKey, setSelectedDriverKey] = useState<string>("");
  const [driverName, setDriverName] = useState(romaneio.driverName || "");
  const [driverDoc, setDriverDoc] = useState(romaneio.driverDocument || "");
  const [vehiclePlate, setVehiclePlate] = useState(romaneio.vehiclePlate || "");
  const [vehicleModel, setVehicleModel] = useState(romaneio.vehicleModel || "");

  // Only show drivers already saved under this romaneio's own
  // transportadora -- a driver from a different carrier's roster showing
  // up here would just be a wrong-carrier mix-up, not a helpful shortcut.
  const filteredDrivers = useMemo(() => {
    const carrier = romaneio.carrierName?.trim().toLowerCase();
    if (!carrier) return [];
    return savedDrivers.filter((driver) => driver.transportadoraNome?.trim().toLowerCase().includes(carrier));
  }, [savedDrivers, romaneio.carrierName]);

  // Photo state
  const [operadorPhoto, setOperadorPhoto] = useState<string | null>(null);
  const [motoristaPhoto, setMotoristaPhoto] = useState<string | null>(null);
  // "foto" quando capturado pela câmera facial, "assinatura" quando pelo
  // SignaturePadOverlay -- só existe pro card do motorista (o operador é
  // sempre fotografado, sem alternativa).
  const [motoristaCaptureType, setMotoristaCaptureType] = useState<"foto" | "assinatura" | null>(null);
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  const [faceCameraTarget, setFaceCameraTarget] = useState<"operador" | "motorista" | null>(null);
  const [faceCaptureFlash, setFaceCaptureFlash] = useState(false);
  // Mirrors faceCameraTarget synchronously so the capture callback always
  // knows which card to fill in, even though it's registered once on mount
  // (see useFacePhotoCapture below) rather than re-created per target.
  const faceCameraTargetRef = useRef<"operador" | "motorista" | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Keep the ref in sync with every state change, including the manual
  // tap-to-toggle path in the "ver lista" drawer, so it's always the
  // source of truth handleDoubleCheckScan reads from.
  useEffect(() => {
    scannedIdsRef.current = scannedIds;
  }, [scannedIds]);

  const totalOrders = romaneio.orders.length;
  const scannedCount = scannedIds.size;
  const isDoubleCheckComplete = totalOrders > 0 && scannedCount >= totalOrders;
  const carrierBrand = getCarrierBrand(romaneio.carrierName);

  // Sound + haptic effects
  function playBeep(success: boolean) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(success ? 60 : [70, 60, 70]);
    }
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.14);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.14);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(240, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioContext not supported
    }
  }

  // Full-screen scan flash, auto-dismissed -- mirrors the pattern used by
  // mobile-receiving-panel.tsx / general-inventory-client.tsx so the same
  // MobileScanOverlay component reads consistently across the app.
  function flash(next: ScanOverlayState) {
    setOverlay(next);
    scanLockedUntilRef.current = Date.now() + 1300;
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setOverlay(null), 1300);
  }

  // Handle barcode/DANFE scan in double check
  const handleDoubleCheckScan = useCallback((rawCode: string) => {
    if (Date.now() < scanLockedUntilRef.current) return;

    const code = (rawCode || "").trim();
    if (!code) return;

    // Normalize for matching
    const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!clean) return;

    // Regra padrão: igualdade EXATA contra os identificadores fixos --
    // chave de acesso (44 dígitos), código de rastreio, código WMS e
    // número do pedido. Um código de barras codifica um desses valores
    // inteiro, nunca um fragmento -- por isso nada de substring aqui, e
    // order.id (UUID) não entra: nunca fez sentido de negócio comparar um
    // UUID interno contra um código bipado.
    const exactMatches = romaneio.orders.filter((order) => {
      const exactTargets = [order.code, order.externalNumber, order.invoiceKey, order.trackingCode]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, ""));
      return exactTargets.some((t) => t === clean);
    });

    // Número da NF -- é o alvo PRINCIPAL de bipagem por câmera, não um
    // fallback secundário: o código de barras real da DANFE simplificada
    // (buildSimplifiedDanfePage em shipping-danfe.ts, rotulado ali como
    // "CODIGO DE CONFERENCIA - BIPAR PARA LIBERAR ROMANEIO") NUNCA
    // codifica a chave de 44 dígitos -- codifica o número da NF com
    // zero-padding fixo de 6 dígitos (ex.: NF 66887 -> "066887"). Comparar
    // por igualdade numérica (dígitos sem zero à esquerda dos dois lados)
    // em vez de endsWith resolve o padding em qualquer direção -- bipar
    // "066887" bate contra invoiceNumberDigits "66887" e vice-versa, e o
    // mesmo caminho também cobre quem digita o número curto à mão (ex.:
    // placeholder "Ex: 66459" da entrada manual).
    const cleanDigits = /^\d+$/.test(clean) ? clean.replace(/^0+(?=\d)/, "") : "";
    const invoiceSuffixMatches =
      exactMatches.length > 0 || !cleanDigits
        ? []
        : romaneio.orders.filter((order) => {
            const targetDigits = (order.invoiceNumberDigits || "").replace(/^0+(?=\d)/, "");
            return targetDigits.length > 0 && targetDigits === cleanDigits;
          });

    const candidates = exactMatches.length > 0 ? exactMatches : invoiceSuffixMatches;

    if (candidates.length > 1) {
      playBeep(false);
      flash({
        type: "warn",
        title: "Código ambíguo",
        code,
        sub: "Bate com mais de um pedido desta carga -- confira manualmente na lista.",
      });
      return;
    }

    const matched = candidates[0];

    if (matched) {
      const label = matched.externalNumber || matched.code;

      if (scannedIdsRef.current.has(matched.id)) {
        playBeep(true);
        flash({ type: "ok", title: "Já conferido", code: label, sub: "Este volume já tinha sido bipado antes." });
        return;
      }

      playBeep(true);
      // Read/write scannedIdsRef synchronously (not the scannedIds state
      // captured in this callback's closure) so two scans landing before
      // React re-renders still both count -- see the comment on
      // scannedIdsRef's declaration.
      const nextSet = new Set(scannedIdsRef.current);
      nextSet.add(matched.id);
      scannedIdsRef.current = nextSet;
      setScannedIds(nextSet);

      const isLastOne = nextSet.size >= totalOrders;
      flash(
        isLastOne
          ? { type: "ok", title: "Tudo conferido!", code: `${totalOrders}/${totalOrders}`, sub: `Todos os ${totalOrders} volumes foram conferidos.` }
          : { type: "ok", title: "Volume conferido", code: label, sub: `${nextSet.size} de ${totalOrders} pedidos conferidos.` },
      );

      if (isLastOne) {
        // Auto advance to driver step after 1.2s
        if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = setTimeout(() => {
          setStep("motorista");
        }, 1200);
      }
      return;
    }

    playBeep(false);
    flash({ type: "err", title: "Não pertence a esta carga", code, sub: `Este código não está vinculado à carga de ${romaneio.carrierName}.` });
  }, [romaneio.orders, romaneio.carrierName, totalOrders]);

  // Camera barcode scanner with automatic detection
  const {
    videoRef,
    cameraSupported,
    cameraStarting,
    cameraMessage,
    startCamera,
    stopCamera,
  } = useCameraBarcodeScanner({
    onDetected: handleDoubleCheckScan,
    requirePresenceGap: true,
    confirmReads: 2,
    presenceGapMs: 400,
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
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, [step, startCamera, stopCamera]);

  // Background hardware barcode reader listener (USB/Bluetooth gun)
  useEffect(() => {
    if (step !== "double_check") return;

    function handleKeyDown(e: KeyboardEvent) {
      // If typing in an actual input (e.g. modal), don't intercept
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const now = Date.now();
      if (now - barcodeLastKeyTimeRef.current > 150) {
        barcodeBufferRef.current = "";
      }
      barcodeLastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        if (barcodeBufferRef.current.trim()) {
          handleDoubleCheckScan(barcodeBufferRef.current.trim());
          barcodeBufferRef.current = "";
        }
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, handleDoubleCheckScan]);

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

  // Open the in-app face-capture camera for a given photo card.
  function openFaceCamera(target: "operador" | "motorista") {
    faceCameraTargetRef.current = target;
    setFaceCameraTarget(target);
  }

  // Fired by useFacePhotoCapture once a well-framed face has been
  // auto-captured (or the operator tapped the manual fallback button).
  const handleFaceCaptured = useCallback((dataUrl: string) => {
    if (faceCameraTargetRef.current === "operador") {
      setOperadorPhoto(dataUrl);
    } else if (faceCameraTargetRef.current === "motorista") {
      setMotoristaPhoto(dataUrl);
      setMotoristaCaptureType("foto");
    }

    // Brief success flash over the camera view before it closes, mirroring
    // the scan-confirmation flashes used elsewhere in this flow.
    setFaceCaptureFlash(true);
    window.setTimeout(() => {
      setFaceCaptureFlash(false);
      faceCameraTargetRef.current = null;
      setFaceCameraTarget(null);
    }, 700);
  }, []);

  const faceCapture = useFacePhotoCapture({ onCaptured: handleFaceCaptured });

  // Fired by SignaturePadOverlay's "Confirmar assinatura" -- only ever used
  // for the motorista card (the operator is never asked to sign, only
  // photographed).
  const handleSignatureCaptured = useCallback((dataUrl: string) => {
    setMotoristaPhoto(dataUrl);
    setMotoristaCaptureType("assinatura");
    setSignaturePadOpen(false);
  }, []);

  useEffect(() => {
    if (faceCameraTarget) {
      void faceCapture.startCamera();
    } else {
      faceCapture.stopCamera(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceCameraTarget]);

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
    if (!operadorPhoto) {
      setSubmitError("Tire a foto do operador.");
      return;
    }
    if (!motoristaPhoto) {
      setSubmitError("Tire a foto ou colha a assinatura do motorista.");
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

      const result = await completeRomaneioWithDoubleCheckAction({
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
          motoristaCaptureType: motUrl ? motoristaCaptureType ?? "foto" : null,
        },
        scannedOrderIds: Array.from(scannedIds),
      });

      if (!result?.ok) {
        setSubmitError(result?.message || "Falha ao finalizar o romaneio.");
        return;
      }

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
  // STEP 1: DOUBLE CHECK / CÂMERA AUTOMÁTICA EM TELA CHEIA
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
        {/* Live Camera Video Feed. object-fit: contain (not cover) so the
            full frame is always visible, never cropped/zoomed to fill the
            screen -- important here since a DANFE's barcode is long and
            thin, and cropping made it hard to fit the whole thing in view. */}
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#000",
          }}
        />

        {/* Cinematic Vignette Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.65) 100%)",
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
              background: "rgba(255,255,255,0.14)",
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
              background: "rgba(255,255,255,0.14)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <List className="h-4 w-4" style={{ color: mobileColors.amber }} />
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
              // Wider and shorter than a generic scan box -- a DANFE's
              // barcode (like a boleto's) is long and thin, so a
              // near-square frame made it hard to fit the whole thing in.
              width: 320,
              height: 130,
              borderRadius: 20,
              border: `3px dashed ${hexAlpha("#ffffff", 0.85)}`,
              boxShadow: "0 0 20px rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          />

          <span
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 13,
              fontWeight: 600,
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
              textAlign: "center",
              maxWidth: 300,
            }}
          >
            {!cameraSupported
              ? "Câmera indisponível neste navegador."
              : cameraStarting
              ? "Iniciando câmera..."
              : cameraMessage ?? "Aponte para a DANFE / Etiqueta do pacote"}
          </span>

          {/* DANFE simplificada's barcode is long and thin -- hard to frame
              fully, same problem as a boleto. Typing the printed digits is
              a reliable alternative, not just a last resort. */}
          <button
            type="button"
            onClick={() => setShowManualEntry(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.14)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <Keyboard className="h-4 w-4" style={{ color: mobileColors.amber }} />
            Digitar código da DANFE
          </button>
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
            padding: "0 20px calc(24px + env(safe-area-inset-bottom))",
            textAlign: "center",
          }}
        >
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
                        width: 24,
                        height: 24,
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
              }}
            >
              <span>Avançar para Motorista</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <MobileScanOverlay overlay={overlay} />

        {/* Modal: Digitar código da DANFE manualmente */}
        {showManualEntry && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 450,
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(10px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div
              onClick={() => setShowManualEntry(false)}
              style={{ position: "absolute", inset: 0 }}
            />
            <div
              style={{
                position: "relative",
                background: "#0A1120",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                border: "1px solid rgba(255,255,255,0.15)",
                padding: "20px 18px calc(20px + env(safe-area-inset-bottom))",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ color: "#fff", fontWeight: 800, fontSize: 16, ...headingFont }}>
                  Digitar código da DANFE
                </h3>
                <button
                  type="button"
                  onClick={() => setShowManualEntry(false)}
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

              <p style={{ color: mobileColors.muted, fontSize: 12.5, lineHeight: 1.5 }}>
                Digite só o número da NF (mais rápido) — ou, se preferir, a chave de acesso completa de 44 dígitos impressa abaixo do código de barras, ou o número do pedido.
              </p>

              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualCode.trim()) {
                    handleDoubleCheckScan(manualCode.trim());
                    setManualCode("");
                    setShowManualEntry(false);
                  }
                }}
                placeholder="Ex: 66459"
                className="h-12 w-full rounded-xl px-3 text-sm tracking-wide outline-none"
                style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: "rgba(5,7,13,0.5)", color: mobileColors.text }}
              />

              <button
                type="button"
                onClick={() => {
                  if (!manualCode.trim()) return;
                  handleDoubleCheckScan(manualCode.trim());
                  setManualCode("");
                  setShowManualEntry(false);
                }}
                disabled={!manualCode.trim()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
              >
                <Keyboard className="h-4 w-4" />
                Confirmar leitura
              </button>
            </div>
          </div>
        )}

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
                    Toque em um pendente para bipar com a câmera
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
                        // Orders can no longer be ticked off by tapping --
                        // that let operators confirm a volume was loaded
                        // without ever scanning it. Tapping a pending order
                        // now just closes this list, dropping the operator
                        // back on the live camera view so they scan it for
                        // real; already-scanned orders are a no-op here.
                        if (!isScanned) setShowOrderListModal(false);
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
                        cursor: isScanned ? "default" : "pointer",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                            {order.code}
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
      {/* In-app face-capture camera: fits the face in the oval guide and
          auto-captures once framed well (falls back to a manual capture
          button on browsers without automatic face detection). */}
      {faceCameraTarget ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#000", display: "flex", flexDirection: "column" }}>
          {/* object-fit: contain, not cover: cover was still reading as an
              extreme zoom on some devices even after matching the
              requested stream's aspect ratio to the viewport -- contain is
              the only setting that's guaranteed to never crop the frame,
              whatever aspect ratio the camera actually hands back. May
              show thin letterbox bars on the sides/top, which is the
              trade-off for never zooming in. */}
          <video
            ref={faceCapture.videoRef}
            playsInline
            muted
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: "scaleX(-1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.7) 100%)",
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
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, ...headingFont }}>
              {faceCameraTarget === "operador" ? "Foto do Operador" : "Foto do Motorista / Carga"}
            </span>
            <button
              type="button"
              onClick={() => {
                faceCameraTargetRef.current = null;
                setFaceCameraTarget(null);
              }}
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

          <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                width: 230,
                height: 290,
                borderRadius: "50%",
                border: `3px solid ${faceCapture.faceAligned ? mobileColors.green : "rgba(255,255,255,0.75)"}`,
                boxShadow: faceCapture.faceAligned ? `0 0 0 8px ${hexAlpha(mobileColors.green, 0.18)}` : "none",
                transition: "border-color 200ms ease, box-shadow 200ms ease",
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
              gap: 14,
              padding: "0 24px calc(32px + env(safe-area-inset-bottom))",
              textAlign: "center",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>
              {faceCapture.cameraStarting ? "Abrindo câmera..." : faceCapture.cameraMessage ?? "Encaixe o rosto na moldura."}
            </span>
            {faceCapture.cameraEnabled ? (
              // Always available, even when the browser claims to support
              // automatic face detection -- that support check only proves
              // the API exists, not that it actually finds a face on this
              // device, so this stays the one guaranteed way to capture.
              <button
                type="button"
                onClick={faceCapture.captureManually}
                style={{
                  height: 52,
                  padding: "0 28px",
                  borderRadius: 16,
                  background: mobileColors.amber,
                  color: "#000",
                  fontWeight: 800,
                  fontSize: 14,
                  border: "none",
                }}
              >
                Capturar foto
              </button>
            ) : null}
          </div>

          {faceCaptureFlash ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 3,
                background: "rgba(16,185,129,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: "50%",
                  background: mobileColors.green,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check className="h-10 w-10 stroke-[3]" style={{ color: "#05130D" }} />
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Signature overlay -- only reachable from the motorista card, for
          drivers who refuse to be photographed. Same full-screen dark
          shell as the face-capture camera above so switching between the
          two capture modes doesn't feel like leaving the app. */}
      {signaturePadOpen ? (
        <SignaturePadOverlay
          title="Assinatura do Motorista"
          onCancel={() => setSignaturePadOpen(false)}
          onConfirm={handleSignatureCaptured}
        />
      ) : null}

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
            {/* Quick saved driver selector -- only drivers already saved
                under this romaneio's own transportadora. */}
            {filteredDrivers.length > 0 && (
              <div className="rounded-[24px] p-4" style={cardStyle}>
                <label className="block text-xs font-semibold" style={{ color: mobileColors.muted }}>
                  Motoristas de {romaneio.carrierName} ({filteredDrivers.length} salvo{filteredDrivers.length === 1 ? "" : "s"})
                </label>
                <select
                  value={selectedDriverKey}
                  onChange={(e) => handleSelectSavedDriver(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none"
                  style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: "rgba(5,7,13,0.5)", color: mobileColors.text }}
                >
                  <option value="">-- Selecione ou preencha novo abaixo --</option>
                  {filteredDrivers.map((d, i) => (
                    <option key={i} value={`${d.nome}|${d.documento}`}>
                      {d.nome} {d.documento ? `(Doc: ${d.documento})` : ""} {d.veiculoPlaca ? `[Placa: ${d.veiculoPlaca}]` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Manual Form */}
            <div className="rounded-[24px] p-4 space-y-3" style={cardStyle}>
              <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: mobileColors.text, ...headingFont }}>
                <IdCard className="h-4 w-4" style={{ color: mobileColors.amber }} />
                Dados do Motorista e Veículo
              </h3>

              <div>
                <label className="text-[11px] font-medium uppercase" style={{ color: mobileColors.muted }}>
                  Nome Completo do Motorista *
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo da Silva"
                  className="mt-1 h-11 w-full rounded-xl px-3 text-sm outline-none"
                  style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: "rgba(5,7,13,0.5)", color: mobileColors.text }}
                />
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase" style={{ color: mobileColors.muted }}>
                  Documento (CPF / RG / CNH) *
                </label>
                <input
                  type="text"
                  value={driverDoc}
                  onChange={(e) => setDriverDoc(e.target.value)}
                  placeholder="Ex: 123.456.789-00"
                  className="mt-1 h-11 w-full rounded-xl px-3 text-sm outline-none"
                  style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: "rgba(5,7,13,0.5)", color: mobileColors.text }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium uppercase" style={{ color: mobileColors.muted }}>
                    Placa do Veículo *
                  </label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    placeholder="Ex: ABC-1D23"
                    className="mt-1 h-11 w-full rounded-xl px-3 text-sm uppercase outline-none"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: "rgba(5,7,13,0.5)", color: mobileColors.text }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase" style={{ color: mobileColors.muted }}>
                    Modelo do Veículo
                  </label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Ex: Fiorino / HR"
                    className="mt-1 h-11 w-full rounded-xl px-3 text-sm outline-none"
                    style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: "rgba(5,7,13,0.5)", color: mobileColors.text }}
                  />
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("double_check")}
                className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-2xl px-3 text-center font-semibold"
                style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.muted }}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>Voltar à Câmera</span>
              </button>
              <button
                type="button"
                onClick={() => setStep("fotos")}
                disabled={!driverName.trim() || !driverDoc.trim() || !vehiclePlate.trim()}
                className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-2xl px-3 text-center font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
              >
                <span>Avançar para Fotos</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: AUDITORIA FOTOGRÁFICA */}
        {/* ========================================================================= */}
        {step === "fotos" && (
          <div className="space-y-4">
            <div
              className="rounded-2xl p-3 text-xs"
              style={{ border: `1px solid ${hexAlpha(mobileColors.amber, 0.25)}`, background: hexAlpha(mobileColors.amber, 0.1), color: mobileColors.amber }}
            >
              A foto do operador e a foto (ou assinatura) do motorista são obrigatórias para finalizar o romaneio.
            </div>

            {/* Foto Operador */}
            <div className="rounded-[24px] p-4 space-y-3" style={cardStyle}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold" style={{ color: mobileColors.text }}>
                  <User className="h-4 w-4" style={{ color: mobileColors.amber }} />
                  Foto do Operador ({currentUserName})
                </span>
                {operadorPhoto && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: hexAlpha(mobileColors.green, 0.18), color: mobileColors.green }}
                  >
                    Capturada
                  </span>
                )}
              </div>

              {operadorPhoto ? (
                <div
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl"
                  style={{ border: `1px solid ${hexAlpha(mobileColors.green, 0.3)}`, background: hexAlpha(mobileColors.green, 0.06) }}
                >
                  <CheckCircle2 className="h-8 w-8" style={{ color: mobileColors.green }} />
                  <span className="text-xs font-semibold" style={{ color: mobileColors.green }}>
                    Foto capturada e protegida
                  </span>
                  <button
                    type="button"
                    onClick={() => openFaceCamera("operador")}
                    className="mt-1 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
                    style={{ background: hexAlpha("#94A3B8", 0.1), color: mobileColors.text }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Tirar novamente
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openFaceCamera("operador")}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed"
                  style={{ borderColor: hexAlpha("#94A3B8", 0.25), background: hexAlpha("#94A3B8", 0.05), color: mobileColors.muted }}
                >
                  <Camera className="h-8 w-8" style={{ color: mobileColors.amber }} />
                  <span className="text-xs font-semibold">Tirar Foto do Operador</span>
                </button>
              )}
            </div>

            {/* Foto Motorista */}
            <div className="rounded-[24px] p-4 space-y-3" style={cardStyle}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold" style={{ color: mobileColors.text }}>
                  {motoristaCaptureType === "assinatura" ? (
                    <PenLine className="h-4 w-4" style={{ color: mobileColors.amber }} />
                  ) : (
                    <Truck className="h-4 w-4" style={{ color: mobileColors.amber }} />
                  )}
                  {motoristaCaptureType === "assinatura" ? "Assinatura do Motorista" : "Foto do Motorista / Carga"}
                </span>
                {motoristaPhoto && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: hexAlpha(mobileColors.green, 0.18), color: mobileColors.green }}
                  >
                    Capturada
                  </span>
                )}
              </div>

              {motoristaPhoto ? (
                <div
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl"
                  style={{ border: `1px solid ${hexAlpha(mobileColors.green, 0.3)}`, background: hexAlpha(mobileColors.green, 0.06) }}
                >
                  <CheckCircle2 className="h-8 w-8" style={{ color: mobileColors.green }} />
                  <span className="text-xs font-semibold" style={{ color: mobileColors.green }}>
                    {motoristaCaptureType === "assinatura" ? "Assinatura capturada e protegida" : "Foto capturada e protegida"}
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        motoristaCaptureType === "assinatura" ? setSignaturePadOpen(true) : openFaceCamera("motorista")
                      }
                      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
                      style={{ background: hexAlpha("#94A3B8", 0.1), color: mobileColors.text }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {motoristaCaptureType === "assinatura" ? "Assinar novamente" : "Tirar novamente"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        motoristaCaptureType === "assinatura" ? openFaceCamera("motorista") : setSignaturePadOpen(true)
                      }
                      className="text-[11px] font-semibold underline underline-offset-2"
                      style={{ color: mobileColors.muted }}
                    >
                      {motoristaCaptureType === "assinatura" ? "Usar foto em vez disso" : "Assinar em vez disso"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => openFaceCamera("motorista")}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed"
                    style={{ borderColor: hexAlpha("#94A3B8", 0.25), background: hexAlpha("#94A3B8", 0.05), color: mobileColors.muted }}
                  >
                    <Camera className="h-8 w-8" style={{ color: mobileColors.amber }} />
                    <span className="text-xs font-semibold">Tirar Foto do Motorista / Carga</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignaturePadOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11.5px] font-semibold"
                    style={{ background: hexAlpha("#94A3B8", 0.05), color: mobileColors.muted }}
                  >
                    <PenLine className="h-3.5 w-3.5" style={{ color: mobileColors.amber }} />
                    Motorista se recusa a foto? Assinar na tela
                  </button>
                </div>
              )}
            </div>

            {submitError && (
              <div
                className="rounded-xl p-3 text-xs"
                style={{ border: `1px solid ${hexAlpha(mobileColors.red, 0.3)}`, background: hexAlpha(mobileColors.red, 0.08), color: mobileColors.redLight }}
              >
                {submitError}
              </div>
            )}

            {(!operadorPhoto || !motoristaPhoto) && (
              <div
                className="rounded-xl p-3 text-xs font-medium"
                style={{ border: `1px solid ${hexAlpha(mobileColors.amber, 0.3)}`, background: hexAlpha(mobileColors.amber, 0.08), color: mobileColors.amber }}
              >
                {!operadorPhoto && !motoristaPhoto
                  ? "Falta a foto do operador e a foto (ou assinatura) do motorista."
                  : !operadorPhoto
                    ? "Falta a foto do operador."
                    : "Falta a foto (ou assinatura) do motorista."}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("motorista")}
                disabled={isSubmitting}
                className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-2xl px-3 text-center font-semibold disabled:opacity-50"
                style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.muted }}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>Voltar</span>
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting || !operadorPhoto || !motoristaPhoto}
                className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-2xl px-3 text-center font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
              >
                {isSubmitting ? (
                  <MobileButtonSpinner />
                ) : (
                  <>
                    <PackageCheck className="h-4 w-4 shrink-0" />
                    <span>Finalizar Romaneio</span>
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
          <div
            className="space-y-5 rounded-[28px] p-6 text-center animate-in zoom-in-95 duration-300"
            style={{ border: `1px solid ${hexAlpha(mobileColors.green, 0.3)}`, background: hexAlpha(mobileColors.green, 0.08) }}
          >
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: hexAlpha(mobileColors.green, 0.18), color: mobileColors.green }}
            >
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <div>
              <span
                className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                style={{ background: hexAlpha(mobileColors.green, 0.18), color: mobileColors.green }}
              >
                Carga Expedida com Sucesso
              </span>
              <h2 className="mt-2 text-2xl font-bold" style={{ color: mobileColors.text, ...headingFont }}>
                Romaneio Finalizado!
              </h2>
              <p className="mt-1 text-sm font-semibold" style={{ color: mobileColors.amber }}>
                {romaneio.code}
              </p>
            </div>

            <div
              className="grid grid-cols-2 gap-3 rounded-2xl p-4 text-left"
              style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.1)}`, background: "rgba(5,7,13,0.5)" }}
            >
              <div>
                <p className="text-[11px] font-medium uppercase" style={{ color: mobileColors.muted }}>Transportadora</p>
                <p className="mt-0.5 text-sm font-bold" style={{ color: mobileColors.text }}>{romaneio.carrierName}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase" style={{ color: mobileColors.muted }}>Volumes Expedidos</p>
                <p className="mt-0.5 text-sm font-bold" style={{ color: mobileColors.green }}>{totalOrders} volumes</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase" style={{ color: mobileColors.muted }}>Motorista</p>
                <p className="mt-0.5 text-sm font-bold" style={{ color: mobileColors.text }}>{driverName}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase" style={{ color: mobileColors.muted }}>Placa</p>
                <p className="mt-0.5 text-sm font-bold" style={{ color: mobileColors.text }}>{vehiclePlate}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-3">
              <DownloadRomaneioPdfButton
                pdfUrl={`/api/romaneio/${romaneio.id}/pdf`}
                fileName={`romaneio-${romaneio.code.toLowerCase()}.pdf`}
                label="Baixar PDF do Romaneio"
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl px-4 text-center font-extrabold text-white disabled:opacity-70"
                style={{ background: mobileGradient, boxShadow: "0 10px 26px rgba(99,102,241,0.4)" }}
              />
              <Link
                href="/m/romaneio"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
                style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.muted }}
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
