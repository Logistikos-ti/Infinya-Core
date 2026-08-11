"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Barcode,
  CheckCircle2,
  Loader2,
  PackageCheck,
  Truck,
  X,
} from "lucide-react";
import { validateAndAssignOrderDanfeAction } from "@/app/(dashboard)/romaneio/actions";

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
  const [autoReturnSeconds, setAutoReturnSeconds] = useState(5);

  const romaneioTargetUrl = redirectRomaneioUrl || (isDesktop ? "/romaneio" : "/m/romaneio");
  const conferenceQueueUrl =
    redirectConferenceUrl || (isDesktop ? "/expedicao/conferencia?feedback=romaneio_ok" : "/m/conferencia?feedback=romaneio_ok");

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setScanValue("");
      setErrorMsg(null);
      setResult(null);
      setAutoReturnSeconds(5);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  const returnToConferenceQueue = useCallback(() => {
    onClose();
    router.replace(conferenceQueueUrl);
    router.refresh();
  }, [conferenceQueueUrl, onClose, router]);

  useEffect(() => {
    if (!isOpen || !result) return;

    setAutoReturnSeconds(5);
    const countdown = window.setInterval(() => {
      setAutoReturnSeconds((current) => Math.max(current - 1, 0));
    }, 1000);
    const timeout = window.setTimeout(() => {
      returnToConferenceQueue();
    }, 5000);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(timeout);
    };
  }, [isOpen, result, returnToConferenceQueue]);

  function handleClose() {
    if (isProcessing) return;
    if (result) {
      returnToConferenceQueue();
      return;
    }
    onClose();
  }

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
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setErrorMsg(res.message || "Não foi possível validar a DANFE do pedido.");
        setScanValue("");
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao processar a DANFE."
      );
      setScanValue("");
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Barcode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Preparar para Romaneio</h2>
              <p className="text-xs text-slate-400">
                Pedido <span className="font-semibold text-slate-200">{orderCode}</span> • {customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {result ? (
            /* Success State */
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  DANFE Validada com Sucesso
                </span>
                <h3 className="mt-2 text-xl font-bold text-white">
                  Alocado no Romaneio
                </h3>
                <p className="mt-1 text-sm font-semibold text-amber-300">
                  {result.romaneioCodigo}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  Voltando para a fila de conferência em {autoReturnSeconds} segundo{autoReturnSeconds === 1 ? "" : "s"}.
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
                  onClick={() => {
                    onClose();
                    router.push(romaneioTargetUrl);
                  }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400"
                >
                  <Truck className="h-4 w-4" />
                  Ir para Romaneios
                </button>
                <button
                  type="button"
                  onClick={() => {
                    returnToConferenceQueue();
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
                <p className="font-semibold">Bipe a DANFE Simplificada (chave de 44 dígitos).</p>
                <p className="mt-1 text-amber-200/80">
                  O WMS identificará a transportadora e alocará este pedido automaticamente na carga aberta.
                </p>
              </div>

              {carrierHint && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Truck className="h-3.5 w-3.5 text-amber-400" />
                  <span>Transportadora identificada: <strong className="text-white">{carrierHint}</strong></span>
                </div>
              )}

              {/* Form Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleDanfeSubmit();
                }}
                className="space-y-4"
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
                    placeholder="Bipar ou colar chave da DANFE..."
                    disabled={isProcessing}
                    autoFocus
                    className="h-12 w-full rounded-2xl border border-white/15 bg-slate-950/80 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 shadow-inner"
                  />
                </div>

                {errorMsg && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isProcessing || !scanValue.trim()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Validando e alocando no romaneio...
                    </>
                  ) : (
                    <>
                      Confirmar DANFE
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
