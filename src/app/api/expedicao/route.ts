import { filterItemsByUserDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { listRouteLoads, listShippingFlow, listShippingQueues } from "@/lib/wms-data";

export async function GET() {
  const auth = await requireApiModuleAccess("expedicao");

  if (auth.response) {
    return auth.response;
  }

  return Response.json({
    queues: filterItemsByUserDepositante(auth.user, listShippingQueues(), () => auth.user.depositanteNome),
    flow: listShippingFlow(),
    routeLoads: filterItemsByUserDepositante(auth.user, listRouteLoads(), () => auth.user.depositanteNome),
  });
}
