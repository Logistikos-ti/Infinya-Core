import { requireApiRoleAccess } from "@/lib/api-auth";
import { splitStockLot } from "@/lib/stock-lot-split";

export async function POST(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as
    | { stockId?: string; quantity?: number | string; newLot?: string; newExpiry?: string | null }
    | null;

  const stockId = payload?.stockId?.trim() ?? "";
  const quantity = Number(payload?.quantity ?? 0);
  const newLot = payload?.newLot?.trim() ?? "";
  const newExpiryRaw = String(payload?.newExpiry ?? "").trim();
  const newExpiry = newExpiryRaw || null;

  if (!stockId) {
    return Response.json({ error: "Selecione uma linha de estoque." }, { status: 400 });
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return Response.json({ error: "Informe uma quantidade maior que zero para o novo lote." }, { status: 400 });
  }

  if (!newLot) {
    return Response.json({ error: "Informe o código do novo lote." }, { status: 400 });
  }

  try {
    const result = await splitStockLot({
      stockId,
      quantity,
      newLot,
      newExpiry,
      userId: auth.user.id,
    });

    return Response.json({
      message: `Lote ${newLot} criado com ${result.quantidadeNovoLote} un.`,
      result,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao dividir o lote." },
      { status: 400 },
    );
  }
}
