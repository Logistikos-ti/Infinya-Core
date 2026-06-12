import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { listReportsCatalog } from "@/lib/wms-data";

export default function RelatoriosPage() {
  const reportsCatalog = listReportsCatalog();

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Relatórios"
        description="Saldo, produtividade, SLA, rastreabilidade e exportações."
        badge="Planejado"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Catálogo inicial</h2>
        <p className="mt-1 text-sm text-slate-600">
          Aqui vamos consolidar métricas operacionais e a integração com o módulo
          financeiro que já está em produção.
        </p>

        <div className="mt-5 grid gap-3">
          {reportsCatalog.map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
