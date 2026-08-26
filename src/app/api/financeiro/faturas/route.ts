import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const mesAno = searchParams.get("mes_ano");
  const depositanteId = searchParams.get("depositante_id");

  const admin = createSupabaseAdminClient();

  let query = admin
    .from("faturas")
    .select("*, depositantes(id, nome, cnpj)")
    .order("mes_ano", { ascending: false })
    .order("created_at", { ascending: false });

  if (mesAno) query = query.eq("mes_ano", mesAno);
  if (depositanteId) query = query.eq("depositante_id", depositanteId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ faturas: data });
}
