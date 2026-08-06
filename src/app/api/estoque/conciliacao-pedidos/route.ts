import { requireApiRoleAccess } from "@/lib/api-auth";
import { listShippingStockReconciliation } from "@/lib/shipping-stock-reconciliation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  try {
    return Response.json(await listShippingStockReconciliation());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar a conciliação." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as { orderIds?: unknown } | null;
  const requestedIds = Array.isArray(payload?.orderIds)
    ? payload.orderIds.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!requestedIds.length) {
    return Response.json({ error: "Selecione pelo menos um pedido pendente." }, { status: 400 });
  }

  const preview = await listShippingStockReconciliation();
  const allowed = new Set(preview.rows.filter((item) => item.situacao === "PENDENTE").map((item) => item.id));
  const orderIds = requestedIds.filter((id) => allowed.has(id));

  if (!orderIds.length) {
    return Response.json({ error: "Os pedidos selecionados não estão elegíveis para baixa retroativa." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const results = [] as Array<{ id: string; ok: boolean; message?: string }>;

  for (const orderId of orderIds) {
    const { error } = await admin.rpc("conciliar_baixa_retroativa_pedido" as never, {
      p_pedido_id: orderId,
      p_usuario_id: auth.user.id,
    } as never);
    results.push({ id: orderId, ok: !error, message: error?.message });
  }

  const success = results.filter((item) => item.ok).length;
  return Response.json({
    message: `${success} pedido(s) conciliado(s) com baixa física retroativa.`,
    results,
  });
}
