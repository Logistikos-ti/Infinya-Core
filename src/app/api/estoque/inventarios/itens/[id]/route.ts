import { requireApiModuleAccess } from "@/lib/api-auth";
import { isAdminUser } from "@/lib/permissions";
import { approveCycleCountAdjustment, updateCycleCountItem } from "@/lib/stock-cycle-counts";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as
    | {
        action?: string;
        countedQuantity?: string | number;
        observacoes?: string;
      }
    | null;

  if (payload?.action === "approve-adjustment") {
    if (!isAdminUser(auth.user)) {
      return Response.json(
        { error: "Somente Admin/TI pode aprovar ajuste de divergência." },
        { status: 403 },
      );
    }

    try {
      const result = await approveCycleCountAdjustment({
        userId: auth.user.id,
        cycleCountItemId: id,
        observacoes: String(payload?.observacoes ?? "").trim(),
      });

      return Response.json({
        message: result.alreadyApplied
          ? "Este ajuste já tinha sido aplicado."
          : "Ajuste de inventário aplicado com sucesso.",
      });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Falha ao aprovar o ajuste." },
        { status: 400 },
      );
    }
  }

  const countedQuantity = Number(payload?.countedQuantity ?? 0);

  if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
    return Response.json(
      { error: "Informe uma quantidade contada válida para este item." },
      { status: 400 },
    );
  }

  try {
    await updateCycleCountItem({
      userId: auth.user.id,
      cycleCountItemId: id,
      countedQuantity,
      observacoes: String(payload?.observacoes ?? "").trim(),
    });

    return Response.json({ message: "Contagem do item registrada com sucesso." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar a contagem." },
      { status: 400 },
    );
  }
}
