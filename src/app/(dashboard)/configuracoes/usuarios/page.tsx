import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { listUsersOverview } from "@/lib/wms-data";

export default function ConfiguracoesUsuariosPage() {
  const usersOverview = listUsersOverview();

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
        title="Usuários"
        description="Controle de acesso por papel, status e depositante vinculado."
        badge="Cadastro mestre"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Nome</th>
                <th className="pb-3 font-medium">E-mail</th>
                <th className="pb-3 font-medium">Papel</th>
                <th className="pb-3 font-medium">Depositante</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {usersOverview.map((item) => (
                <tr key={item.email} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="py-3 text-slate-600">{item.email}</td>
                  <td className="py-3 text-slate-600">{item.role}</td>
                  <td className="py-3 text-slate-600">{item.depositante}</td>
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
    </div>
  );
}
