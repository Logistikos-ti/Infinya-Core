import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { listProductOverview } from "@/lib/wms-data";

export default function ConfiguracoesProdutosPage() {
  const productOverview = listProductOverview();

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
        title="Produtos"
        description="Cadastro de SKU com estratégia de retirada, lote e validade."
        badge="Cadastro mestre"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 font-medium">SKU</th>
                <th className="pb-3 font-medium">Depositante</th>
                <th className="pb-3 font-medium">Método</th>
                <th className="pb-3 font-medium">Unidade</th>
                <th className="pb-3 font-medium">Lote</th>
                <th className="pb-3 font-medium">Validade</th>
              </tr>
            </thead>
            <tbody>
              {productOverview.map((item) => (
                <tr key={item.sku} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-3 font-medium text-slate-900">{item.sku}</td>
                  <td className="py-3 text-slate-600">{item.depositante}</td>
                  <td className="py-3 text-slate-600">{item.method}</td>
                  <td className="py-3 text-slate-600">{item.unit}</td>
                  <td className="py-3 text-slate-600">{item.lot}</td>
                  <td className="py-3 text-slate-600">{item.expiry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
