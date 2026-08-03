"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Barcode,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  PackageCheck,
  Truck,
  X,
} from "lucide-react";
import { validateAndAssignOrderDanfeAction } from "@/app/(dashboard)/romaneio/actions";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";

type DanfeRomaneioModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderCode: string;
  customerName: string;
  carrierHint?: string;
  onSuccess?: () => void;
  isDesktop?: boolean;
  redirectRomaneioUrl?: string;
  redirectConferenceUrl?: string;
};

export function DanfeRomaneioModal({
  isOpen,
  onClose,
  orderId,
  orderCode,
  customerName,
  carrierHint,
  onSuccess,
  isDesktop = false,
  redirectRomaneioUrl,
  redirectConferenceUrl,
}: DanfeRomaneioModalProps) {
  const router = useRouter();
  const [scanValue, setScanValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    romaneioId: string;
    romaneioCodigo: string;
    carrierName: string;
    totalOrders: number;
  } | null>(null);

  const romaneioTargetUrl = redirectRomaneioUrl || (isDesktop ? "/romaneio" : "/m/romaneio");
  const conferenceQueueUrl =
    redirectConferenceUrl || (isDesktop ? "/expedicao/conferencia?feedback=romaneio_ok" : "/m/conferencia?feedback=romaneio_ok");

  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    videoRef,
    cameraSupported,
    cameraEnabled,
    cameraStarting,
    cameraMessage,
    toggleCamera,
  } = useCameraBarcodeScanner({
    onDetected: (code) => {
      if (!isProcessing && !result) {
        handleDanfeSubmit(code);
      }
    },
  });

  useEffect(() => {
    if (isOpen) {
      setScanValue("");
      setErrorMsg(null);
      setResult(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleDanfeSubmit(codeToProcess?: string) {
    const raw = (codeToProcess || scanValue).trim();
    if (!raw) {
      setErrorMsg("Por favor, bipe ou digite o código da DANFE.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await validateAndAssignOrderDanfeAction({
        orderId,
        scannedDanfe: raw,
      });

      if (res.ok) {
        setResult({
          romaneioId: res.romaneioId,
          romaneioCodigo: res.romaneioCodigo,
          carrierName: res.carrierName,
          totalOrders: res.totalOrders,
        });
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao validar DANFE e vincular ao romaneio.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-slate-950 p-6 shadow-2xl sm:rounded-[28px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Preparar para Romaneio</h2>
              <p className="text-xs text-slate-400">
                Pedido <span className="font-semibold text-slate-200">{orderCode}</span> • {customerName}
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-4 overflow-y-auto pr-1">
          {result ? (
            /* Success State */
            <div className="space-y-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
                  DANFE Validada com Sucesso
                </span>
                <h3 className="mt-2 text-xl font-bold text-white">
                  Alocado no Romaneio
                </h3>
                <p className="mt-1 text-sm font-semibold text-amber-300">
                  {result.romaneioCodigo}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/5 bg-slate-900/80 p-3 text-left">
                <div>
                  <p className="text-[11px] font-medium uppercase text-slate-400">Transportadora</p>
                  <p className="mt-0.5 text-sm font-bold text-white">{result.carrierName}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase text-slate-400">Total no Romaneio</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-300">{result.totalOrders} pedidos</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => router.push(romaneioTargetUrl)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400"
                >
                  <Truck className="h-4 w-4" />
                  Ir para Romaneios
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(conferenceQueueUrl);
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-medium text-slate-200 hover:bg-white/10"
                >
                  <PackageCheck className="h-4 w-4" />
                  Voltar para Fila de Conferência
                </button>
              </div>
            </div>
          ) : (
            /* Scanning State */
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
                <p className="font-semibold">Bipe a DANFE Simplificada (etiqueta com chave de 44 dígitos).</p>
                <p className="mt-1 text-amber-200/80">
                  O WMS identificará a transportadora e alocará este pedido automaticamente na carga aberta.
                </p>
              </div>

              {carrierHint && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Truck className="h-3.5 w-3.5 text-amber-400" />
                  <span>Transportadora estimada: <strong className="text-white">{carrierHint}</strong></span>
                </div>
              )}

              {/* Form Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleDanfeSubmit();
                }}
                className="space-y-3"
              >
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Barcode className="h-5 w-5" />
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    placeholder="Bipar ou digitar chave da DANFE..."
                    disabled={isProcessing}
                    className="h-12 w-full rounded-2xl border border-white/15 bg-slate-900 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                {errorMsg && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    {errorMsg}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={toggleCamera}
                    disabled={!cameraSupported || isProcessing}
                    className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold ${
                      cameraEnabled
                        ? "bg-rose-500 text-white"
                        : "border border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {cameraEnabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                    {cameraStarting ? "Iniciando câmera..." : cameraEnabled ? "Desligar câmera" : "Usar Câmera"}
                  </button>

                  <button
                    type="submit"
                    disabled={isProcessing || !scanValue.trim()}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 shadow-md hover:bg-amber-400 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        Confirmar DANFE
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Camera Video View */}
              {cameraEnabled && (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="aspect-video w-full object-cover"
                  />
                  {cameraMessage && (
                    <p className="p-2 text-center text-xs text-slate-400">{cameraMessage}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
