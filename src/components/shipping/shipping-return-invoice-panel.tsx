"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import {
  ReturnInvoiceForm,
  type ReturnInvoiceExpectedItem,
} from "@/components/shipping/shipping-return-invoice-form";

/**
 * Versão em página do anexo da NF-e de devolução, exibida no topo de
 * /expedicao/[id] enquanto a retirada está bloqueada.
 *
 * O caminho principal do operador é o modal aberto direto da lista de
 * expedição (ShippingReturnInvoiceModal). Este painel continua existindo
 * para quem chega ao pedido por link ou busca, para não virar um beco sem
 * saída — os dois compartilham o mesmo ReturnInvoiceForm.
 */
export function ShippingReturnInvoicePanel({
  orderId,
  items,
}: {
  orderId: string;
  items: ReturnInvoiceExpectedItem[];
}) {
  const router = useRouter();

  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5 dark:border-amber-400/30 dark:bg-amber-400/5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-extrabold text-slate-950 dark:text-white">Devolução ao cliente</h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Este pedido está bloqueado para separação e conferência. Anexe o XML da NF-e de devolução emitida pelo
            armazém para liberar a operação.
          </p>
        </div>
      </div>

      <ReturnInvoiceForm orderId={orderId} items={items} onSuccess={() => router.refresh()} />
    </section>
  );
}
