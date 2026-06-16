import { Activity, AlertTriangle, PackageCheck, Truck } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireModuleAccess } from "@/lib/auth";
import { filterItemsByUserDepositante, isScopedDepositanteUser } from "@/lib/tenant-scope";
import {
  listShippingFlow,
  listShippingQueues,
  listShippingStats,
} from "@/lib/wms-data";

export default async function ExpedicaoPage() {
  const user = await requireModuleAccess("expedicao");

  const shippingStats = listShippingStats();
  const shippingQueues = filterItemsByUserDepositante(
    user,
    listShippingQueues(),
    () => user.depositanteNome,
  );
  const shippingFlow = listShippingFlow();
  const shippingStatsCards = isScopedDepositanteUser(user)
    ? [
        {
          label: "Filas visíveis",
          value: String(shippingQueues.length),
          help: "Filas acessíveis no escopo do seu depositante.",
        },
        {
          label: "Pedidos nas filas",
          value: String(shippingQueues.reduce((sum, item) => sum + item.orders, 0)),
          help: "Pedidos mapeados nas filas do seu ambiente.",
        },
        {
          label: "Integrações com atenção",
          value: String(shippingQueues.length),
          help: "Canais monitorados na sua operação.",
        },
        {
          label: "Etapas do fluxo",
          value: String(shippingFlow.length),
          help: "Fluxo operacional obrigatório para expedição.",
        },
      ]
    : shippingStats;

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Expedição"
        description="Separação, conferência, romaneio, integração com Bling e marketplaces."
        badge="Crítico"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Truck} label={shippingStatsCards[0].label} value={shippingStatsCards[0].value} help={shippingStatsCards[0].help} />
        <StatCard icon={PackageCheck} label={shippingStatsCards[1].label} value={shippingStatsCards[1].value} help={shippingStatsCards[1].help} />
        <StatCard icon={AlertTriangle} label={shippingStatsCards[2].label} value={shippingStatsCards[2].value} help={shippingStatsCards[2].help} />
        <StatCard icon={Activity} label={shippingStatsCards[3].label} value={shippingStatsCards[3].value} help={shippingStatsCards[3].help} />
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
            {!shippingQueues.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Nenhuma fila operacional disponível para o seu depositante.
              </div>
            ) : null}
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
