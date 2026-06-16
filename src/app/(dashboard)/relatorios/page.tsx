import Link from "next/link";
import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireModuleAccess } from "@/lib/auth";
import { canManageMultipleTenants } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { listReportsCatalog } from "@/lib/wms-data";

type RelatoriosPageProps = {
  searchParams?: Promise<{
    depositante?: string;
    produto?: string;
    area?: string;
    lote?: string;
  }>;
};

const areaOptions = [
  { value: "", label: "Todas" },
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Pulmão" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "Expedição" },
];

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const user = await requireModuleAccess("relatorios");
  const params = searchParams ? await searchParams : undefined;
  const depositanteFilter = params?.depositante?.trim() ?? "";
  const productFilter = params?.produto?.trim() ?? "";
  const areaFilter = params?.area?.trim() ?? "";
  const lotFilter = params?.lote?.trim() ?? "";
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : depositanteFilter;

  const supabase = await createSupabaseServerClient();
  const [{ data: depositantes }] = await Promise.all([
    supabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const reportsCatalog = listReportsCatalog();
  const exportQuery = new URLSearchParams({
    report: "saldo-estoque",
    ...(effectiveDepositanteFilter ? { depositante: effectiveDepositanteFilter } : {}),
    ...(productFilter ? { produto: productFilter } : {}),
    ...(areaFilter ? { area: areaFilter } : {}),
    ...(lotFilter ? { lote: lotFilter } : {}),
  });

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Relatórios"
        description="Saldo, produtividade, SLA, rastreabilidade e exportações operacionais."
        badge="Operacional"
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Relatório de saldo exportável
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Exporte o saldo filtrado do estoque em Excel ou CSV, pronto para análise, envio ao
              cliente e conferência externa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/api/relatorios?${exportQuery.toString()}&format=csv`}>
              <Button className="bg-slate-950 text-white hover:bg-slate-800">
                <FileText className="h-4 w-4" />
                Exportar CSV
              </Button>
            </Link>
            <Link href={`/api/relatorios?${exportQuery.toString()}&format=excel`}>
              <Button variant="outline">
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            </Link>
          </div>
        </div>

        <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.3fr_0.9fr_1fr_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Depositante
              </span>
              <select
                name="depositante"
                defaultValue={effectiveDepositanteFilter}
                disabled={!canManageMultipleTenants(user)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">Todos</option>
                {depositanteOptions.map((depositante) => (
                  <option key={depositante.id} value={depositante.id}>
                    {depositante.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Produto
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  name="produto"
                  defaultValue={productFilter}
                  placeholder="SKU, nome ou código interno"
                  className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Área
              </span>
              <select
                name="area"
                defaultValue={areaFilter}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                {areaOptions.map((option) => (
                  <option key={option.value || "todas"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Lote
              </span>
              <input
                type="text"
                name="lote"
                defaultValue={lotFilter}
                placeholder="Ex.: LOT-2026-001"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>

            <div className="flex items-end gap-2">
              <Button type="submit" className="h-11 bg-slate-950 text-white hover:bg-slate-800">
                <Download className="h-4 w-4" />
                Aplicar
              </Button>
              <Link
                href="/relatorios"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Limpar
              </Link>
            </div>
          </div>
        </form>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Catálogo inicial</h2>
        <p className="mt-1 text-sm text-slate-600">
          Aqui vamos consolidar métricas operacionais e relatórios exportáveis por módulo.
        </p>

        <div className="mt-5 grid gap-3">
          {reportsCatalog.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
