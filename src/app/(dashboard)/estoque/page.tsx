import { Archive, Boxes, ClipboardCheck, ShieldAlert } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  listStockBalances,
  listStockMovements,
  listStockStats,
} from "@/lib/wms-data";

export default function EstoquePage() {
  const stockStats = listStockStats();
  const stockBalances = listStockBalances();
  const stockMovements = listStockMovements();

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Estoque"
        description="Endereçamento, saldos, lote, validade, movimentações e inventário do WMS."
        badge="Core"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Boxes} label={stockStats[0].label} value={stockStats[0].value} help={stockStats[0].help} />
        <StatCard icon={ShieldAlert} label={stockStats[1].label} value={stockStats[1].value} help={stockStats[1].help} />
        <StatCard icon={Archive} label={stockStats[2].label} value={stockStats[2].value} help={stockStats[2].help} />
        <StatCard icon={ClipboardCheck} label={stockStats[3].label} value={stockStats[3].value} help={stockStats[3].help} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Saldos monitorados</h2>
          <p className="mt-1 text-sm text-slate-600">
            Recorte inicial para visibilidade de lote, endereço e bloqueios.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">SKU</th>
                  <th className="pb-3 font-medium">Depositante</th>
                  <th className="pb-3 font-medium">Endereço</th>
                  <th className="pb-3 font-medium">Lote</th>
                  <th className="pb-3 font-medium">Saldo</th>
                  <th className="pb-3 font-medium">Validade</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stockBalances.map((item) => (
                  <tr key={`${item.sku}-${item.lote}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 font-medium text-slate-900">{item.sku}</td>
                    <td className="py-3 text-slate-600">{item.depositante}</td>
                    <td className="py-3 text-slate-600">{item.endereco}</td>
                    <td className="py-3 text-slate-600">{item.lote}</td>
                    <td className="py-3 text-slate-600">{item.saldo}</td>
                    <td className="py-3 text-slate-600">{item.validade}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Movimentos base</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {stockMovements.map((item) => (
              <li key={item} className="rounded-xl bg-slate-50 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
