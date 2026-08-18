"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, Package, Camera, Trash2, X, Loader2 } from "lucide-react";
import { discardPortalQuarantine } from "@/app/(portal)/portal/quarantine-actions";

export function QuarantineViewClient({
  quarantine,
}: {
  quarantine: any[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const activeItems = quarantine.filter((item) => item.status === "EM_QUARENTENA");
  const releasedItems = quarantine.filter((item) => item.status === "LIBERADO");
  const discardedItems = quarantine.filter((item) => item.status === "DESCARTADO");
  const activeUnits = activeItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

  function handleDiscard(id: string) {
    if (confirm("Tem certeza que deseja autorizar o descarte deste produto? Esta ação não pode ser desfeita e o saldo será baixado definitivamente.")) {
      startTransition(async () => {
        const result = await discardPortalQuarantine(id);
        if (result.error) alert(result.error);
      });
    }
  }

  function getTipoLabel(tipo: string) {
    if (tipo === "AVARIA") return "Avaria";
    if (tipo === "RECEBIMENTO") return "Recebimento";
    return "Outro";
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="font-display text-[27px] font-bold tracking-tight text-slate-950 dark:text-white">
            Quarentena
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Produtos retidos por avaria, divergência ou análise operacional antes de voltarem ao estoque disponível.
          </p>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/30 dark:bg-amber-500/5">
          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">Em quarentena</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-display text-3xl font-bold text-amber-900 dark:text-amber-100">{activeItems.length}</span>
            <span className="mb-1 text-sm text-amber-600 dark:text-amber-500">{activeUnits.toLocaleString("pt-BR")} un retidas</span>
          </div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/30 dark:bg-rose-500/5">
          <div className="text-sm font-bold text-rose-700 dark:text-rose-400">Descartados</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-display text-3xl font-bold text-rose-900 dark:text-rose-100">{discardedItems.length}</span>
            <span className="mb-1 text-sm text-rose-600 dark:text-rose-500">Baixa definitiva</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
              Itens retidos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhe o que está indisponível para separação e expedição.
            </p>
          </div>
          <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">
            {quarantine.length} registro(s)
          </span>
        </div>
        {quarantine.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="text-[12px] uppercase tracking-[0.04em] text-slate-500 dark:text-slate-400">
                <tr>
                  {[
                    "Produto",
                    "Tipo",
                    "Quantidade",
                    "Status",
                    "Ações",
                  ].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-5 py-3 font-bold dark:border-white/10 dark:bg-white/5"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quarantine.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-100 last:border-b-0 dark:border-white/10"
                  >
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/10">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.sku}
                            {item.internalCode ? " · " + item.internalCode : ""}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-xs">
                            {item.reason}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {getTipoLabel(item.tipo)}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-950 dark:text-white">
                      {item.quantityLabel} un
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ${item.status === "EM_QUARENTENA" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : item.status === "DESCARTADO" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                        {item.statusLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {item.fotoUrl && (
                          <button
                            onClick={() => setSelectedPhoto(item.fotoUrl)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
                            title="Ver foto"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                        )}
                        {item.status === "EM_QUARENTENA" && (
                          <button
                            onClick={() => handleDiscard(item.id)}
                            disabled={isPending}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                            title="Descartar produto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Descartar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum item em quarentena no momento.
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 px-4 py-3">
              <h3 className="font-bold text-slate-900 dark:text-white">Foto da Ocorrência</h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-slate-100 dark:bg-slate-950 p-4 flex justify-center">
              <img src={selectedPhoto} alt="Avaria" className="max-h-[70vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
