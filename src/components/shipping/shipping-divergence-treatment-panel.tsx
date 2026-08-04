"use client";

import { useState, useTransition } from "react";
import { 
  AlertTriangle, 
  RotateCcw, 
  ScanBarcode, 
  XCircle, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  ShieldAlert,
  Boxes
} from "lucide-react";
import { resolveShippingOrderDivergenceAction } from "@/app/(dashboard)/expedicao/actions";

type ShippingDivergenceTreatmentPanelProps = {
  orderId: string;
  orderNumber: string;
  divergenceReason: string;
  reportedBy?: string | null;
  status: string;
};

type ActionType = "REABRIR_SEPARACAO" | "REINICIAR_CONFERENCIA" | "CANCELAR_DEFINITIVO" | null;

export function ShippingDivergenceTreatmentPanel({
  orderId,
  orderNumber,
  divergenceReason,
  reportedBy,
  status,
}: ShippingDivergenceTreatmentPanelProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleConfirm = (formData: FormData) => {
    startTransition(async () => {
      await resolveShippingOrderDivergenceAction(formData);
    });
  };

  const getActionDetails = () => {
    switch (selectedAction) {
      case "REABRIR_SEPARACAO":
        return {
          title: "Reabrir para Separação / Picking",
          description: "O pedido voltará para a fila de separação. As quantidades separadas serão reiniciadas para que o operador colete os itens novamente no estoque.",
          buttonText: "Confirmar e Enviar para Separação",
          buttonColor: "bg-amber-600 hover:bg-amber-700 text-white",
          icon: <Boxes className="h-5 w-5 text-amber-500" />,
        };
      case "REINICIAR_CONFERENCIA":
        return {
          title: "Reiniciar Mesa de Conferência",
          description: "O pedido será enviado diretamente para a mesa de conferência para ser bipado novamente pelo operador.",
          buttonText: "Confirmar e Abrir Conferência",
          buttonColor: "bg-purple-600 hover:bg-purple-700 text-white",
          icon: <ScanBarcode className="h-5 w-5 text-purple-500" />,
        };
      case "CANCELAR_DEFINITIVO":
        return {
          title: "Confirmar Cancelamento Definitivo",
          description: "O pedido permanecerá cancelado e será marcado como tratado. Não haverá novas tentativas de separação ou conferência.",
          buttonText: "Confirmar Cancelamento Definitivo",
          buttonColor: "bg-rose-600 hover:bg-rose-700 text-white",
          icon: <XCircle className="h-5 w-5 text-rose-500" />,
        };
      default:
        return null;
    }
  };

  const actionDetails = getActionDetails();

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-sm dark:border-amber-500/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Tratamento de Divergência
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                Status atual: <strong className="text-slate-800 dark:text-zinc-200">{status}</strong>
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {divergenceReason}
            </h3>
            {reportedBy ? (
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Registrado por: <strong className="text-slate-900 dark:text-zinc-200">{reportedBy}</strong>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action Selection Buttons */}
      <div className="mt-6 border-t border-amber-500/20 pt-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          Escolha uma ação para tratar este pedido:
        </h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setSelectedAction("REABRIR_SEPARACAO")}
            className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-white/80 p-4 text-left shadow-sm transition hover:border-amber-500 hover:bg-amber-50 dark:bg-zinc-900/80 dark:hover:bg-amber-950/20"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Boxes className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm dark:text-white">
                Reabrir Separação
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Zera a separação e devolve o pedido para a fila de picking no armazém.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAction("REINICIAR_CONFERENCIA")}
            className="flex flex-col items-start justify-between gap-3 rounded-xl border border-purple-500/30 bg-white/80 p-4 text-left shadow-sm transition hover:border-purple-500 hover:bg-purple-50 dark:bg-zinc-900/80 dark:hover:bg-purple-950/20"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <ScanBarcode className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm dark:text-white">
                Reiniciar Conferência
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Mantém a separação e abre novamente a mesa de conferência para bipagem.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAction("CANCELAR_DEFINITIVO")}
            className="flex flex-col items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-white/80 p-4 text-left shadow-sm transition hover:border-rose-500 hover:bg-rose-50 dark:bg-zinc-900/80 dark:hover:bg-rose-950/20"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <XCircle className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm dark:text-white">
                Cancelar Definitivo
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Encerra o pedido como cancelado definitivamente sem reabertura.
            </p>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {selectedAction && actionDetails ? (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800">
                {actionDetails.icon}
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {actionDetails.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Pedido: <strong>{orderNumber}</strong>
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
              {actionDetails.description}
            </p>

            <form action={handleConfirm} className="mt-5 space-y-4">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="resolutionType" value={selectedAction} />

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Observações do Tratamento (Opcional):
                </label>
                <textarea
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Estoque ajustado, item reposto na prateleira pelo supervisor..."
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setSelectedAction(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-50 ${actionDetails.buttonColor}`}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      {actionDetails.buttonText}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
