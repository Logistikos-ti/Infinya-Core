import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enviarEmailFatura } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const emailsExtras: string[] = body?.emails ?? [];

  const admin = createSupabaseAdminClient();

  const { data: fatura } = await admin
    .from("faturas")
    .select("*, depositantes(id, nome)")
    .eq("id", id)
    .single();

  if (!fatura) {
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }

  const dep = fatura.depositantes as { id: string; nome: string } | null;
  if (!dep) {
    return NextResponse.json({ error: "Depositante não encontrado." }, { status: 404 });
  }

  const { data: usuarios } = await admin
    .from("usuarios")
    .select("email")
    .eq("depositante_id", dep.id)
    .eq("ativo", true);

  const destinatarios = [
    ...new Set([
      ...(usuarios ?? []).map((u) => u.email as string),
      ...emailsExtras.filter((e) => e.includes("@")),
    ]),
  ];

  if (destinatarios.length === 0) {
    return NextResponse.json(
      { error: "Nenhum destinatário encontrado. Cadastre um e-mail no depositante ou informe manualmente." },
      { status: 400 },
    );
  }

  const result = await enviarEmailFatura(destinatarios, {
    depositanteNome: dep.nome,
    mesAno: fatura.mes_ano,
    totalServicos: Number(fatura.total_servicos),
    totalDescontos: Number(fatura.total_descontos),
    totalAPagar: Number(fatura.total_a_pagar),
    boletoUrl: fatura.boleto_url,
    nfUrl: fatura.nf_url,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (fatura.status === "FECHADA") {
    await admin
      .from("faturas")
      .update({ status: "ENVIADA", enviado_em: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({
    enviado: true,
    destinatarios,
    statusAtualizado: fatura.status === "FECHADA",
  });
}
