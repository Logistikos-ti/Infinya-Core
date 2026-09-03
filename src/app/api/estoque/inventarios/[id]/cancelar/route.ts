import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { cancelCycleCount, getCycleCountDetailFromDb } from "@/lib/stock-cycle-counts";
import { cancelGeneralInventory, getGeneralInventory } from "@/lib/general-inventories";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as { tipo?: string } | null;
  const tipo = payload?.tipo === "GERAL" ? "GERAL" : "CICLICO";

  try {
    if (tipo === "GERAL") {
      const detail = await getGeneralInventory(id);
      if (!detail) return Response.json({ error: "Inventário não encontrado." }, { status: 404 });
      const scopeError = ensureUserCanAccessDepositante(auth.user, detail.depositanteId);
      if (scopeError) return scopeError;

      await cancelGeneralInventory(id);
      return Response.json({ message: "Inventário geral cancelado." });
    }

    const detailResult = await getCycleCountDetailFromDb(id);
    if (!detailResult.data) return Response.json({ error: "Contagem não encontrada." }, { status: 404 });
    const scopeError = ensureUserCanAccessDepositante(auth.user, detailResult.data.depositanteId);
    if (scopeError) return scopeError;

    await cancelCycleCount(id);
    return Response.json({ message: "Contagem cíclica cancelada." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao cancelar o inventário." },
      { status: 400 },
    );
  }
}
