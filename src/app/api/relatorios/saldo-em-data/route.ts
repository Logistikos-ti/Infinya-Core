import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listStockBalancesFromDb } from "@/lib/stock";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Saldo de estoque por produto — atual, ou reconstruído como estava no FIM de
// um dia escolhido (fuso America/São_Paulo, UTC-3). A reconstrução parte do
// saldo atual e desconta a variação líquida das movimentações feitas DEPOIS
// daquele dia: saldo(fim do dia D) = saldo atual − Σ(net das movimentações após D).
// Cobre os produtos que ainda têm saldo hoje (itens zerados desde D não entram).
function netStockChange(tipo: string, qty: number): number {
  if (tipo === "ENTRADA" || tipo === "AJUSTE_POSITIVO") return qty;
  if (tipo === "SAIDA" || tipo === "AJUSTE_NEGATIVO") return -qty;
  return 0; // BLOQUEIO/DESBLOQUEIO não mexem no saldo físico
}

export async function GET(request: NextRequest) {
  const auth = await requireApiModuleAccess("relatorios");
  if (auth.response) return auth.response;

  const sp = request.nextUrl.searchParams;
  const date = sp.get("date")?.trim() || ""; // YYYY-MM-DD (dia em SP) — vazio = saldo atual
  const depositanteId =
    auth.user.papel === "DEPOSITANTE"
      ? auth.user.depositanteId ?? undefined
      : sp.get("depositante")?.trim() || undefined;

  const balances = await listStockBalancesFromDb({
    depositanteId,
    productTerm: sp.get("produto")?.trim() || undefined,
    area: sp.get("area")?.trim() || undefined,
    lot: sp.get("lote")?.trim() || undefined,
  });

  // Saldo atual por lote/endereço (cada linha do estoque = 1 registro).
  const byStock = new Map<
    string,
    {
      sku: string;
      produto: string;
      depositante: string;
      lote: string;
      validade: string;
      endereco: string;
      saldo: number;
    }
  >();
  for (const b of balances) {
    byStock.set(b.id, {
      sku: b.sku,
      produto: b.productName,
      depositante: b.depositante,
      lote: b.lote,
      validade: b.validade,
      endereco: b.endereco,
      saldo: b.rawQuantidade,
    });
  }

  const sortRows = <T extends { produto: string; lote: string }>(rows: T[]) =>
    rows.sort(
      (a, b) =>
        a.produto.localeCompare(b.produto, "pt-BR") || a.lote.localeCompare(b.lote, "pt-BR"),
    );

  // Sem data → saldo atual.
  if (!date) {
    const rows = sortRows([...byStock.values()].filter((p) => p.saldo > 0));
    return NextResponse.json(
      { asOf: null, rows },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  }

  // Fim do dia D em SP (UTC-3): início do dia seguinte.
  const startOfDayUtc = new Date(`${date}T00:00:00-03:00`).getTime();
  const afterUtc = new Date(startOfDayUtc + 24 * 60 * 60 * 1000).toISOString();

  // Variação líquida das movimentações APÓS o fim do dia D, por lote (estoque_id).
  // Busca todas de uma vez (paginado) — evita o limite de URL do filtro .in()
  // com centenas de UUIDs.
  const admin = createSupabaseAdminClient();
  const netByStock = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const base = admin
      .from("movimentacoes_estoque")
      .select("estoque_id, tipo, quantidade")
      .gte("created_at", afterUtc)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    const query = depositanteId ? base.eq("depositante_id", depositanteId) : base;
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const page = (data ?? []) as Array<{
      estoque_id: string | null;
      tipo: string;
      quantidade: number | string;
    }>;
    for (const m of page) {
      if (!m.estoque_id) continue; // sem lote associado → não dá pra atribuir
      netByStock.set(
        m.estoque_id,
        (netByStock.get(m.estoque_id) ?? 0) + netStockChange(m.tipo, Number(m.quantidade) || 0),
      );
    }
    if (page.length < 1000) break;
  }

  const rows = sortRows(
    [...byStock.entries()]
      .map(([stockId, p]) => ({ ...p, saldo: p.saldo - (netByStock.get(stockId) ?? 0) }))
      .filter((r) => r.saldo > 0),
  );

  return NextResponse.json(
    { asOf: date, rows },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
