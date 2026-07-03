import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { registerInitialStock } from "@/lib/stock-initial";
import { listStockBalancesFromDb, listStockExpiryAlertsFromDb } from "@/lib/stock";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const filters = {
    depositanteId: searchParams.get("depositante")?.trim() || undefined,
    productTerm: searchParams.get("produto")?.trim() || undefined,
    area: searchParams.get("area")?.trim() || undefined,
    lot: searchParams.get("lote")?.trim() || undefined,
  };
  const balances = await listStockBalancesFromDb(filters);

  return Response.json({
    balances,
    expiryAlerts: await listStockExpiryAlertsFromDb(filters, 30, balances),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        depositanteId?: string;
        enderecoCodigo?: string;
        produtoCodigo?: string;
        quantidade?: string | number;
        lote?: string;
        validadeEm?: string;
      }
    | null;

  if (!payload) {
    return Response.json({ error: "Payload invalido." }, { status: 400 });
  }

  const depositanteId = auth.user.depositanteId ?? String(payload.depositanteId ?? "").trim();
  const enderecoCodigo = String(payload.enderecoCodigo ?? "").trim();
  const produtoCodigo = String(payload.produtoCodigo ?? "").trim();
  const quantidade = Number(payload.quantidade ?? 0);
  const lote = String(payload.lote ?? "").trim() || null;
  const validadeEm = String(payload.validadeEm ?? "").trim() || null;

  if (!depositanteId) {
    return Response.json({ error: "Selecione um depositante valido." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) {
    return scopeError;
  }

  if (!enderecoCodigo) {
    return Response.json({ error: "Informe o endereco da contagem." }, { status: 400 });
  }

  if (!produtoCodigo) {
    return Response.json({ error: "Informe o produto da contagem." }, { status: 400 });
  }

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return Response.json({ error: "Informe uma quantidade maior que zero." }, { status: 400 });
  }

  try {
    const result = await registerInitialStock({
      userId: auth.user.id,
      depositanteId,
      enderecoCodigo,
      produtoCodigo,
      quantidade,
      lote,
      validadeEm,
    });

    return Response.json({
      message: `Saldo inicial lancado para ${result.productName} em ${result.enderecoCodigo}. Quantidade atual: ${result.targetQuantity}.`,
      result,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao lancar o saldo inicial." },
      { status: 400 },
    );
  }
}
