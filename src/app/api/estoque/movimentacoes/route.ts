import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { transferStockBalance } from "@/lib/stock-transfer";

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        action?: string;
        stockId?: string;
        destinationAddressId?: string;
        quantity?: string | number;
        depositanteId?: string;
      }
    | null;

  if (!payload || payload.action !== "transferencia") {
    return Response.json({ error: "Ação inválida para movimentação de estoque." }, { status: 400 });
  }

  const stockId = String(payload.stockId ?? "").trim();
  const destinationAddressId = String(payload.destinationAddressId ?? "").trim();
  const depositanteId = auth.user.depositanteId ?? String(payload.depositanteId ?? "").trim();
  const quantity = Number(payload.quantity ?? 0);

  if (!stockId) {
    return Response.json({ error: "Selecione um saldo de origem válido." }, { status: 400 });
  }

  if (!destinationAddressId) {
    return Response.json({ error: "Selecione um endereço de destino válido." }, { status: 400 });
  }

  if (!depositanteId) {
    return Response.json({ error: "Selecione um depositante válido." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) {
    return scopeError;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return Response.json(
      { error: "Informe uma quantidade maior que zero para movimentar." },
      { status: 400 },
    );
  }

  try {
    const result = await transferStockBalance({
      userId: auth.user.id,
      depositanteId,
      stockId,
      destinationAddressId,
      quantity,
    });

    return Response.json({
      message: `Transferência concluída de ${result.sourceAddressCode} para ${result.destinationAddressCode}.`,
      result,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao transferir o estoque." },
      { status: 400 },
    );
  }
}
