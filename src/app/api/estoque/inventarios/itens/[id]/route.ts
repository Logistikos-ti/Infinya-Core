import { requireApiModuleAccess } from "@/lib/api-auth";
import {
  registerSecondCycleCount,
  updateCycleCountItem,
} from "@/lib/stock-cycle-counts";

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
    return Response.json(
      { error: "Ajustes de inventário são aplicados automaticamente após a contagem." },
      { status: 410 },
    );
  }

  if (payload?.action === "second-count") {
    const secondCountedQuantity = Number(payload?.countedQuantity ?? 0);

    if (!Number.isFinite(secondCountedQuantity) || secondCountedQuantity < 0) {
      return Response.json(
        { error: "Informe uma quantidade válida para a segunda contagem." },
        { status: 400 },
      );
    }

    try {
      await registerSecondCycleCount({
        userId: auth.user.id,
        cycleCountItemId: id,
        countedQuantity: secondCountedQuantity,
        observacoes: String(payload?.observacoes ?? "").trim(),
      });

      return Response.json({ message: "Segunda contagem registrada e aplicada ao estoque." });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Falha ao registrar a segunda contagem." },
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
    const result = await updateCycleCountItem({
      userId: auth.user.id,
      cycleCountItemId: id,
      countedQuantity,
      observacoes: String(payload?.observacoes ?? "").trim(),
    });

    return Response.json({
      message: "Contagem do item registrada e saldo atualizado automaticamente.",
      result,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar a contagem." },
      { status: 400 },
    );
  }
}
