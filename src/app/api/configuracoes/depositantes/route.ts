import { requireApiRoleAccess } from "@/lib/api-auth";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("depositantes")
    .select("id, codigo, nome, cnpj, ativo, logo_url, observacoes, configuracoes, created_at")
    .order("nome");

  if (error) {
    return Response.json(
      { error: `Não foi possível listar os depositantes: ${error.message}` },
      { status: 500 },
    );
  }

  return Response.json({
    depositantes: (data ?? []).map((item) => ({
      id: item.id,
      codigo: item.codigo,
      nome: item.nome,
      cnpj: item.cnpj,
      ativo: item.ativo,
      logoUrl: item.logo_url,
      createdAt: item.created_at,
      configuracoes: parseDepositanteConfiguracoes(
        item.configuracoes ? JSON.stringify(item.configuracoes) : item.observacoes,
      ),
    })),
  });
}
