import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { listRouteLoads } from "@/lib/wms-data";

export default function RomaneioPage() {
  const routeLoads = listRouteLoads();

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Romaneio"
        description="Agrupamento por transportadora, roteirizacao operacional e despacho."
        badge="MVP"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Cargas previstas</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {routeLoads.map((load) => (
            <div key={`${load.carrier}-${load.route}`} className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-950">{load.carrier}</p>
              <p className="mt-1 text-sm text-slate-600">{load.route}</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">{load.orders} pedidos</span>
                <span className="font-medium text-slate-900">Cutoff {load.cutoff}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
