import { Activity, AlertTriangle, PackageCheck, Truck } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  listShippingFlow,
  listShippingQueues,
  listShippingStats,
} from "@/lib/wms-data";

export default function ExpedicaoPage() {
  const shippingStats = listShippingStats();
  const shippingQueues = listShippingQueues();
  const shippingFlow = listShippingFlow();

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Expedição"
        description="Separação, conferência, romaneio, integração com Bling e marketplaces."
        badge="Crítico"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Truck} label={shippingStats[0].label} value={shippingStats[0].value} help={shippingStats[0].help} />
        <StatCard icon={PackageCheck} label={shippingStats[1].label} value={shippingStats[1].value} help={shippingStats[1].help} />
        <StatCard icon={AlertTriangle} label={shippingStats[2].label} value={shippingStats[2].value} help={shippingStats[2].help} />
        <StatCard icon={Activity} label={shippingStats[3].label} value={shippingStats[3].value} help={shippingStats[3].help} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Filas e integrações</h2>
          <div className="mt-5 space-y-4">
            {shippingQueues.map((queue) => (
              <div key={queue.channel} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{queue.channel}</p>
                    <p className="mt-1 text-sm text-slate-600">{queue.issue}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {queue.orders} pedidos
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-500">{queue.action}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Fluxo obrigatório</h2>
          <div className="mt-4 space-y-3">
            {shippingFlow.map((step, index) => (
              <div key={step} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {index + 1}. {step}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
