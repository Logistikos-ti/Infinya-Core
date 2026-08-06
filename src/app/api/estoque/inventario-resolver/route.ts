import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Same equality-only .or() lookup pattern already used by registerInitialStock
// (src/lib/stock-initial.ts) -- kept local since that helper isn't exported.
function escapeSupabaseValue(value: string) {
  return value.replaceAll(",", "\\,");
}

/**
 * Resolves the two scans that now replace the old "pick a product from
 * the list" step in Inventário: bipar o produto, then bipar o endereço.
 * Two actions in one route since the second step needs the first one's
 * result (produtoId) to find or create the right estoque row.
 *
 * "action": "produto" -- looks up the produto by whatever code was bipped
 * (scoped to the depositante, not to existing stock, so it also works for
 * a product that has never been counted here before).
 *
 * "action": "endereco" -- looks up the endereço by código (a global
 * warehouse location, not depositante-scoped) and finds the matching
 * estoque row for (produto, endereço, depositante). If none exists yet,
 * one is created with quantidade 0 instead of failing -- the operator
 * may have found stock somewhere the system didn't expect, and that is
 * exactly what a cycle count should be able to capture (a "blind count"
 * against 0 expected). No movement is recorded here; MobileCycleCountPanel
 * / POST /api/estoque/inventarios still owns that once the operator
 * confirms the counted quantity.
 */
export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as {
    action?: "produto" | "endereco";
    depositanteId?: string;
    barcode?: string;
    produtoId?: string;
  } | null;

  const depositanteId = String(payload?.depositanteId ?? "").trim();
  const barcode = String(payload?.barcode ?? "").trim();

  if (!depositanteId || !barcode) {
    return Response.json({ error: "Informe o depositante e o código bipado." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) return scopeError;

  const admin = createSupabaseAdminClient();

  if (payload?.action === "endereco") {
    const produtoId = String(payload?.produtoId ?? "").trim();
    if (!produtoId) {
      return Response.json({ error: "Bipe o produto antes do endereço." }, { status: 400 });
    }

    const { data: enderecos, error: enderecoError } = await admin
      .from("enderecos")
      .select("id, codigo, area")
      .eq("codigo", barcode)
      .eq("ativo", true)
      .limit(2);

    if (enderecoError) {
      return Response.json({ error: "Falha ao localizar o endereço." }, { status: 500 });
    }

    if (!enderecos?.length) {
      return Response.json({ error: "Endereço não encontrado ou inativo." }, { status: 404 });
    }

    if (enderecos.length > 1) {
      return Response.json(
        { error: "Mais de um endereço corresponde a este código. Revise o cadastro." },
        { status: 409 },
      );
    }

    const endereco = enderecos[0];

    const { data: existingRows, error: existingError } = await admin
      .from("estoque")
      .select("id, quantidade")
      .eq("depositante_id", depositanteId)
      .eq("produto_id", produtoId)
      .eq("endereco_id", endereco.id)
      .limit(2);

    if (existingError) {
      return Response.json({ error: "Falha ao consultar o saldo neste endereço." }, { status: 500 });
    }

    // A product can legitimately have more than one row at the same
    // address (different lotes/validades) -- this flow doesn't ask the
    // operator to pick a lote, so it just counts against the first one,
    // same simplification the old product list already made (one card
    // per estoque row, no lote disambiguation).
    let estoqueId = existingRows?.[0]?.id ?? null;

    if (!estoqueId) {
      const { data: created, error: createError } = await admin
        .from("estoque")
        .insert({
          depositante_id: depositanteId,
          produto_id: produtoId,
          endereco_id: endereco.id,
          quantidade: 0,
        })
        .select("id")
        .single();

      if (createError || !created) {
        return Response.json({ error: "Não foi possível abrir a contagem neste endereço." }, { status: 500 });
      }

      estoqueId = created.id;
    }

    return Response.json({ estoqueId, enderecoCodigo: endereco.codigo, enderecoArea: endereco.area });
  }

  const { data: produtos, error: produtoError } = await admin
    .from("produtos")
    .select("id, nome, sku, codigo_externo, codigo_interno, codigo_externo_pack, imagem_principal_url")
    .eq("depositante_id", depositanteId)
    .eq("ativo", true)
    .or(
      [
        `codigo_externo.eq.${escapeSupabaseValue(barcode)}`,
        `codigo_interno.eq.${escapeSupabaseValue(barcode)}`,
        `codigo_externo_pack.eq.${escapeSupabaseValue(barcode)}`,
        `sku.eq.${escapeSupabaseValue(barcode)}`,
      ].join(","),
    )
    .limit(2);

  if (produtoError) {
    return Response.json({ error: "Falha ao localizar o produto." }, { status: 500 });
  }

  if (!produtos?.length) {
    return Response.json({ error: "Produto não encontrado neste depositante." }, { status: 404 });
  }

  if (produtos.length > 1) {
    return Response.json(
      { error: "Mais de um produto corresponde a este código. Revise o cadastro." },
      { status: 409 },
    );
  }

  const produto = produtos[0];

  return Response.json({
    produtoId: produto.id,
    nome: produto.nome,
    sku: produto.sku,
    barcode: produto.codigo_externo,
    codigoInterno: produto.codigo_interno,
    imagemUrl: produto.imagem_principal_url,
  });
}
