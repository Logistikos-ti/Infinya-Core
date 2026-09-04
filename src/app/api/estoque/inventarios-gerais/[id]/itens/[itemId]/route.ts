import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { recordGeneralInventoryItem } from "@/lib/general-inventories";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;
  const { id, itemId } = await context.params;
  const payload = (await request.json().catch(() => null)) as { quantidade?: number | string; final?: boolean } | null;
  const quantidade = Number(payload?.quantidade ?? NaN);
  if (!Number.isFinite(quantidade) || quantidade < 0) return Response.json({ error: "Informe uma quantidade válida." }, { status: 400 });

  try {
    // Checagem de escopo enxuta (só depositante_id) em vez de recarregar o
    // inventário inteiro só pra ler um campo -- ver comentário equivalente
    // em recordGeneralInventoryItem.
    const supabase = createSupabaseAdminClient();
    const { data: before, error: beforeError } = await supabase
      .from("inventarios_gerais")
      .select("depositante_id")
      .eq("id", id)
      .maybeSingle();
    if (beforeError) return Response.json({ error: `Não foi possível validar o inventário: ${beforeError.message}` }, { status: 500 });
    if (!before) return Response.json({ error: "Inventário geral não encontrado." }, { status: 404 });
    const scopeError = ensureUserCanAccessDepositante(auth.user, before.depositante_id);
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
