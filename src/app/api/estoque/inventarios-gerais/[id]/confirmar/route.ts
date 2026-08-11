import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { finalizeGeneralInventory, getGeneralInventory } from "@/lib/general-inventories";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  try {
    const before = await getGeneralInventory(id);
    if (!before) return Response.json({ error: "Inventário geral não encontrado." }, { status: 404 });
    const scopeError = ensureUserCanAccessDepositante(auth.user, before.depositanteId);
    if (scopeError) return scopeError;
    const summary = await finalizeGeneralInventory({ inventoryId: id, userId: auth.user.id });
    return Response.json({ summary, message: "Inventário geral concluído e ajustes aplicados ao estoque." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível concluir o inventário." }, { status: 400 });
  }
}
