import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { listAllStockMovementsByProductId } from "@/lib/stock";
import { transferStockBalance } from "@/lib/stock-transfer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const productId = new URL(request.url).searchParams.get("produtoId")?.trim();

  if (!productId) {
    return Response.json({ error: "Informe o produto para consultar o histórico." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: product, error } = await supabase
    .from("produtos")
    .select("id, depositante_id")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    return Response.json({ error: "Produto não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, product.depositante_id);
  if (scopeError) {
    return scopeError;
  }

  try {
    const movements = await listAllStockMovementsByProductId(productId);
    return Response.json({ movements });
  } catch (queryError) {
    return Response.json(
      {
        error:
          queryError instanceof Error
            ? queryError.message
            : "Não foi possível carregar o histórico do produto.",
      },
      { status: 500 },
    );
  }
}

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
