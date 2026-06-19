import { requireApiRoleAccess } from "@/lib/api-auth";
import { buildIntegrationAlerts } from "@/lib/integration-alerts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: depositantes, error: depositantesError }, { data: shippingOrders, error: shippingOrdersError }, { data: linkedDocuments, error: linkedDocumentsError }] =
    await Promise.all([
      supabase
        .from("depositantes")
        .select("id, nome, configuracoes, observacoes")
        .order("nome"),
      supabase.from("pedidos_expedicao").select("id, depositante_id, origem"),
      supabase.from("documentos_armazenados").select("pedido_expedicao_id, tipo"),
    ]);

  if (depositantesError || shippingOrdersError || linkedDocumentsError) {
    return Response.json(
      {
        error:
          depositantesError?.message ??
          shippingOrdersError?.message ??
          linkedDocumentsError?.message ??
          "Falha ao carregar alertas de integração.",
      },
      { status: 500 },
    );
  }

  const alerts = buildIntegrationAlerts({
    depositantes: (depositantes ?? []) as Array<{
      id: string;
      nome: string;
      configuracoes: unknown;
      observacoes: string | null;
    }>,
    shippingOrders: (shippingOrders ?? []) as Array<{
      id: string;
      depositante_id: string;
      origem: string;
    }>,
    linkedDocuments: (linkedDocuments ?? []) as Array<{
      pedido_expedicao_id: string | null;
      tipo: string;
    }>,
  });

  return Response.json({
    alerts,
    summary: {
      total: alerts.length,
      critical: alerts.filter((item) => item.severity === "critical").length,
      warning: alerts.filter((item) => item.severity === "warning").length,
    },
    generatedAt: new Date().toISOString(),
  });
}
