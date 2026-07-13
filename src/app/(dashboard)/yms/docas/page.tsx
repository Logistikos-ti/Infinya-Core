import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Truck } from "lucide-react";

export default function DocasPage() {
  const docas = [
    { id: "D1", name: "Doca 01", status: "Livre", type: "Mista" },
    { id: "D2", name: "Doca 02", status: "Livre", type: "Mista" },
    { id: "D3", name: "Doca 03", status: "Livre", type: "Recebimento" },
    { id: "D4", name: "Doca 04", status: "Livre", type: "Expedição" },
  ];

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Painel de Docas"
        description="Controle em tempo real de ocupação e operações nas docas."
        badge="YMS"
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {docas.map((doca) => (
          <div
            key={doca.id}
            className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {doca.name}
                </h3>
                <p className="text-xs font-medium text-slate-500">{doca.type}</p>
              </div>
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                {doca.status}
              </span>
            </div>
            
            <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 dark:border-zinc-800 dark:bg-zinc-950/50">
              <Truck className="mb-2 h-8 w-8 text-slate-300 dark:text-zinc-700" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Doca Livre</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
