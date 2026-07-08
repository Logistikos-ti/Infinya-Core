import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StockCycleCountCreateForm } from "@/components/estoque/stock-cycle-count-create-form";
import { getMobileStockPageData } from "../_lib";

const areaOptions = [
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Armazenagem" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "ExpediÃ§Ã£o" },
];

export default async function MobileStockInventariosPage() {
  const data = await getMobileStockPageData();

  return (
    <div className="space-y-4">
      <Link
        href="/m/estoque"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
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
        defaultDepositanteId={data.defaultDepositanteId}
        canSelectDepositante={data.canSelectDepositante}
      />

      {data.cycleCountsResult.available && data.cycleCountsResult.data.length ? (
        <section className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
          <p className="text-sm font-semibold text-white">Contagens recentes</p>
          <div className="mt-3 space-y-3">
            {data.cycleCountsResult.data.map((count) => (
              <Link
                key={count.id}
                href={`/estoque/inventarios/${count.id}`}
                className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]"
              >
                <p className="font-medium text-white">{count.titulo}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {count.area} â€¢ {count.status} â€¢ {count.createdAt}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}


