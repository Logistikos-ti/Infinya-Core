import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { validateShippingDanfeScan } from "@/lib/shipping-danfe-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiModuleAccess("expedicao");
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const adminSupabase = createSupabaseAdminClient();
  const { data: order, error } = await adminSupabase
    .from("pedidos_expedicao")
    .select("depositante_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ valid: false, message: "Pedido não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, order.depositante_id);
  if (scopeError) return scopeError;

  const result = await validateShippingDanfeScan(adminSupabase, id, body?.code ?? "");
  return NextResponse.json(result, { status: result.valid ? 200 : 422 });
}
