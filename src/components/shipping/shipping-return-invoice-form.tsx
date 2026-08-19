"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, FileCheck2, FileUp, LoaderCircle } from "lucide-react";
import {
  uploadReturnInvoiceAction,
  type UploadReturnInvoiceState,
} from "@/app/(dashboard)/expedicao/return-invoice-action";

export type ReturnInvoiceExpectedItem = {
  code: string;
  name: string;
  quantity: string;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-rose-500/20 transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-50"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
      {pending ? "Validando NF-e..." : "Enviar e validar NF-e"}
    </button>
  );
}

/**
 * Núcleo do anexo da NF-e de devolução: tabela do que é esperado, upload do
 * XML e retorno da validação. Fica isolado aqui porque é usado em dois
 * lugares — no modal aberto a partir da lista de expedição e no painel da
 * página de detalhe do pedido.
 */
export function ReturnInvoiceForm({
  orderId,
  items,
  onSuccess,
}: {
  orderId: string;
  items: ReturnInvoiceExpectedItem[];
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState<UploadReturnInvoiceState, FormData>(uploadReturnInvoiceAction, {
    status: "idle",
  });
  // O input de arquivo fica escondido dentro do label, entao sem guardar o
  // nome aqui a tela nao dava nenhum sinal de que o XML foi selecionado.
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "success") onSuccess?.();
  }, [state.status, onSuccess]);

  return (
    <>
      <div className="mb-4 max-h-56 overflow-auto rounded-xl border border-amber-200 bg-white dark:border-white/10 dark:bg-white/5">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-amber-100/80 text-[11px] font-extrabold uppercase tracking-wide text-amber-800 backdrop-blur dark:bg-[#2a1810] dark:text-amber-200">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Produto</th>
              <th className="px-3 py-2 text-right">Qtd. esperada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100 dark:divide-white/5">
            {items.map((item, index) => (
              <tr key={`${item.code}-${item.name}-${index}`}>
                <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{item.code || "—"}</td>
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
            <p className="mt-1.5 text-xs opacity-80">
              O pedido segue bloqueado. Corrija a nota no emissor e envie novamente.
            </p>
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
        <label
          className={`flex h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm font-bold transition hover:-translate-y-px ${
            fileName
              ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-amber-300 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          }`}
        >
          {fileName ? (
            <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <FileUp className="h-4 w-4 shrink-0 text-amber-600" />
          )}
          <span className="truncate">{fileName ?? "Selecionar XML da NF-e de devolução"}</span>
          {fileName ? (
            <span className="ml-auto shrink-0 text-xs font-extrabold uppercase tracking-wide opacity-70">
              Trocar
            </span>
          ) : null}
          <input
            type="file"
            name="returnInvoiceXml"
            required
            accept=".xml,application/xml,text/xml"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            className="hidden"
          />
        </label>
        <SubmitButton disabled={!fileName} />
      </form>
    </>
  );
}
