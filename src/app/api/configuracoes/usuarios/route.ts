import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  const supabase = await createSupabaseServerClient();
  const { data: users, error } = await supabase
    .from("usuarios")
    .select("id, email, nome, papel, ativo, created_at, depositante_id, depositante:depositantes(nome)")
    .order("nome");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    users: users ?? [],
  });
}
