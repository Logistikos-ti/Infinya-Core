import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRoleAccess(["DEPOSITANTE"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    minimum?: unknown;
    maximum?: unknown;
  } | null;
  const minimum = Number(body?.minimum);
  const maximum = Number(body?.maximum);

  if (
    !Number.isFinite(minimum) ||
    minimum < 0 ||
    !Number.isFinite(maximum) ||
    maximum <= 0 ||
    maximum < minimum
  ) {
    return NextResponse.json(
      {
        error:
          "Informe limites validos: o maximo deve ser maior ou igual ao minimo.",
      },
      { status: 400 },
    );
  }
  if (!auth.user.depositanteId) {
    return NextResponse.json(
      { error: "Depositante nao identificado." },
      { status: 403 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("produtos")
    .update({ qtd_minima: minimum, qtd_maxima: maximum })
    .eq("id", id)
    .eq("depositante_id", auth.user.depositanteId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ minimum, maximum });
}
