import { getDesktopStockPageData } from "./_lib";
import { InventoryClient } from "@/components/estoque/inventory-client";

type EstoquePageProps = {
  searchParams?: Promise<{
    depositante?: string;
    produto?: string;
    area?: string;
    lote?: string;
  }>;
};

export default async function EstoquePage({ searchParams }: EstoquePageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const data = await getDesktopStockPageData(resolvedParams);

  return <InventoryClient data={data} />;
}
