import { requireApiRoleAccess } from "@/lib/api-auth";
import { deleteStockBalance, zeroStockBalance } from "@/lib/stock-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as { action?: string } | null;

  if (payload?.action !== "zero") {
    return Response.json({ error: "Ação inválida para ajuste de estoque." }, { status: 400 });
  }

  try {
    const result = await zeroStockBalance(id, auth.user.id);
    return Response.json({
      message: result.alreadyZero
        ? "Este saldo já estava zerado."
        : "Saldo zerado com sucesso.",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao zerar o saldo." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    await deleteStockBalance(id);
    return Response.json({ message: "Linha de estoque excluída com sucesso." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao excluir o saldo." },
      { status: 400 },
    );
  }
}
