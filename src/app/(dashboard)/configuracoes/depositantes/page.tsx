import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { listDepositantesResumo } from "@/lib/wms-data";

export default function ConfiguracoesDepositantesPage() {
  const depositantesResumo = listDepositantesResumo();

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para configurações
      </Link>

      <ModulePageHeader
        title="Depositantes"
        description="Cadastro base dos clientes operados dentro do WMS próprio."
        badge="Cadastro mestre"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Nome</th>
                <th className="pb-3 font-medium">SKUs</th>
                <th className="pb-3 font-medium">Endereços</th>
                <th className="pb-3 font-medium">Método padrão</th>
              </tr>
            </thead>
            <tbody>
              {depositantesResumo.map((item) => (
                <tr key={item.name} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="py-3 text-slate-600">{item.skus}</td>
                  <td className="py-3 text-slate-600">{item.addresses}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {item.method}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
