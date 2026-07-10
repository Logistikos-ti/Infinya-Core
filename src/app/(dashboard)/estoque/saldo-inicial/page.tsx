import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StockInitialEntryForm } from "@/components/estoque/stock-initial-entry-form";
import { getDesktopStockPageData } from "../_lib";

export default async function StockInitialDesktopPage() {
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

      <StockInitialEntryForm
        depositantes={data.depositanteOptions.map((item) => ({
          value: item.id,
          label: item.nome,
        }))}
        produtos={data.produtosInventario}
        enderecos={data.enderecosInventario}
        defaultDepositanteId={data.effectiveDepositanteFilter}
        canSelectDepositante={data.canSelectDepositante}
      />
    </div>
  );
}
