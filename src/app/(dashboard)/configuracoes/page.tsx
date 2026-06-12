import Link from "next/link";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import {
  listAddressBlueprint,
  listConfigModules,
  listDepositantesResumo,
  listProductChecklist,
} from "@/lib/wms-data";

export default function ConfiguracoesPage() {
  const depositantesResumo = listDepositantesResumo();
  const configModules = listConfigModules();
  const addressBlueprint = listAddressBlueprint();
  const productChecklist = listProductChecklist();

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Configurações"
        description="Cadastros mestres do WMS: depositantes, usuários, produtos, endereços e parâmetros operacionais."
        badge="Semana 1"
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Depositantes base</h2>
              <p className="text-sm text-slate-600">
                Massa inicial para isolamento multi-tenant e políticas de acesso.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              8 previstos
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {depositantesResumo.map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {item.method}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">SKUs</p>
                    <p className="mt-1 font-medium text-slate-900">{item.skus}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Endereços</p>
                    <p className="mt-1 font-medium text-slate-900">{item.addresses}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Checklist de produto</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {productChecklist.map((item) => (
              <li key={item} className="rounded-xl bg-slate-50 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {configModules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
          >
            <p className="text-base font-semibold text-slate-950">{module.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Blueprint de endereços</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Código</th>
                  <th className="pb-3 font-medium">Área</th>
                  <th className="pb-3 font-medium">Capacidade</th>
                </tr>
              </thead>
              <tbody>
                {addressBlueprint.map((address) => (
                  <tr key={address.code} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 font-medium text-slate-900">{address.code}</td>
                    <td className="py-3 text-slate-600">{address.area}</td>
                    <td className="py-3 text-slate-600">{address.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Próximos cadastros</h2>
          <div className="mt-4 grid gap-3">
            {[
              "Usuários com papel e depositante vinculado",
              "Transportadoras e etiquetas",
              "Parâmetros por depositante",
              "Mapeamento de unidades e conversões",
              "Modelos de importação de produto e recebimento",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
