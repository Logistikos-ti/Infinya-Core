import { filterItemsByUserDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { listRouteLoads } from "@/lib/wms-data";

export async function GET() {
  const auth = await requireApiModuleAccess("romaneio");

  if (auth.response) {
    return auth.response;
  }

  return Response.json({
    routeLoads: filterItemsByUserDepositante(auth.user, listRouteLoads(), () => auth.user.depositanteNome),
  });
}
