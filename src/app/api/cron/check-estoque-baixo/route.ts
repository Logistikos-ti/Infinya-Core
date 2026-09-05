import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

// Roda diário (ver vercel.json). "Baixo" = quantidade somada em estoque <
// qtd_minima cadastrada no produto (decisão do usuário em 2026-09-05 --
// não a definição mais estrita "< metade do mínimo" usada em
// listStockStatsFromDb/emRuptura, nem só "zerado"). Produtos sem mínimo
// definido (null ou 0) nunca entram aqui.
//
// estoque_baixo_alertas guarda o estado indo/voltando: só existe uma
// linha ATIVA (resolvido_em null) por produto de cada vez -- abre uma
// nova (+ notifica) quando cruza pra baixo do mínimo sem já ter alerta
// ativo, resolve quando volta a ficar OK. Isso notifica só uma vez até
// normalizar (decisão explícita do usuário), não todo dia enquanto
// continuar baixo.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: produtos, error: produtosError } = await supabase
    .from("produtos")
    .select("id, nome, depositante_id, qtd_minima")
    .eq("ativo", true)
    .not("qtd_minima", "is", null)
    .gt("qtd_minima", 0);

  if (produtosError) {
    return NextResponse.json({ error: produtosError.message }, { status: 500 });
  }

  if (!produtos?.length) {
    return NextResponse.json({ ok: true, abertos: 0, resolvidos: 0, produtosAvaliados: 0 });
  }

  const produtoIds = produtos.map((p) => p.id);

  const [{ data: estoqueRows, error: estoqueError }, { data: activeAlerts, error: alertsError }] = await Promise.all([
    supabase.from("estoque").select("produto_id, quantidade").in("produto_id", produtoIds),
    supabase.from("estoque_baixo_alertas").select("id, produto_id").in("produto_id", produtoIds).is("resolvido_em", null),
  ]);

  if (estoqueError) {
    return NextResponse.json({ error: estoqueError.message }, { status: 500 });
  }
  if (alertsError) {
    return NextResponse.json({ error: alertsError.message }, { status: 500 });
  }

  const qtdByProduto = new Map<string, number>();
  for (const row of estoqueRows ?? []) {
    qtdByProduto.set(row.produto_id, (qtdByProduto.get(row.produto_id) ?? 0) + Number(row.quantidade ?? 0));
  }
  const activeAlertIdByProduto = new Map((activeAlerts ?? []).map((alert) => [alert.produto_id, alert.id]));

  let abertos = 0;
  let resolvidos = 0;

  for (const produto of produtos) {
    const qtd = qtdByProduto.get(produto.id) ?? 0;
    const min = Number(produto.qtd_minima ?? 0);
    const isLow = qtd < min;
    const activeAlertId = activeAlertIdByProduto.get(produto.id);

    if (isLow && !activeAlertId) {
      const { error: insertError } = await supabase
        .from("estoque_baixo_alertas")
        .insert({ produto_id: produto.id, depositante_id: produto.depositante_id });

      // Colisão com a unique parcial (outra execução abriu o alerta entre
      // o select e aqui) -- não é erro real, só significa que já foi
      // tratado; não notifica de novo.
      if (!insertError) {
        abertos += 1;
        await createNotification({
          tipo: "ESTOQUE_BAIXO",
          titulo: "Estoque abaixo do mínimo",
          mensagem: `${produto.nome} está com ${qtd} unidade(s) em estoque, abaixo do mínimo de ${min}.`,
          link: "/configuracoes/produtos",
          depositanteId: produto.depositante_id,
          referenciaTipo: "produto",
          referenciaId: produto.id,
        });
      }
    } else if (!isLow && activeAlertId) {
      await supabase
        .from("estoque_baixo_alertas")
        .update({ resolvido_em: new Date().toISOString() })
        .eq("id", activeAlertId);
      resolvidos += 1;
    }
  }

  return NextResponse.json({ ok: true, abertos, resolvidos, produtosAvaliados: produtos.length });
}
