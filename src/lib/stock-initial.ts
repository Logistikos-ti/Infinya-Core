import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RegisterInitialStockInput = {
  userId: string;
  depositanteId: string;
  enderecoCodigo: string;
  produtoCodigo: string;
  quantidade: number;
  lote?: string | null;
  validadeEm?: string | null;
};

export async function registerInitialStock(input: RegisterInitialStockInput) {
  const supabase = createSupabaseAdminClient();

  const enderecoCodigo = input.enderecoCodigo.trim();
  const produtoCodigo = input.produtoCodigo.trim();
  const lote = input.lote?.trim() || null;
  const validadeEm = input.validadeEm?.trim() || null;

  const { data: endereco, error: enderecoError } = await supabase
    .from("enderecos")
    .select("id, codigo, area, ativo")
    .eq("codigo", enderecoCodigo)
    .eq("ativo", true)
    .maybeSingle();

  if (enderecoError) {
    throw new Error(`Falha ao localizar o endereço: ${enderecoError.message}`);
  }

  if (!endereco) {
    throw new Error("Endereço não encontrado ou inativo.");
  }

  const { data: produtos, error: produtoError } = await supabase
    .from("produtos")
    .select("id, nome, sku, codigo_interno, codigo_externo, exige_lote, exige_validade, ativo")
    .eq("depositante_id", input.depositanteId)
    .eq("ativo", true)
    .or(
      [
        `codigo_externo.eq.${escapeSupabaseValue(produtoCodigo)}`,
        `codigo_interno.eq.${escapeSupabaseValue(produtoCodigo)}`,
        `sku.eq.${escapeSupabaseValue(produtoCodigo)}`,
      ].join(","),
    )
    .limit(2);

  if (produtoError) {
    throw new Error(`Falha ao localizar o produto: ${produtoError.message}`);
  }

  if (!produtos?.length) {
    throw new Error("Produto não encontrado neste depositante.");
  }

  if (produtos.length > 1) {
    throw new Error("Mais de um produto corresponde ao código informado. Revise o cadastro.");
  }

  const produto = produtos[0];

  if (produto.exige_lote && !lote) {
    throw new Error("Este produto exige lote para o saldo inicial.");
  }

  if (produto.exige_validade && !validadeEm) {
    throw new Error("Este produto exige validade para o saldo inicial.");
  }

  let existingQuery = supabase
    .from("estoque")
    .select("id, quantidade, quantidade_reservada")
    .eq("depositante_id", input.depositanteId)
    .eq("produto_id", produto.id)
    .eq("endereco_id", endereco.id);

  existingQuery = lote ? existingQuery.eq("lote", lote) : existingQuery.is("lote", null);
  existingQuery = validadeEm
    ? existingQuery.eq("validade_em", validadeEm)
    : existingQuery.is("validade_em", null);

  const { data: existingRows, error: existingError } = await existingQuery.limit(2);

  if (existingError) {
    throw new Error(`Falha ao consultar o saldo atual: ${existingError.message}`);
  }

  if ((existingRows ?? []).length > 1) {
    throw new Error("Já existem múltiplas linhas para este produto no mesmo endereço. Revise o estoque.");
  }

  const existingStock = existingRows?.[0] ?? null;
  const previousQuantity = Number(existingStock?.quantidade ?? 0);
  const targetQuantity = input.quantidade;
  const difference = targetQuantity - previousQuantity;

  let estoqueId = existingStock?.id ?? null;

  if (existingStock) {
    const { error: updateError } = await supabase
      .from("estoque")
      .update({
        quantidade: targetQuantity,
      })
      .eq("id", existingStock.id);

    if (updateError) {
      throw new Error(`Falha ao atualizar o estoque: ${updateError.message}`);
    }
  } else {
    const { data: createdStock, error: createError } = await supabase
      .from("estoque")
      .insert({
        depositante_id: input.depositanteId,
        produto_id: produto.id,
        endereco_id: endereco.id,
        lote,
        validade_em: validadeEm,
        quantidade: targetQuantity,
      })
      .select("id")
      .single();

    if (createError || !createdStock) {
      throw new Error(`Falha ao criar o estoque inicial: ${createError?.message ?? "erro desconhecido"}`);
    }

    estoqueId = createdStock.id;
  }

  if (difference !== 0 && estoqueId) {
    const isPositive = difference > 0;
    const { error: movementError } = await supabase.from("movimentacoes_estoque").insert({
      depositante_id: input.depositanteId,
      estoque_id: estoqueId,
      produto_id: produto.id,
      endereco_origem_id: isPositive ? null : endereco.id,
      endereco_destino_id: isPositive ? endereco.id : null,
      tipo: isPositive ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
      quantidade: Math.abs(difference),
      referencia_tipo: "INVENTARIO_INICIAL",
      observacoes: `Carga inicial de estoque lançada manualmente para ${endereco.codigo}.`,
      criado_por: input.userId,
    });

    if (movementError) {
      throw new Error(`Falha ao registrar a movimentação: ${movementError.message}`);
    }
  }

  return {
    productName: produto.nome,
    sku: produto.sku ?? produto.codigo_interno ?? produto.codigo_externo ?? produto.id,
    enderecoCodigo: endereco.codigo,
    targetQuantity,
    difference,
  };
}

function escapeSupabaseValue(value: string) {
  return value.replaceAll(",", "\\,");
}
