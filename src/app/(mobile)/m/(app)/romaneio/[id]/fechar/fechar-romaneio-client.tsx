"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Barcode,
  Camera,
  CameraOff,
  CheckCircle2,
  FileDown,
  IdCard,
  Loader2,
  PackageCheck,
  RotateCcw,
  Sparkles,
  Truck,
  Upload,
  User,
} from "lucide-react";
import {
  completeRomaneioWithDoubleCheckAction,
  uploadRomaneioPhotoAction,
} from "@/app/(dashboard)/romaneio/actions";
import { mobileColors, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
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
  const scanInputRef = useRef<HTMLInputElement | null>(null);

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
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(250, ctx.currentTime);
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioContext not allowed or unsupported
    }
  }

  // Camera barcode scanner for double check
  const {
    videoRef: barcodeVideoRef,
    cameraSupported: barcodeCamSupported,
    cameraEnabled: barcodeCamEnabled,
    cameraStarting: barcodeCamStarting,
    toggleCamera: toggleBarcodeCamera,
  } = useCameraBarcodeScanner({
    onDetected: (code) => {
      handleDoubleCheckScan(code);
    },
  });

  // Focus scan input on load
  useEffect(() => {
    if (step === "double_check") {
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 300);
    }
  }, [step]);

  // Handle barcode/DANFE scan in double check
  function handleDoubleCheckScan(rawCode?: string) {
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
        (order as any).danfe_simplificada,
        (order as any).payload_origem?.danfe_simplificada,
        (order as any).payload_origem?.chave_nfe,
      ]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, ""));

      return targets.some((t) => t === clean || t.includes(clean) || clean.includes(t));
    });

    if (matched) {
      if (scannedIds.has(matched.id)) {
        playBeep(true);
        setScanFeedback({
          type: "success",
          message: `Volume ${matched.externalNumber || matched.code} já estava bipado.`,
        });
      } else {
        playBeep(true);
        setScannedIds((prev) => {
          const next = new Set(prev);
          next.add(matched.id);
          return next;
        });
        setScanFeedback({
          type: "success",
          message: `✔ Volume ${matched.externalNumber || matched.code} conferido com sucesso!`,
        });
      }
    } else {
      playBeep(false);
      setScanFeedback({
        type: "error",
        message: `❌ Código "${code}" não pertence a esta carga (${romaneio.carrierName})!`,
      });
    }

    scanInputRef.current?.focus();
  }

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
      // Reset input
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
      // 1. Upload photos if present
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

      // 2. Complete romaneio
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
        <Link
          href="/m/romaneio"
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
        </Link>
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
          {step === "double_check" ? "1. Double Check" : step === "motorista" ? "2. Motorista" : step === "fotos" ? "3. Fotos" : "Concluído"}
        </span>
      </div>

      <div className="app-scroll space-y-4 px-[18px] pb-[32px]" style={{ flex: 1, overflowY: "auto" }}>
        {/* ========================================================================= */}
        {/* STEP 1: DOUBLE CHECK / BIPAGEM DE VOLUMES */}
        {/* ========================================================================= */}
        {step === "double_check" && (
          <div className="space-y-4">
            {/* Progress Card */}
            <div className="rounded-[24px] p-4" style={cardStyle}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span style={{ color: mobileColors.muted }}>Conferência de Volumes</span>
                <span style={{ color: isDoubleCheckComplete ? mobileColors.green : mobileColors.amber }}>
                  {scannedCount} de {totalOrders} volumes ({Math.round((scannedCount / Math.max(1, totalOrders)) * 100)}%)
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (scannedCount / Math.max(1, totalOrders)) * 100)}%`,
                    background: isDoubleCheckComplete ? mobileColors.green : mobileColors.amber,
                  }}
                />
              </div>
            </div>

            {/* Scanner Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDoubleCheckScan();
              }}
              className="space-y-2"
            >
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Barcode className="h-5 w-5" />
                </div>
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Bipar DANFE Simplificada do volume..."
                  className="h-12 w-full rounded-2xl border border-white/15 bg-slate-900 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleBarcodeCamera}
                  disabled={!barcodeCamSupported}
                  className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold ${
                    barcodeCamEnabled
                      ? "bg-rose-500 text-white"
                      : "border border-white/10 bg-slate-900 text-slate-200"
                  }`}
                >
                  {barcodeCamEnabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  {barcodeCamStarting ? "Iniciando câmera..." : barcodeCamEnabled ? "Desligar Câmera" : "Ler pela Câmera"}
                </button>

                <button
                  type="submit"
                  disabled={!scanInput.trim()}
                  className="flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 shadow hover:bg-amber-400 disabled:opacity-50"
                >
                  Bipar
                </button>
              </div>
            </form>

            {/* Camera View */}
            {barcodeCamEnabled && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                <video ref={barcodeVideoRef} playsInline muted className="aspect-video w-full object-cover" />
              </div>
            )}

            {/* Scan Feedback Banner */}
            {scanFeedback && (
              <div
                className={`rounded-2xl p-3.5 text-xs font-semibold transition animate-in fade-in ${
                  scanFeedback.type === "success"
                    ? "border border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                    : "border border-rose-500/40 bg-rose-950/40 text-rose-300"
                }`}
              >
                {scanFeedback.message}
              </div>
            )}

            {/* Volumes Checklist */}
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Lista de Volumes ({totalOrders})
              </p>
              {romaneio.orders.map((order) => {
                const isScanned = scannedIds.has(order.id);
                return (
                  <div
                    key={order.id}
                    className={`flex items-center justify-between rounded-2xl p-3.5 transition ${
                      isScanned
                        ? "border border-emerald-500/30 bg-emerald-950/20 text-emerald-100"
                        : "border border-white/10 bg-white/5 text-slate-200"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{order.externalNumber || order.code}</span>
                        {isScanned && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                            Conferido
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {order.customer} • {order.destination}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setScannedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(order.id)) next.delete(order.id);
                          else next.add(order.id);
                          return next;
                        });
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                        isScanned
                          ? "bg-emerald-500 text-slate-950 font-bold"
                          : "border border-white/15 bg-white/5 text-slate-400"
                      }`}
                    >
                      {isScanned ? <CheckCircle2 className="h-5 w-5" /> : <Barcode className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Advance Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setStep("motorista")}
                disabled={!isDoubleCheckComplete}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Avançar para Dados do Motorista
                <ArrowRight className="h-4 w-4" />
              </button>
              {!isDoubleCheckComplete && (
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  Bipe todos os {totalOrders} volumes para liberar o próximo passo.
                </p>
              )}
            </div>
          </div>
        )}

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
                Voltar
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
