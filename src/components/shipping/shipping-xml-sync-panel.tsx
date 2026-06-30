"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

type ShippingXmlSyncPanelProps = {
  orderId: string;
  xmlPending: boolean;
  isBlingOrder: boolean;
};

const autoRefreshIntervalMs = 5 * 60 * 1000;

export function ShippingXmlSyncPanel({
  orderId,
  xmlPending,
  isBlingOrder,
}: ShippingXmlSyncPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const shouldPoll = useMemo(() => isBlingOrder && xmlPending, [isBlingOrder, xmlPending]);

  const syncNow = useCallback(
    async (source: "manual" | "auto") => {
      if (!shouldPoll && source === "auto") {
        return;
      }

      try {
        const response = await fetch(`/api/expedicao/${orderId}/sincronizar-xml`, {
          method: "POST",
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          message?: string;
          error?: string;
        };

        setMessage(payload.message ?? payload.error ?? "Sincronização concluída.");

        startTransition(() => {
          router.refresh();
        });
      } catch {
        setMessage("Não foi possível sincronizar o XML agora.");
      }
    },
    [orderId, router, shouldPoll, startTransition],
  );

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void syncNow("auto");
    }, autoRefreshIntervalMs);

    return () => window.clearInterval(timer);
  }, [shouldPoll, syncNow]);

  if (!isBlingOrder) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Sincronização do XML via Bling
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {xmlPending
              ? "Enquanto o XML estiver pendente, o WMS tenta atualizar este pedido automaticamente a cada 5 minutos."
              : "O XML já está anexado. Você ainda pode forçar uma nova conferência se precisar."}
          </p>
          {message ? <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{message}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void syncNow("manual")}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          Atualizar agora
        </button>
      </div>
    </div>
  );
}
