import Link from "next/link";
import { StockCycleCountCreateForm } from "@/components/estoque/stock-cycle-count-create-form";
import { getMobileStockPageData } from "../_lib";
import { mobileColors, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";

const areaOptions = [
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Armazenagem" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "Expedição" },
];

export default async function MobileStockInventariosPage() {
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
        <section className="rounded-[24px] p-4" style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.045) }}>
          <p className="text-sm font-semibold" style={{ color: mobileColors.text, ...headingFont }}>Contagens recentes</p>
          <div className="mt-3 space-y-3">
            {data.cycleCountsResult.data.map((count) => (
              <Link
                key={count.id}
                href={`/estoque/inventarios/${count.id}`}
                className="block rounded-2xl px-4 py-3 text-sm transition"
                style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.14)}`, background: hexAlpha("#94A3B8", 0.05), color: mobileColors.muted }}
              >
                <p className="font-medium" style={{ color: mobileColors.text }}>{count.titulo}</p>
                <p className="mt-1 text-xs" style={{ color: mobileColors.dim }}>
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
