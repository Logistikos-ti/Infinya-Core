import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { getGeneralInventory, recordGeneralInventoryItem } from "@/lib/general-inventories";

type Context = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;
  const { id, itemId } = await context.params;
  const payload = (await request.json().catch(() => null)) as { quantidade?: number | string; final?: boolean } | null;
  const quantidade = Number(payload?.quantidade ?? NaN);
  if (!Number.isFinite(quantidade) || quantidade < 0) return Response.json({ error: "Informe uma quantidade válida." }, { status: 400 });

  try {
    const before = await getGeneralInventory(id);
    if (!before) return Response.json({ error: "Inventário geral não encontrado." }, { status: 404 });
    const scopeError = ensureUserCanAccessDepositante(auth.user, before.depositanteId);
    if (scopeError) return scopeError;
    const result = await recordGeneralInventoryItem({
      inventoryId: id,
      itemId,
      userId: auth.user.id,
      quantidade,
      final: payload?.final,
    });
    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a contagem." }, { status: 400 });
  }
}
