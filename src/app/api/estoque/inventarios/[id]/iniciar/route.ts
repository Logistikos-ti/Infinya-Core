import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { getCycleCountDetailFromDb, startScheduledCycleCount } from "@/lib/stock-cycle-counts";
import { getGeneralInventory, startScheduledGeneralInventory } from "@/lib/general-inventories";

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

      const result = await startScheduledGeneralInventory(id);
      return Response.json({ message: "Inventário geral iniciado.", result: { ...result, type: "GERAL" } });
    }

    const detailResult = await getCycleCountDetailFromDb(id);
    if (!detailResult.data) return Response.json({ error: "Contagem não encontrada." }, { status: 404 });
    const scopeError = ensureUserCanAccessDepositante(auth.user, detailResult.data.depositanteId);
    if (scopeError) return scopeError;

    const result = await startScheduledCycleCount(id);
    return Response.json({ message: "Contagem cíclica iniciada.", result: { ...result, type: "CICLICO" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao iniciar o inventário." },
      { status: 400 },
    );
  }
}
