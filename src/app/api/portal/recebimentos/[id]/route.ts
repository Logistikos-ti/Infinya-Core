import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { ensureUserCanAccessDepositante } from "@/lib/tenant-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const CANCELABLE_STATUSES = new Set(["AGUARDANDO", "RASCUNHO"]);

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["DEPOSITANTE"]);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { action?: unknown };

  if (payload.action !== "cancel") {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_recebimento")
    .select("id, codigo, status, depositante_id, itens:pedidos_recebimento_itens(id, quantidade_recebida)")
    .eq("id", id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Pedido de recebimento não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, order.depositante_id);
  if (scopeError) {
    return scopeError;
  }

  if (!CANCELABLE_STATUSES.has(order.status)) {
    return NextResponse.json(
      {
        error:
          "Este recebimento já está em andamento ou finalizado no CD e não pode mais ser cancelado por aqui. Entre em contato com a operação.",
      },
      { status: 400 },
    );
  }

  const hasReceivedUnits = (order.itens ?? []).some(
    (item) => Number(item.quantidade_recebida ?? 0) > 0,
  );
  if (hasReceivedUnits) {
    return NextResponse.json(
      {
        error: "Já há volumes recebidos para este pedido, então ele não pode mais ser cancelado por aqui.",
      },
      { status: 400 },
    );
  }

  const { error: updateError } = await adminSupabase
    .from("pedidos_recebimento")
    .update({ status: "CANCELADO" })
    .eq("id", order.id);

  if (updateError) {
    return NextResponse.json(
      { error: `Não foi possível cancelar o recebimento: ${updateError.message}` },
      { status: 500 },
    );
  }

  await adminSupabase
    .from("recebimento_tarefas")
    .update({ status: "CANCELADA" })
    .eq("pedido_recebimento_id", order.id)
    .in("status", ["PENDENTE", "EM_ANDAMENTO"]);

  return NextResponse.json({
    message: `Recebimento ${order.codigo} cancelado com sucesso.`,
  });
}
