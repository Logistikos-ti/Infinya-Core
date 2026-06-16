import { requireApiModuleAccess } from "@/lib/api-auth";
import { listStockBalancesFromDb, listStockExpiryAlertsFromDb } from "@/lib/stock";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);

  return Response.json({
    balances: await listStockBalancesFromDb({
      depositanteId: searchParams.get("depositante")?.trim() || undefined,
      productTerm: searchParams.get("produto")?.trim() || undefined,
      area: searchParams.get("area")?.trim() || undefined,
      lot: searchParams.get("lote")?.trim() || undefined,
    }),
    expiryAlerts: await listStockExpiryAlertsFromDb({
      depositanteId: searchParams.get("depositante")?.trim() || undefined,
      productTerm: searchParams.get("produto")?.trim() || undefined,
      area: searchParams.get("area")?.trim() || undefined,
      lot: searchParams.get("lote")?.trim() || undefined,
    }),
  });
}
