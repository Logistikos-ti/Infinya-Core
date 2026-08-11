import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { getGeneralInventoryReport } from "@/lib/general-inventories";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  try {
    const { detail, csv } = await getGeneralInventoryReport(id);
    const scopeError = ensureUserCanAccessDepositante(auth.user, detail.depositanteId);
    if (scopeError) return scopeError;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventario-geral-${detail.dataOperacional}.csv"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o relatório." }, { status: 400 });
  }
}
