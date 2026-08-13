import { requireApiRoleAccess } from "@/lib/api-auth";
import {
  createStockQuarantine,
  listStockQuarantineFromDb,
} from "@/lib/stock-quarantine";

export async function GET(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"]);

  if (auth.response) {
    return auth.response;
  }

  const url = new URL(request.url);
  const requestedDepositanteId = url.searchParams.get("depositanteId")?.trim() ?? "";
  const isInternal = auth.user.papel === "ADMIN" || auth.user.papel === "TI" || auth.user.papel === "OPERADOR";
  const depositanteId = isInternal ? requestedDepositanteId : auth.user.depositanteId ?? "";

  try {
    const items = await listStockQuarantineFromDb({
      depositanteId,
      status: url.searchParams.get("status")?.trim() || undefined,
      productTerm: url.searchParams.get("q")?.trim() || undefined,
    });
    return Response.json({ items });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar a quarentena." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR"]);

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as
    | { stockId?: string; quantity?: number | string; reason?: string }
    | null;

  const stockId = payload?.stockId?.trim() ?? "";
  const quantity = Number(payload?.quantity ?? 0);
  const reason = payload?.reason?.trim() ?? "";

  if (!stockId) {
    return Response.json({ error: "Selecione uma linha de estoque." }, { status: 400 });
  }

  try {
    const id = await createStockQuarantine({
      stockId,
      quantity,
      reason,
      userId: auth.user.id,
    });
    return Response.json({ id, message: "Produto enviado para quarentena com sucesso." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao criar a quarentena." },
      { status: 400 },
    );
  }
}
