import { requireApiRoleAccess } from "@/lib/api-auth";
import { resolveStockQuarantine } from "@/lib/stock-quarantine";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR"]);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as
    | { action?: "release" | "discard"; observations?: string }
    | null;

  if (payload?.action !== "release" && payload?.action !== "discard") {
    return Response.json({ error: "Ação inválida para quarentena." }, { status: 400 });
  }

  try {
    await resolveStockQuarantine({
      quarantineId: id,
      action: payload.action,
      userId: auth.user.id,
      observations: payload.observations,
    });
    return Response.json({
      message:
        payload.action === "release"
          ? "Produto liberado da quarentena com sucesso."
          : "Produto descartado da quarentena com sucesso.",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao resolver a quarentena." },
      { status: 400 },
    );
  }
}
