import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { isAdminUser } from "@/lib/permissions";
import { getCycleCountDetailFromDb, maskCycleCountDetailForBlindCount } from "@/lib/stock-cycle-counts";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    const detailResult = await getCycleCountDetailFromDb(id);
    if (!detailResult.data) {
      return Response.json({ error: "Contagem não encontrada." }, { status: 404 });
    }

    const scopeError = ensureUserCanAccessDepositante(auth.user, detailResult.data.depositanteId);
    if (scopeError) return scopeError;

    const showSystemQuantity =
      !detailResult.data.blindCount || detailResult.data.status === "CONCLUIDA" || isAdminUser(auth.user);
    const result = maskCycleCountDetailForBlindCount(detailResult.data, showSystemQuantity);

    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar a contagem." },
      { status: 400 },
    );
  }
}
