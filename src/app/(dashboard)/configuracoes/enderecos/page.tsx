import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { listAddressBlueprint } from "@/lib/wms-data";

export default function ConfiguracoesEnderecosPage() {
  const addressBlueprint = listAddressBlueprint();

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
        title="Endereços"
        description="Mapa inicial de doca, pulmão, picking, bloqueado e expedição."
        badge="Cadastro mestre"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                  <th className="pb-3 font-medium">Código</th>
                  <th className="pb-3 font-medium">Área</th>
                <th className="pb-3 font-medium">Capacidade</th>
              </tr>
            </thead>
            <tbody>
              {addressBlueprint.map((item) => (
                <tr key={item.code} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-3 font-medium text-slate-900">{item.code}</td>
                  <td className="py-3 text-slate-600">{item.area}</td>
                  <td className="py-3 text-slate-600">{item.capacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
