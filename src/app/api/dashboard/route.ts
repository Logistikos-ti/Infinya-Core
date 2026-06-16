import { filterItemsByUserDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import {
  listReceivingOrders,
  listReceivingStats,
  listRoadmapMilestones,
  listShippingQueues,
} from "@/lib/wms-data";

export async function GET() {
  const auth = await requireApiModuleAccess("dashboard");

  if (auth.response) {
    return auth.response;
  }

  return Response.json({
    receivingStats: listReceivingStats(),
    receivingOrders: filterItemsByUserDepositante(
      auth.user,
      listReceivingOrders(),
      (item) => item.depositante,
    ),
    roadmap: listRoadmapMilestones(),
    shippingQueues: filterItemsByUserDepositante(
      auth.user,
      listShippingQueues(),
      () => auth.user.depositanteNome,
    ),
  });
}
