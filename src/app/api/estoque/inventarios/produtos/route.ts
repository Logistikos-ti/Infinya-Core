import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Lista enxuta de produtos de um depositante, só pra popular o seletor de
// "Produto" no modal de programar contagem cíclica (contagem de um único
// SKU). Rota própria em vez de reaproveitar /api/configuracoes/produtos:
// aquela exige acesso à seção de config "produtos" (permissão diferente) e
// devolve todo o cadastro, pesado demais só pra um <select>.
export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const params = new URL(request.url).searchParams;
  const depositanteId = params.get("depositanteId")?.trim();
  if (!depositanteId) {
    return Response.json({ error: "Informe o depositante." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) return scopeError;

  const supabase = createSupabaseAdminClient();
  let query = supabase.from("produtos").select("id, sku, nome").eq("depositante_id", depositanteId).order("nome");
  // activeOnly: usado pela prévia de "produtos a inventariar" de um
  // inventário ainda Programado -- mesmo filtro que snapshotGeneralInventoryItems
  // aplica de verdade na hora de iniciar. O seletor de produto do modal de
  // programar continua sem esse filtro (mostra tudo, de propósito).
  const activeOnly = params.get("activeOnly") === "true";
  if (activeOnly) {
    query = query.eq("ativo", true);
  }
  const { data, error } = await query;

  if (error) {
    return Response.json({ error: `Não foi possível listar os produtos: ${error.message}` }, { status: 500 });
  }

  const products = data ?? [];

  // A prévia também quer mostrar uma quantidade -- não existe "esperado"
  // real ainda (só é gravado ao iniciar), então usa o estoque atual como
  // aproximação: é exatamente essa soma que snapshotGeneralInventoryItems
  // vai gravar como quantidade_sistema quando o inventário começar de fato.
  if (activeOnly && products.length) {
    const { data: stockRows } = await supabase
      .from("estoque")
      .select("produto_id, quantidade")
      .eq("depositante_id", depositanteId)
      .in("produto_id", products.map((p) => p.id));

    const quantityByProduct = new Map<string, number>();
    for (const row of stockRows ?? []) {
      quantityByProduct.set(row.produto_id, (quantityByProduct.get(row.produto_id) ?? 0) + Number(row.quantidade ?? 0));
    }

    return Response.json({
      products: products.map((p) => ({ ...p, quantidadeAtual: quantityByProduct.get(p.id) ?? 0 })),
    });
  }

  return Response.json({ products });
}
