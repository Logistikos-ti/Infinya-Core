import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createManualStockEntry } from "@/lib/stock-manual-entry";

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as {
    stockId?: string;
    quantity?: string | number;
    reason?: string;
    depositanteId?: string;
  } | null;

  const stockId = String(payload?.stockId ?? "").trim();
  const quantity = Number(payload?.quantity ?? 0);
  const reason = String(payload?.reason ?? "").trim();
  const depositanteId = auth.user.depositanteId ?? String(payload?.depositanteId ?? "").trim();

  if (!stockId || !depositanteId || !reason || !Number.isFinite(quantity) || quantity <= 0) {
    return Response.json({ error: "Informe saldo, quantidade e motivo para registrar a entrada manual." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) return scopeError;

  try {
    const result = await createManualStockEntry({
      userId: auth.user.id,
      depositanteId,
      stockId,
      quantity,
      reason,
    });

    return Response.json({ message: "Entrada manual registrada com sucesso.", result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível registrar a entrada manual." },
      { status: 400 },
    );
  }
}
