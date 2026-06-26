import { requireApiModuleAccess } from "@/lib/api-auth";
import { listStockBalancesFromDb, listStockExpiryAlertsFromDb } from "@/lib/stock";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const filters = {
    depositanteId: searchParams.get("depositante")?.trim() || undefined,
    productTerm: searchParams.get("produto")?.trim() || undefined,
    area: searchParams.get("area")?.trim() || undefined,
    lot: searchParams.get("lote")?.trim() || undefined,
  };
  const balances = await listStockBalancesFromDb(filters);

  return Response.json({
    balances,
    expiryAlerts: await listStockExpiryAlertsFromDb(filters, 30, balances),
  });
}
