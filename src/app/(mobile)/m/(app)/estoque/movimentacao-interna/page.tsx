import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StockTransferForm } from "@/components/estoque/stock-transfer-form";
import { getMobileStockPageData } from "../_lib";

export default async function MobileStockTransferPage() {
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

      <StockTransferForm
        depositantes={data.depositanteOptions.map((item) => ({
          value: item.id,
          label: item.nome,
        }))}
        addresses={data.enderecosInventario.map((item) => ({
          value: item.id,
          label: item.codigo,
          area: item.area,
        }))}
        stockSources={data.stockTransferSources}
        defaultDepositanteId={data.defaultDepositanteId}
        canSelectDepositante={data.canSelectDepositante}
      />
    </div>
  );
}
