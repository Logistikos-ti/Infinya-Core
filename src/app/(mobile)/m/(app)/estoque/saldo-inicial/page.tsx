import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StockInitialEntryForm } from "@/components/estoque/stock-initial-entry-form";
import { getMobileStockPageData } from "../_lib";

export default async function MobileStockInitialPage() {
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

      <StockInitialEntryForm
        depositantes={data.depositanteOptions.map((item) => ({
          value: item.id,
          label: item.nome,
        }))}
        produtos={data.produtosInventario}
        enderecos={data.enderecosInventario}
        defaultDepositanteId={data.defaultDepositanteId}
        canSelectDepositante={data.canSelectDepositante}
      />
    </div>
  );
}
