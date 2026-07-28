import Link from "next/link";
import { StockTransferForm } from "@/components/estoque/stock-transfer-form";
import { getMobileStockPageData } from "../_lib";
import { mobileColors } from "@/components/mobile/mobile-kit-tokens";

export default async function MobileStockTransferPage() {
  const data = await getMobileStockPageData();

  return (
    <div className="space-y-4 p-[18px]">
      <Link
        href="/m/estoque"
        className="inline-flex items-center gap-2 text-sm font-medium transition"
        style={{ color: mobileColors.muted }}
      >
        &#8249; Voltar para estoque
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
