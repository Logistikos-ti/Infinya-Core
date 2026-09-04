import { requireApiModuleAccess } from "@/lib/api-auth";
import { listAvailableShippingOrdersForRomaneio } from "@/lib/romaneio-records";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("romaneio");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const depositanteId = searchParams.get("depositanteId")?.trim() ?? "";

  try {
    const orders = await listAvailableShippingOrdersForRomaneio(auth.user, {
      depositanteId: depositanteId || undefined,
    });

    return Response.json({ orders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar os pedidos disponíveis." },
      { status: 400 },
    );
  }
}
