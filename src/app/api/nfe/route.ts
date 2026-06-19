import { requireApiModuleAccess } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiModuleAccess("nfe");

  if (auth.response) {
    return auth.response;
  }

  const supabase = await createSupabaseServerClient();
  const query = supabase
    .from("documentos_armazenados")
    .select(
      "id, nome_arquivo, tipo, created_at, depositante_id, pedido_expedicao_id, pedido_recebimento_id, depositante:depositantes(nome), pedido_expedicao:pedidos_expedicao(id, codigo, numero_pedido, status), pedido_recebimento:pedidos_recebimento(id, codigo, nota_fiscal_numero, status)",
    )
    .eq("tipo", "NF")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data, error } = await query;

  if (error) {
    return Response.json(
      { error: `Não foi possível carregar a inbox fiscal: ${error.message}` },
      { status: 500 },
    );
  }

  const inbox =
    auth.user.depositanteId && auth.user.papel === "DEPOSITANTE"
      ? (data ?? []).filter((item) => item.depositante_id === auth.user.depositanteId)
      : (data ?? []);

  return Response.json({ inbox });
}
