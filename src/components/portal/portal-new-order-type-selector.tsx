"use client";

import { PackageCheck, Truck, X } from "lucide-react";

export type PortalNewOrderType = "EXPEDICAO" | "RETIRADA";

export function PortalNewOrderTypeSelector({
  onChoose,
  onClose,
}: {
  onChoose: (type: PortalNewOrderType) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[85] grid place-items-center px-4" role="dialog" aria-modal="true" aria-label="Tipo de pedido">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 bg-slate-900/55 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0c1424]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-[0.13em] text-slate-500 dark:text-slate-400">NOVO PEDIDO</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">Escolha o tipo</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Selecione o que voce deseja registrar.</p>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChoose("EXPEDICAO")}
            className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition hover:-translate-y-px hover:border-violet-400 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-md">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <strong className="block text-sm font-extrabold text-slate-950 dark:text-white">Expedicao</strong>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Pedido de venda ao consumidor final. NF-e emitida pelo depositante.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChoose("RETIRADA")}
            className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition hover:-translate-y-px hover:border-amber-400 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md">
              <PackageCheck className="h-5 w-5" />
            </span>
            <div>
              <strong className="block text-sm font-extrabold text-slate-950 dark:text-white">Retirada de mercadoria</strong>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Devolucao ao depositante. NF-e de devolucao emitida pelo armazem.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
