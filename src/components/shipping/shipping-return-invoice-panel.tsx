"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle, Lock } from "lucide-react";
import {
  uploadReturnInvoiceAction,
  type UploadReturnInvoiceState,
} from "@/app/(dashboard)/expedicao/return-invoice-action";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-rose-500/20 transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-50"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
      {pending ? "Validando NF-e..." : "Enviar e validar NF-e"}
    </button>
  );
}

export function ShippingReturnInvoicePanel({
  orderId,
  items,
}: {
  orderId: string;
  items: Array<{ code: string; name: string; quantity: string }>;
}) {
  const [state, formAction] = useActionState<UploadReturnInvoiceState, FormData>(uploadReturnInvoiceAction, {
    status: "idle",
  });

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

      <div className="mb-4 overflow-hidden rounded-xl border border-amber-200 bg-white dark:border-white/10 dark:bg-white/5">
        <table className="w-full text-left text-xs">
          <thead className="bg-amber-100/60 text-[11px] font-extrabold uppercase tracking-wide text-amber-800 dark:bg-white/5 dark:text-amber-200">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2 text-right">Qtd. esperada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100 dark:divide-white/5">
            {items.map((item) => (
              <tr key={`${item.code}-${item.name}`}>
                <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{item.code}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{item.name}</td>
                <td className="px-3 py-2 text-right font-extrabold text-slate-900 dark:text-white">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.status === "error" ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <strong className="block font-extrabold">NF-e recusada</strong>
            {state.divergences?.length ? (
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {state.divergences.map((divergence) => (
                  <li key={`${divergence.kind}-${divergence.code}`}>
                    <span className="font-semibold">{divergence.name}</span> ({divergence.code}):{" "}
                    {divergence.kind === "FALTANDO_NA_NF"
                      ? `esperado ${divergence.expected}, ausente na NF-e`
                      : divergence.kind === "SOBRANDO_NA_NF"
                        ? `${divergence.found} na NF-e, mas não consta no pedido`
                        : `esperado ${divergence.expected}, NF-e traz ${divergence.found}`}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 whitespace-pre-line">{state.detail}</p>
            )}
          </div>
        </div>
      ) : null}

      {state.status === "success" ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.detail}</p>
        </div>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="orderId" value={orderId} />
        <label className="flex h-11 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:-translate-y-px dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          <FileUp className="h-4 w-4 text-amber-600" />
          Selecionar XML da NF-e de devolução
          <input type="file" name="returnInvoiceXml" required accept=".xml,application/xml,text/xml" className="hidden" />
        </label>
        <SubmitButton />
      </form>
    </section>
  );
}
