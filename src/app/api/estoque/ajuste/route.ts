import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { adjustStockBalance } from "@/lib/stock-adjustment";

function parseOperationalQuantity(value: string | number | undefined) {
  if (typeof value === "number") {
    return value;
  }

  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) {
    return 0;
  }

  if (raw.includes(",")) {
    return Number(raw.replace(/\./g, "").replace(",", "."));
  }

  if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    return Number(raw.replace(/\./g, ""));
  }

  return Number(raw);
}

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        stockId?: string;
        stockIds?: string[];
        targetQuantity?: string | number;
        reason?: string;
        depositanteId?: string;
      }
    | null;

  if (!payload || (!payload.stockId && !payload.stockIds?.length) || payload.targetQuantity === undefined || !payload.reason) {
    return Response.json({ error: "Faltam dados obrigatórios para o ajuste." }, { status: 400 });
  }

  const stockId = String(payload.stockId ?? "").trim();
  const stockIds = Array.isArray(payload.stockIds)
    ? payload.stockIds.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const targetQuantity = parseOperationalQuantity(payload.targetQuantity);
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
      stockIds,
      targetQuantity,
      reason,
    });

    return Response.json({ message: "Ajuste realizado com sucesso", newQuantity: result.newQuantity });
  } catch (error: any) {
    console.error("Erro no ajuste de estoque:", error);
    return Response.json({ error: error.message || "Falha interna no ajuste." }, { status: 500 });
  }
}
