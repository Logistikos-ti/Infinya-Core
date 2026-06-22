import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncMercadoLivreAssetsForShippingOrder } from "@/lib/mercado-livre-shipping";

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
  const result = await syncMercadoLivreAssetsForShippingOrder(adminSupabase, id);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
