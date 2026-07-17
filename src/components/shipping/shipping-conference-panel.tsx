"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Barcode, Camera, CameraOff, Focus, ScanSearch, Volume2 } from "lucide-react";
import { saveShippingConferenceAction } from "@/app/(dashboard)/expedicao/conferencia/actions";
import { ShippingConferenceDocumentsPanel } from "@/components/shipping/shipping-conference-documents-panel";
import { InactivityWarningDialog } from "@/components/operations/inactivity-warning-dialog";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import type { PickingOperatorOption } from "@/lib/shipping-picking";
import type { ShippingConferenceOrder } from "@/lib/shipping-conference";
import type { ShippingAttachment } from "@/lib/shipping";

type ShippingConferencePanelProps = {
  order: ShippingConferenceOrder;
  operators: PickingOperatorOption[];
  currentUserId: string;
  currentUserName: string;
  feedback?: string;
  redirectBase?: string;
  documents: {
    orderId: string;
    depositanteId: string;
    attachments: ShippingAttachment[];
    isBlingOrder: boolean;
    isMercadoLivreOrder: boolean;
    hasTrackingCode: boolean;
    canUploadAttachments: boolean;
  };
};

type ConferenceItemState = ShippingConferenceOrder["items"][number] & {
  confirmedQuantityValue: string;
};

type ScanFeedbackTone = "success" | "error";

export function ShippingConferencePanel({
  order,
  operators: _operators,
  currentUserId,
  currentUserName,
  feedback,
  redirectBase = "/expedicao/conferencia",
  documents,
}: ShippingConferencePanelProps) {
  const router = useRouter();
  const defaultOperatorId = order.assignedOperatorId ?? currentUserId;
  const operatorDisplayName = order.assignedOperatorName?.trim() || currentUserName;
  const [selectedOperatorId] = useState(defaultOperatorId);
  const [items, setItems] = useState<ConferenceItemState[]>(
    order.items.map((item) => ({
      ...item,
      confirmedQuantityValue: String(item.confirmedQuantity),
    })),
  );
  const [scanValue, setScanValue] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanTone, setScanTone] = useState<ScanFeedbackTone>("success");
  const [operatorMode, setOperatorMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wrongProductScans, setWrongProductScans] = useState(order.wrongProductScans);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const conferenceFormRef = useRef<HTMLFormElement | null>(null);
  const conferenceIntentInputRef = useRef<HTMLInputElement | null>(null);
  const {
    videoRef,
    cameraSupported,
    cameraEnabled,
    cameraStarting,
    cameraMessage,
    toggleCamera,
  } = useCameraBarcodeScanner({
    onDetected: (code) => {
      applyScannedCode(code);
      resetTimer();
    },
  });
  const { isWarningVisible, countdownSeconds, resetTimer } = useInactivityTimeout({
    disabled: isSubmitting,
    onExpire: () => {
      router.replace(`${redirectBase}?feedback=inatividade`);
    },
  });

  const completionPercent = useMemo(() => {
    const requested = items.reduce((sum, item) => sum + item.requestedQuantity, 0);
    const confirmed = items.reduce((sum, item) => sum + normalizeQuantity(item.confirmedQuantityValue), 0);
    return requested > 0 ? Math.min(100, Math.round((confirmed / requested) * 100)) : 0;
  }, [items]);

  const pendingUnits = useMemo(
    () =>
      items.reduce((sum, item) => {
        const confirmed = normalizeQuantity(item.confirmedQuantityValue);
        return sum + Math.max(item.requestedQuantity - confirmed, 0);
      }, 0),
    [items],
  );

  const quantityDivergentItems = useMemo(
    () =>
      items.filter(
        (item) => normalizeQuantity(item.confirmedQuantityValue) !== item.requestedQuantity,
      ).length,
    [items],
  );

  useEffect(() => {
    if (!operatorMode || cameraEnabled) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(focusTimer);
  }, [cameraEnabled, operatorMode]);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    const submitTimeout = window.setTimeout(() => {
      setIsSubmitting(false);
    }, 15000);

    return () => window.clearTimeout(submitTimeout);
  }, [isSubmitting]);

  function focusScanInput() {
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    });
  }

  function playFeedbackTone(tone: ScanFeedbackTone) {
    if (!soundEnabled || typeof window === "undefined") {
      return;
    }

    const AudioContextRef =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextRef) {
      return;
    }

    const context = new AudioContextRef();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = tone === "success" ? "sine" : "square";
    oscillator.frequency.value = tone === "success" ? 880 : 220;
    gain.gain.value = 0.04;

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (tone === "success" ? 0.08 : 0.16));
    oscillator.onended = () => {
      void context.close();
    };
  }

  function setFeedback(message: string, tone: ScanFeedbackTone) {
    setScanMessage(message);
    setScanTone(tone);
    playFeedbackTone(tone);
  }

  function updateItemQuantity(itemId: string, value: string) {
    resetTimer();
    setItems((current) =>
      current.map((item) =>
        item.id === itemId && !item.isKit
          ? {
              ...item,
              confirmedQuantityValue: value,
            }
          : item,
      ),
    );
  }

  function applyScannedCode(rawValue: string) {
    const normalizedScan = normalizeScanValue(rawValue);

    if (!normalizedScan) {
      setFeedback("Informe ou leia um cÃ³digo para localizar o item.", "error");
      return false;
    }

    const matchedItem = items.find((item) => matchesItemScan(item, normalizedScan));

    if (!matchedItem) {
      setActiveItemId(null);
      setWrongProductScans((current) => current + 1);
      setFeedback("CÃ³digo nÃ£o encontrado neste pedido.", "error");
      return false;
    }

    if (matchedItem.isKit && matchedItem.kitComponents.length > 0) {
      const matchedComponent = findMatchingKitComponent(matchedItem, normalizedScan);

      if (!matchedComponent) {
        setActiveItemId(matchedItem.id);
        setWrongProductScans((current) => current + 1);
        setFeedback(`O kit ${matchedItem.sku} foi localizado, mas o componente lido nÃ£o estÃ¡ mapeado.`, "error");
        return false;
      }

      if (matchedComponent.confirmedQuantity >= matchedComponent.requestedQuantity) {
        setActiveItemId(matchedItem.id);
        setFeedback(
          `O componente ${matchedComponent.sku} jÃ¡ foi totalmente conferido (${matchedComponent.requestedQuantity}/${matchedComponent.requestedQuantity}).`,
          "error",
        );
        return false;
      }

      const nextComponentQuantity = matchedComponent.confirmedQuantity + 1;
      const nextTotalConfirmed = matchedItem.kitComponents.reduce(
        (sum, component) =>
          sum +
          (component.componentProductId === matchedComponent.componentProductId
            ? component.confirmedQuantity + 1
            : component.confirmedQuantity),
        0,
      );

      setItems((current) =>
        current.map((item) =>
          item.id === matchedItem.id
            ? {
                ...item,
                kitComponents: item.kitComponents.map((component) =>
                  component.componentProductId === matchedComponent.componentProductId
                    ? {
                        ...component,
                        confirmedQuantity: component.confirmedQuantity + 1,
                        pendingQuantity: Math.max(
                          component.requestedQuantity - (component.confirmedQuantity + 1),
                          0,
                        ),
                      }
                    : component,
                ),
                confirmedQuantityValue: String(nextTotalConfirmed),
              }
            : item,
        ),
      );

      setActiveItemId(matchedItem.id);
      setFeedback(
        `Kit ${matchedItem.sku}: componente ${matchedComponent.sku} ${nextComponentQuantity}/${matchedComponent.requestedQuantity}. Total conferido: ${nextTotalConfirmed}/${matchedItem.requestedQuantity}.`,
        "success",
      );
    } else {
      const currentConfirmed = normalizeQuantity(matchedItem.confirmedQuantityValue);
      if (currentConfirmed >= matchedItem.requestedQuantity) {
        setActiveItemId(matchedItem.id);
        setFeedback(`O item ${matchedItem.sku} jÃ¡ foi totalmente conferido.`, "error");
        return false;
      }

      const nextConfirmed = Math.min(currentConfirmed + 1, matchedItem.requestedQuantity);

      setItems((current) =>
        current.map((item) =>
          item.id === matchedItem.id
            ? {
                ...item,
                confirmedQuantityValue: String(nextConfirmed),
              }
            : item,
        ),
      );

      setActiveItemId(matchedItem.id);
      setFeedback(
        `ConferÃªncia aplicada em ${matchedItem.sku}. Total conferido: ${nextConfirmed}/${matchedItem.requestedQuantity}.`,
        "success",
      );
    }
    setScanValue("");
    resetTimer();

    requestAnimationFrame(() => {
      quantityInputRefs.current[matchedItem.id]?.focus();
      quantityInputRefs.current[matchedItem.id]?.select();

      if (operatorMode && !cameraEnabled) {
        focusScanInput();
      }
    });

    return true;
  }

  function handleScanSubmit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    applyScannedCode(scanValue);
  }

  function submitConferenceIntent(intent: "release-romaneio" | "release-sem-romaneio") {
    if (!conferenceFormRef.current || !conferenceIntentInputRef.current) {
      return;
    }

    conferenceIntentInputRef.current.value = intent;
    resetTimer();
    setIsSubmitting(true);
    conferenceFormRef.current.requestSubmit();
  }

  return (
    <div className="space-y-6">
      <InactivityWarningDialog
        isVisible={isWarningVisible}
        countdownSeconds={countdownSeconds}
        title="ConferÃªncia pausada por inatividade"
        description="O operador ficou sem interaÃ§Ã£o nesta conferÃªncia. Se a atividade nÃ£o for retomada, o pedido serÃ¡ devolvido automaticamente para a fila."
        mobileDescription="Sem interaÃ§Ã£o na conferÃªncia. Retome agora ou o pedido volta para a fila."
      />

      {feedback ? (
        <div
          className={`rounded-3xl border px-5 py-4 text-sm font-bold shadow-sm ${
            feedback === "concluido"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {feedback === "concluido"
            ? "ConferÃªncia concluÃ­da. Revise os documentos e escolha se o pedido vai para romaneio ou se serÃ¡ liberado sem romaneio."
            : feedback === "incompleto"
              ? "Ainda existem itens pendentes. O pedido permanece na fila para nova conferÃªncia."
              : feedback === "documentos-pendentes"
                ? "Finalize os documentos obrigatÃ³rios (XML da NF e etiqueta de envio) para liberar o pedido ao romaneio."
              : feedback === "inatividade"
                ? "Pedido devolvido para a fila por inatividade do operador."
                : "NÃ£o foi possÃ­vel concluir a operaÃ§Ã£o solicitada."}
        </div>
      ) : null}

      {wrongProductScans > 0 || quantityDivergentItems > 0 ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-5 text-sm shadow-sm dark:text-amber-300">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-amber-500/20 p-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="font-bold text-amber-800 dark:text-amber-400 text-base">Alertas de divergÃªncia na conferÃªncia</p>
              {wrongProductScans > 0 ? (
                <p className="font-medium text-amber-700 dark:text-amber-300">Produto errado lido: <span className="font-bold">{wrongProductScans}</span> ocorrÃªncia(s).</p>
              ) : null}
              {quantityDivergentItems > 0 ? (
                <p className="font-medium text-amber-700 dark:text-amber-300">Itens com divergÃªncia de quantidade: <span className="font-bold">{quantityDivergentItems}</span>.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Header Info Card */}
      <div className="glass-card rounded-3xl p-6 shadow-sm border border-slate-200/50 dark:border-zinc-800/50 transition-all hover:border-primary-500/30">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide border ${
                  order.status === 'SEPARADO' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' : 
                  order.status === 'EM_CONFERENCIA' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}>
                {order.statusLabel}
              </span>
              <span className="rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                {order.depositante}
              </span>
              {pendingUnits > 0 ? (
                <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  Pendentes: {pendingUnits} un
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Pedido conferido
                </span>
              )}
            </div>

            <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{order.displayNumber}</h2>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-zinc-400">
              {order.customer} <span className="px-1 text-slate-300 dark:text-zinc-600">â€¢</span> {order.destination}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-zinc-500">
              <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">Marketplace {order.marketplace}</span>
              <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">CÃ³digo tÃ©cnico {order.code}</span>
              <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">{order.totalItems} item(ns)</span>
              <span className="bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-slate-100 dark:border-zinc-800">{order.totalUnits} unidade(s)</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/50 px-5 py-4 text-sm shadow-sm backdrop-blur-sm min-w-[200px]">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">Conferido</p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">{completionPercent}%</p>
            <p className={`mt-2 text-[11px] font-bold tracking-wide uppercase ${quantityDivergentItems > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {quantityDivergentItems
                ? `${quantityDivergentItems} item(ns) com divergÃªncia`
                : "Sem divergÃªncia de quantidade"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="glass-card rounded-3xl border border-slate-200/50 dark:border-zinc-800/50 p-5 shadow-sm">
            <div className="space-y-2 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Operador respons?vel
              </span>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                {operatorDisplayName}
              </div>
            </div>

            <div className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-zinc-400">
              <InfoMini label="InÃ­cio" value={formatDateTime(order.startedAt) || "Ainda nÃ£o iniciado"} />
              <InfoMini
                label="Ãšltima atualizaÃ§Ã£o"
                value={formatDateTime(order.updatedAt) || "Sem apontamento"}
              />
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-slate-200/50 dark:border-zinc-800/50 p-5 shadow-sm">
            <form onSubmit={handleScanSubmit} className="space-y-3">
              <span className="block text-sm font-bold text-slate-700 dark:text-zinc-300">
                Leitura de cÃ³digo de barras
              </span>
              <div className="flex items-center gap-2 rounded-2xl border-2 border-primary-500/30 bg-white dark:bg-zinc-900 p-2 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all shadow-inner">
                <Barcode className="h-5 w-5 ml-2 text-primary-500" />
                <input
                  ref={scanInputRef}
                  value={scanValue}
                  onChange={(event) => {
                    resetTimer();
                    setScanValue(event.target.value);
                  }}
                  onBlur={() => {
                    if (operatorMode && !cameraEnabled) {
                      window.setTimeout(() => {
                        scanInputRef.current?.focus();
                      }, 40);
                    }
                  }}
                  placeholder="Leia EAN/GTIN ou SKU"
                  className="h-10 w-full border-0 bg-transparent px-2 text-sm font-medium text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 text-sm font-bold text-white dark:text-slate-900 shadow-md transition hover:bg-slate-800 dark:hover:bg-slate-200"
                >
                  <ScanSearch className="h-4 w-4" />
                  Ler
                </button>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 leading-relaxed">
                FaÃ§a a leitura item a item para validar o pedido real antes da expediÃ§Ã£o.
              </p>
              {scanMessage ? (
                <div className={`mt-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                  scanTone === "success" 
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" 
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                }`}>
                  {scanMessage}
                </div>
              ) : null}
            </form>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleCamera}
                disabled={!cameraSupported}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all w-full ${
                  cameraEnabled
                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/20 hover:bg-rose-600"
                    : "bg-primary-500 text-white shadow-md shadow-primary-500/20 hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:text-slate-500"
                }`}
              >
                {cameraEnabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                {cameraStarting
                  ? "Abrindo cÃ¢mera..."
                  : cameraEnabled
                    ? "Desligar cÃ¢mera"
                    : "Ler pela cÃ¢mera"}
              </button>

              <div className="flex w-full gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setOperatorMode((current) => !current)}
                  className={`rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all flex-1 ${
                    operatorMode
                      ? "bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20"
                      : "border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  {operatorMode ? "Modo operador" : "Ativar operador"}
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled((current) => !current)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all flex-1 ${
                    soundEnabled
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                      : "border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  <Volume2 className="h-4 w-4" />
                  {soundEnabled ? "Som ativo" : "Ativar som"}
                </button>
              </div>

              <button
                type="button"
                onClick={focusScanInput}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-zinc-300 transition-all hover:bg-slate-50 dark:hover:bg-zinc-700 mt-1"
              >
                <Focus className="h-4 w-4" />
                Focar leitura
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-950">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`aspect-video w-full object-cover transition ${
                  cameraEnabled || cameraStarting ? "opacity-100" : "opacity-35"
                }`}
              />
            </div>

            <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-zinc-500">
              {cameraMessage ??
                (cameraSupported
                  ? "CompatÃ­vel com celular e notebook. Abra a cÃ¢mera e escaneie o EAN/GTIN do item."
                  : "Seu navegador atual nÃ£o liberou leitura por cÃ¢mera. O leitor USB e o campo manual continuam disponÃ­veis.")}
            </p>
          </div>
        </div>

        <div className="space-y-5">
        <form
          id="shipping-conference-form"
          ref={conferenceFormRef}
          action={saveShippingConferenceAction}
          className="space-y-5"
          aria-busy={isSubmitting}
          onSubmit={() => {
            resetTimer();
            setIsSubmitting(true);
          }}
        >
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="operatorId" value={selectedOperatorId} />
          <input type="hidden" name="wrongProductScans" value={String(wrongProductScans)} />
          <input type="hidden" name="redirectBase" value={redirectBase} />
          <input ref={conferenceIntentInputRef} type="hidden" name="intent" defaultValue="save" />
          <input
            type="hidden"
            name="completeRedirectTo"
            value={`/expedicao/conferencia/${order.id}?feedback=concluido#documentos-impressao`}
          />

          <div className="overflow-x-auto rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/65 backdrop-blur-md shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-5 py-4 font-bold text-slate-600 dark:text-zinc-300">SKU / produto</th>
                  <th className="px-5 py-4 font-bold text-slate-600 dark:text-zinc-300">Pedido</th>
                  <th className="px-5 py-4 font-bold text-slate-600 dark:text-zinc-300">Separado</th>
                  <th className="px-5 py-4 font-bold text-slate-600 dark:text-zinc-300">Conferido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {items.map((item) => {
                  const isCurrentItem = activeItemId === item.id;
                  const confirmedQty = normalizeQuantity(item.confirmedQuantityValue);
                  const isDivergent = confirmedQty !== item.requestedQuantity;
                  
                  return (
                  <tr
                    key={item.id}
                    className={`align-top transition-colors ${
                      isCurrentItem ? "bg-primary-500/5" : "hover:bg-slate-50/50 dark:hover:bg-zinc-800/30"
                    }`}
                  >
                    <td className="px-5 py-5 text-slate-900 dark:text-white">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="itemKitProgress" value={serializeKitProgress(item)} />
                      <div className="font-bold text-base mb-1">
                        {item.sku}
                      </div>
                      <div className="font-medium text-sm text-slate-600 dark:text-zinc-400">
                        {item.name}
                      </div>
                      <div className="mt-2 text-xs font-medium text-slate-500 dark:text-zinc-500">
                        Cod. {item.code} <span className="px-1">â€¢</span> Ref. {item.externalReference || "-"}
                      </div>
                      <div className="mt-4 inline-block rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 px-4 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                          EAN/GTIN esperado
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                          {item.barcode || "-"}
                        </p>
                      </div>
                      {item.isKit && item.kitComponents.length ? (
                        <div className="mt-3 space-y-2">
                          {item.kitComponents.map((component) => (
                            <div
                              key={`${item.id}-${component.componentProductId}`}
                              className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2"
                            >
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{component.sku}</p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                                GTIN {component.barcode || "-"} â€¢ {component.confirmedQuantity}/{component.requestedQuantity}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-5">
                      <span className="rounded-xl bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 text-sm font-bold text-slate-700 dark:text-zinc-300">
                        {item.requestedQuantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <span className="rounded-xl bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 text-sm font-bold text-slate-700 dark:text-zinc-300">
                        {item.separatedQuantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      {isDivergent ? (
                        <div className="mb-3 inline-flex items-center rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                          DivergÃªncia
                        </div>
                      ) : null}
                      <input
                        ref={(element) => {
                          quantityInputRefs.current[item.id] = element;
                        }}
                        type="number"
                        name="confirmedQuantity"
                        min={0}
                        max={item.requestedQuantity}
                        step={1}
                        value={item.confirmedQuantityValue}
                        onChange={(event) => updateItemQuantity(item.id, event.target.value)}
                        readOnly={item.isKit}
                        className={`h-11 w-28 rounded-xl border px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/50 transition-all block ${
                          isCurrentItem ? "border-primary-500/40 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white" : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white"
                        }`}
                      />
                      {Math.max(item.requestedQuantity - confirmedQty, 0) > 0 ? (
                        <p className="mt-3 text-xs font-bold text-amber-600 dark:text-amber-400">
                          Faltam {Math.max(item.requestedQuantity - confirmedQty, 0)} {item.unit}.
                        </p>
                      ) : (
                        <p className="mt-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">Item conferido.</p>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 p-5 shadow-xl backdrop-blur-xl transition-all">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-xl bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 font-bold text-primary-700 dark:text-primary-400">
                {completionPercent}% conferido
              </span>
              <span className="rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 font-semibold text-slate-700 dark:text-zinc-300">
                {pendingUnits} unidade(s) pendente(s)
              </span>
            </div>

            <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-infinya-gradient transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-zinc-500">
              <span>Ao atingir 100%, a conferência fica pronta para destinação. O pedido só fecha quando o operador liberar com ou sem romaneio.</span>
              {isSubmitting ? <span className="font-bold text-primary-600 dark:text-primary-400">Processando ação...</span> : null}
            </div>
          </div>
        </form>

        <ShippingConferenceDocumentsPanel
          orderId={documents.orderId}
          depositanteId={documents.depositanteId}
          attachments={documents.attachments}
          canUploadAttachments={documents.canUploadAttachments}
          unlocked={pendingUnits <= 0}
          onSubmitIntent={submitConferenceIntent}
        />
        </div>
      </div>
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">{label}</p>
      <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeScanValue(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

function normalizeQuantity(value: string) {
  const numeric = Number(value.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, numeric);
}

function matchesItemScan(item: ConferenceItemState, normalizedScan: string) {
  return item.scanTargets
    .filter(Boolean)
    .some((value) => normalizeScanValue(value) === normalizedScan);
}

function findMatchingKitComponent(item: ConferenceItemState, normalizedScan: string) {
  return item.kitComponents.find((component) =>
    [component.barcode, component.sku]
      .filter(Boolean)
      .some((value) => normalizeScanValue(value) === normalizedScan),
  );
}

function serializeKitProgress(item: ConferenceItemState) {
  if (!item.isKit || item.kitComponents.length === 0) {
    return "";
  }

  return JSON.stringify(
    item.kitComponents.map((component) => ({
      componentProductId: component.componentProductId,
      quantityPerKit: component.quantityPerKit,
      separatedQuantity: component.confirmedQuantity,
      sku: component.sku,
      name: component.name,
      barcode: component.barcode,
    })),
  );
}

