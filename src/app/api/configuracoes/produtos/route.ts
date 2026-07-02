import { requireApiConfigSectionAccess } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiConfigSectionAccess("produtos");

  if (auth.response) {
    return auth.response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("produtos")
    .select(
      "id, depositante_id, codigo_interno, codigo_externo, sku, nome, categoria, metodo_retirada, unidade_estocagem, quantidade_por_embalagem, exige_lote, exige_validade, ativo, created_at, depositante:depositantes(nome)",
    )
    .order("nome");

  if (error) {
    return Response.json(
      { error: `Não foi possível listar os produtos: ${error.message}` },
      { status: 500 },
    );
  }

  return Response.json({
    products: data ?? [],
  });
}
