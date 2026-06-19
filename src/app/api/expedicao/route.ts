import { requireApiModuleAccess } from "@/lib/api-auth";
import {
  listShippingFlowSteps,
  listShippingOrdersFromDb,
  listShippingQueuesFromDb,
  listShippingStatsFromDb,
} from "@/lib/shipping";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("expedicao");

  if (auth.response) {
    return auth.response;
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() ?? "";
  const depositanteId =
    auth.user.papel === "DEPOSITANTE"
      ? auth.user.depositanteId ?? ""
      : url.searchParams.get("depositante")?.trim() ?? "";
  const dateFrom = url.searchParams.get("dataInicial")?.trim() ?? "";
  const dateTo = url.searchParams.get("dataFinal")?.trim() ?? "";
  const carrier = url.searchParams.get("transportadora")?.trim() ?? "";
  const customer = url.searchParams.get("cliente")?.trim() ?? "";
  const orderSearch = url.searchParams.get("pedido")?.trim() ?? "";
  const marketplace = url.searchParams.get("marketplace")?.trim() ?? "";

  const [stats, orders, queues] = await Promise.all([
    listShippingStatsFromDb(auth.user),
    listShippingOrdersFromDb({
      status: status || undefined,
      depositanteId: depositanteId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      carrier: carrier || undefined,
      customer: customer || undefined,
      orderSearch: orderSearch || undefined,
      marketplace: marketplace || undefined,
    }),
    listShippingQueuesFromDb(),
  ]);

  return Response.json({
    stats,
    orders,
    queues,
    flow: listShippingFlowSteps(),
  });
}
