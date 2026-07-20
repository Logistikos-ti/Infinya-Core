import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { adjustStockBalance } from "@/lib/stock-adjustment";

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        stockId?: string;
        quantityDiff?: string | number;
        reason?: string;
        depositanteId?: string;
      }
    | null;

  if (!payload || !payload.stockId || !payload.quantityDiff || !payload.reason) {
    return Response.json({ error: "Faltam dados obrigatórios para o ajuste." }, { status: 400 });
  }

  const stockId = String(payload.stockId).trim();
  const quantityDiff = Number(payload.quantityDiff);
  const reason = String(payload.reason).trim();
  const depositanteId = auth.user.depositanteId ?? String(payload.depositanteId ?? "").trim();

  if (quantityDiff === 0) {
    return Response.json({ error: "A diferença deve ser diferente de zero." }, { status: 400 });
  }

  const depositanteAccess = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (depositanteAccess.error) {
    return Response.json({ error: depositanteAccess.error }, { status: 403 });
  }

  try {
    const result = await adjustStockBalance({
      userId: auth.user.id,
      depositanteId,
      stockId,
      quantityDiff,
      reason,
    });

    return Response.json({ message: "Ajuste realizado com sucesso", newQuantity: result.newQuantity });
  } catch (error: any) {
    console.error("Erro no ajuste de estoque:", error);
    return Response.json({ error: error.message || "Falha interna no ajuste." }, { status: 500 });
  }
}
