import { ScanSearch } from "lucide-react";

export default function ShippingConferenceRootPage() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50">
          <ScanSearch className="h-10 w-10 text-slate-400 dark:text-zinc-500" />
        </div>
        <h1 className="font-sans text-xl font-bold text-slate-900 dark:text-white">
          Aguardando seleção
        </h1>
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
          Selecione um pedido na fila lateral para iniciar a conferência, ou utilize o campo de busca.
        </p>
      </div>
    </div>
  );
}
