import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { getCycleCountDetailFromDb, rescheduleCycleCount } from "@/lib/stock-cycle-counts";
import { getGeneralInventory, rescheduleGeneralInventory } from "@/lib/general-inventories";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as
    | { tipo?: string; programadoPara?: string; responsavelId?: string }
    | null;

  if (!payload) {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const tipo = payload.tipo === "GERAL" ? "GERAL" : "CICLICO";
  const programadoPara = String(payload.programadoPara ?? "").trim();

  if (!programadoPara) {
    return Response.json({ error: "Informe a nova data e hora programadas." }, { status: 400 });
  }

  const responsavelId = payload.responsavelId ? String(payload.responsavelId).trim() : undefined;

  try {
    if (tipo === "GERAL") {
      const detail = await getGeneralInventory(id);
      if (!detail) return Response.json({ error: "Inventário não encontrado." }, { status: 404 });
      const scopeError = ensureUserCanAccessDepositante(auth.user, detail.depositanteId);
      if (scopeError) return scopeError;

      await rescheduleGeneralInventory(id, { programadoPara, responsavelId });
      return Response.json({ message: "Inventário geral reagendado." });
    }

    const detailResult = await getCycleCountDetailFromDb(id);
    if (!detailResult.data) return Response.json({ error: "Contagem não encontrada." }, { status: 404 });
    const scopeError = ensureUserCanAccessDepositante(auth.user, detailResult.data.depositanteId);
    if (scopeError) return scopeError;

    await rescheduleCycleCount(id, { programadoPara, responsavelId });
    return Response.json({ message: "Contagem cíclica reagendada." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao reagendar o inventário." },
      { status: 400 },
    );
  }
}
