import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncBlingInvoiceAttachmentForShippingOrder } from "@/lib/shipping-attachment-sync";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteProps) {
  const auth = await requireApiModuleAccess("expedicao");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const adminSupabase = createSupabaseAdminClient();

  const { data: order } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, depositante_id")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Pedido de expedição não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, order.depositante_id);

  if (scopeError) {
    return scopeError;
  }

  const result = await syncBlingInvoiceAttachmentForShippingOrder(adminSupabase, id);

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status === "insufficient_scope" ? 409 : 500,
  });
}
