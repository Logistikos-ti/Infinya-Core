import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const depositanteId = searchParams.get("depositante_id");
  const mesAno = searchParams.get("mes_ano");
  const faturaId = searchParams.get("fatura_id");

  const admin = createSupabaseAdminClient();

  let query = admin
    .from("lancamentos")
    .select("*")
    .eq("estornado", false)
    .order("created_at", { ascending: false })
    .limit(500);

  if (depositanteId) query = query.eq("depositante_id", depositanteId);
  if (mesAno) query = query.eq("mes_ano", mesAno);
  if (faturaId) query = query.eq("fatura_id", faturaId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lancamentos: data });
}

export async function POST(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body?.depositante_id || !body?.tipo_servico || body?.valor_total === undefined) {
    return NextResponse.json(
      { error: "Campos obrigatórios: depositante_id, tipo_servico, valor_total." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();

  const mesAno = body.mes_ano ?? new Date().toISOString().slice(0, 7);

  const { data: faturaId } = await admin.rpc("garantir_ou_criar_fatura", {
    p_depositante_id: body.depositante_id,
    p_mes_ano: mesAno,
  });

  if (!faturaId) {
    return NextResponse.json({ error: "Falha ao criar fatura." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("lancamentos")
    .insert({
      depositante_id: body.depositante_id,
      fatura_id: faturaId,
      mes_ano: mesAno,
      tipo_servico: body.tipo_servico,
      origem: "MANUAL",
      referencia_tipo: body.referencia_tipo ?? null,
      referencia_id: body.referencia_id ?? `manual-${Date.now()}`,
      descricao: body.descricao ?? `Lançamento manual: ${body.tipo_servico}`,
      quantidade: body.quantidade ?? 1,
      valor_unitario: body.valor_unitario ?? body.valor_total,
      valor_total: body.valor_total,
      memoria_calculo: body.memoria_calculo ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.rpc("recalcular_totais_fatura", { p_fatura_id: faturaId });

  return NextResponse.json({ lancamento: data });
}
