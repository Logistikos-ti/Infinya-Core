import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("enderecos")
    .select(
      "id, codigo, descricao, area, rua, modulo, nivel, posicao, capacidade_maxima, unidade_padrao, ativo, created_at",
    )
    .order("codigo");

  if (error) {
    return Response.json(
      { error: `Não foi possível listar os endereços: ${error.message}` },
      { status: 500 },
    );
  }

  return Response.json({
    addresses: data ?? [],
  });
}
