"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, X } from "lucide-react";
import {
  ReturnInvoiceForm,
  type ReturnInvoiceExpectedItem,
} from "@/components/shipping/shipping-return-invoice-form";

/**
 * Anexo da NF-e de devolução direto da lista de expedição, sem precisar
 * navegar até a página do pedido. A validação acontece aqui mesmo: se a
 * nota divergir, o erro aparece no próprio modal e o pedido segue bloqueado.
 */
export function ShippingReturnInvoiceModal({
  orderId,
  orderNumber,
  items,
  onClose,
}: {
  orderId: string;
  orderNumber: string;
  items: ReturnInvoiceExpectedItem[];
  onClose: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSuccess = useCallback(() => {
    // Deixa a mensagem de sucesso visível por um instante antes de fechar,
    // e recarrega a lista para o pedido sair de "Aguardando".
    const timer = setTimeout(() => {
      router.refresh();
      onClose();
    }, 1400);
    return () => clearTimeout(timer);
  }, [router, onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Anexar NF-e de devolução"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <div className="relative flex max-h-full w-full max-w-xl flex-col overflow-auto rounded-3xl border-2 border-amber-300 bg-amber-50/95 p-6 shadow-2xl dark:border-amber-400/30 dark:bg-[#0c1424]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-extrabold tracking-[0.13em] text-amber-600 dark:text-amber-300">
                DEVOLUÇÃO AO CLIENTE
              </p>
              <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                Anexar NF-e de devolução
              </h2>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                Pedido {orderNumber} · a nota precisa bater exatamente com os itens abaixo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-px hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ReturnInvoiceForm orderId={orderId} items={items} onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
