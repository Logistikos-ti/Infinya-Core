import Link from "next/link";
import { StockInitialEntryForm } from "@/components/estoque/stock-initial-entry-form";
import { getMobileStockPageData } from "../_lib";
import { mobileColors } from "@/components/mobile/mobile-kit-tokens";

export default async function MobileStockInitialPage() {
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
