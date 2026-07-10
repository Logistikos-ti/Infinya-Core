import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StockCycleCountCreateForm } from "@/components/estoque/stock-cycle-count-create-form";
import { getDesktopStockPageData } from "../../_lib";

const areaOptions = [
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Armazenagem" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "Expedição" },
];

export default async function StockCycleCountNewPage() {
  const data = await getDesktopStockPageData();

  return (
    <div className="space-y-4">
      <Link
        href="/estoque"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para estoque
      </Link>

      <StockCycleCountCreateForm
        available={data.cycleCountsResult.available}
        depositantes={data.depositanteOptions.map((item) => ({
          value: item.id,
          label: item.nome,
        }))}
        areas={areaOptions}
        defaultDepositanteId={data.effectiveDepositanteFilter}
        canSelectDepositante={data.canSelectDepositante}
      />

      {data.cycleCountsResult.available && data.cycleCountsResult.data.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">
            Contagens recentes
          </p>
          <div className="mt-3 space-y-3">
            {data.cycleCountsResult.data.map((count) => (
              <Link
                key={count.id}
                href={`/estoque/inventarios/${count.id}`}
                className="block rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-slate-200 dark:hover:bg-zinc-900"
              >
                <p className="font-medium text-slate-950 dark:text-white">{count.titulo}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {count.area} • {count.status} • {count.createdAt}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
