import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  const supabase = await createSupabaseServerClient();

  const [
    { data: depositantes },
    { data: produtos },
    { data: usuarios },
    { data: enderecos },
  ] = await Promise.all([
    supabase.from("depositantes").select("id, codigo, nome, ativo").order("nome"),
    supabase.from("produtos").select("depositante_id, metodo_retirada, ativo"),
    supabase.from("usuarios").select("depositante_id, ativo"),
    supabase.from("enderecos").select("id, codigo, area, capacidade_maxima, ativo").order("codigo"),
  ]);

  return Response.json({
    depositantes: depositantes ?? [],
    produtos: produtos ?? [],
    usuarios: usuarios ?? [],
    enderecos: enderecos ?? [],
  });
}
