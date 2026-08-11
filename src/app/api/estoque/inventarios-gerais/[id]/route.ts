import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { claimGeneralInventoryItem, getGeneralInventory } from "@/lib/general-inventories";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  try {
    const result = await getGeneralInventory(id);
    if (!result) return Response.json({ error: "Inventário geral não encontrado." }, { status: 404 });
    const scopeError = ensureUserCanAccessDepositante(auth.user, result.depositanteId);
    if (scopeError) return scopeError;
    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha ao carregar o inventário." }, { status: 400 });
  }
}

export async function POST(request: Request, context: Context) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as { action?: string; itemId?: string } | null;
  if (payload?.action !== "assumir") return Response.json({ error: "Ação inválida." }, { status: 400 });

  try {
    const before = await getGeneralInventory(id);
    if (!before) return Response.json({ error: "Inventário geral não encontrado." }, { status: 404 });
    const scopeError = ensureUserCanAccessDepositante(auth.user, before.depositanteId);
    if (scopeError) return scopeError;
    const claimed = await claimGeneralInventoryItem({ inventoryId: id, itemId: payload.itemId, userId: auth.user.id });
    return Response.json({ result: claimed.detail, claimedItemId: claimed.claimedItemId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível assumir o produto." }, { status: 409 });
  }
}
