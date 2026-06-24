import { requireApiModuleAccess } from "@/lib/api-auth";
import { listRomaneioGroupsFromDb } from "@/lib/romaneio";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("romaneio");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() ?? "";
  const depositanteId = searchParams.get("depositanteId")?.trim() ?? "";
  const carrier = searchParams.get("transportadora")?.trim() ?? "";
  const dateFrom = searchParams.get("dataInicial")?.trim() ?? "";
  const dateTo = searchParams.get("dataFinal")?.trim() ?? "";

  const groups = await listRomaneioGroupsFromDb(auth.user, {
    status: status || undefined,
    depositanteId: depositanteId || undefined,
    carrier: carrier || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  return Response.json({
    romaneios: groups,
  });
}
