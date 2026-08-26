import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("contratos_cobranca")
    .select("*, depositantes(id, nome, cnpj)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contratos: data });
}

export async function POST(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body?.depositante_id) {
    return NextResponse.json({ error: "Depositante obrigatório." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("contratos_cobranca")
    .upsert(
      {
        depositante_id: body.depositante_id,
        taxa_fulfillment: body.taxa_fulfillment ?? 0.09,
        minimo_fulfillment: body.minimo_fulfillment ?? 4.90,
        tarifa_posicao: body.tarifa_posicao ?? 90.00,
        valor_ponto_coleta: body.valor_ponto_coleta ?? 1.50,
        marketplaces_ponto_coleta: body.marketplaces_ponto_coleta ?? ["shopee", "mercado livre", "meli", "ml"],
        valor_impressao_nf: body.valor_impressao_nf ?? 0.50,
        taxa_frete_fixa: body.taxa_frete_fixa ?? 3.00,
        taxa_frete_percentual: body.taxa_frete_percentual ?? 0.10,
        tarifa_recebimento: body.tarifa_recebimento ?? 0.00,
        valor_software: body.valor_software ?? 0.00,
        qtd_refrigeradores: body.qtd_refrigeradores ?? 0,
        valor_unitario_refrigerador: body.valor_unitario_refrigerador ?? 0.00,
        tipo_contrato: body.tipo_contrato ?? "padrao",
        vigencia_inicio: body.vigencia_inicio ?? null,
        vigencia_fim: body.vigencia_fim ?? null,
        observacoes: body.observacoes ?? null,
        ativo: body.ativo ?? true,
      },
      { onConflict: "depositante_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contrato: data });
}
