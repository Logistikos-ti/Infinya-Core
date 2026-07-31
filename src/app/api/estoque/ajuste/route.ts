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
        targetQuantity?: string | number;
        reason?: string;
        depositanteId?: string;
      }
    | null;

  if (!payload || !payload.stockId || payload.targetQuantity === undefined || !payload.reason) {
    return Response.json({ error: "Faltam dados obrigatórios para o ajuste." }, { status: 400 });
  }

  const stockId = String(payload.stockId).trim();
  const targetQuantity = Number(payload.targetQuantity);
  const reason = String(payload.reason).trim();
  const depositanteId = auth.user.depositanteId ?? String(payload.depositanteId ?? "").trim();

  if (!Number.isFinite(targetQuantity) || targetQuantity < 0) {
    return Response.json({ error: "Informe uma quantidade final igual ou maior que zero." }, { status: 400 });
  }

  const depositanteAccess = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (depositanteAccess) {
    return depositanteAccess;
  }

  try {
    const result = await adjustStockBalance({
      userId: auth.user.id,
      depositanteId,
      stockId,
      targetQuantity,
      reason,
    });

    return Response.json({ message: "Ajuste realizado com sucesso", newQuantity: result.newQuantity });
  } catch (error: any) {
    console.error("Erro no ajuste de estoque:", error);
    return Response.json({ error: error.message || "Falha interna no ajuste." }, { status: 500 });
  }
}
