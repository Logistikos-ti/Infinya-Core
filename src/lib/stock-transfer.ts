import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TransferStockInput = {
  userId: string;
  depositanteId: string;
  stockId: string;
  destinationAddressId: string;
  quantity: number;
};

export async function transferStockBalance(input: TransferStockInput) {
  const supabase = createSupabaseAdminClient();

  const { data: sourceStock, error: sourceError } = await supabase
    .from("estoque")
    .select(
      "id, depositante_id, produto_id, endereco_id, quantidade, quantidade_reservada, bloqueado, lote, validade_em, fabricacao_em",
    )
    .eq("id", input.stockId)
    .maybeSingle();

  if (sourceError) {
    throw new Error(`Falha ao localizar o saldo de origem: ${sourceError.message}`);
  }

  if (!sourceStock) {
    throw new Error("Saldo de origem não encontrado.");
  }

  if (sourceStock.depositante_id !== input.depositanteId) {
    throw new Error("O saldo selecionado não pertence ao depositante informado.");
  }

  if (sourceStock.bloqueado) {
    throw new Error("Não é possível transferir um saldo bloqueado.");
  }

  const sourceQuantity = Number(sourceStock.quantidade ?? 0);
  const reservedQuantity = Number(sourceStock.quantidade_reservada ?? 0);
  const availableQuantity = Math.max(sourceQuantity - reservedQuantity, 0);

  if (input.quantity <= 0) {
    throw new Error("Informe uma quantidade maior que zero para transferir.");
  }

  if (input.quantity > availableQuantity) {
    throw new Error("A quantidade solicitada é maior do que o saldo disponível para transferência.");
  }

  const { data: destinationAddress, error: destinationAddressError } = await supabase
    .from("enderecos")
    .select("id, codigo, ativo")
    .eq("id", input.destinationAddressId)
    .maybeSingle();

  if (destinationAddressError) {
    throw new Error(
      `Falha ao localizar o endereço de destino: ${destinationAddressError.message}`,
    );
  }

  if (!destinationAddress || !destinationAddress.ativo) {
    throw new Error("Endereço de destino não encontrado ou inativo.");
  }

  if (destinationAddress.id === sourceStock.endereco_id) {
    throw new Error("Escolha um endereço de destino diferente do endereço de origem.");
  }

  const { data: sourceAddress } = await supabase
    .from("enderecos")
    .select("id, codigo")
    .eq("id", sourceStock.endereco_id)
    .maybeSingle();

  let targetQuery = supabase
    .from("estoque")
    .select("id, quantidade")
    .eq("depositante_id", sourceStock.depositante_id)
    .eq("produto_id", sourceStock.produto_id)
    .eq("endereco_id", destinationAddress.id)
    .eq("bloqueado", false);

  targetQuery =
    sourceStock.lote !== null
      ? targetQuery.eq("lote", sourceStock.lote)
      : targetQuery.is("lote", null);
  targetQuery =
    sourceStock.validade_em !== null
      ? targetQuery.eq("validade_em", sourceStock.validade_em)
      : targetQuery.is("validade_em", null);

  const { data: targetRows, error: targetError } = await targetQuery.limit(2);

  if (targetError) {
    throw new Error(`Falha ao localizar o saldo de destino: ${targetError.message}`);
  }

  if ((targetRows ?? []).length > 1) {
    throw new Error(
      "Já existem múltiplas linhas compatíveis no endereço de destino. Revise o estoque antes de transferir.",
    );
  }

  const targetStock = targetRows?.[0] ?? null;
  const sourceRemainingQuantity = sourceQuantity - input.quantity;
  let destinationStockId = targetStock?.id ?? null;

  const { error: sourceUpdateError } = await supabase
    .from("estoque")
    .update({ quantidade: sourceRemainingQuantity })
    .eq("id", sourceStock.id);

  if (sourceUpdateError) {
    throw new Error(`Falha ao atualizar o saldo de origem: ${sourceUpdateError.message}`);
  }

  if (targetStock) {
    const destinationQuantity = Number(targetStock.quantidade ?? 0) + input.quantity;
    const { error: targetUpdateError } = await supabase
      .from("estoque")
      .update({ quantidade: destinationQuantity })
      .eq("id", targetStock.id);

    if (targetUpdateError) {
      throw new Error(`Falha ao atualizar o saldo de destino: ${targetUpdateError.message}`);
    }
  } else {
    const { data: createdDestinationStock, error: createTargetError } = await supabase
      .from("estoque")
      .insert({
        depositante_id: sourceStock.depositante_id,
        produto_id: sourceStock.produto_id,
        endereco_id: destinationAddress.id,
        quantidade: input.quantity,
        quantidade_reservada: 0,
        bloqueado: false,
        lote: sourceStock.lote,
        validade_em: sourceStock.validade_em,
        fabricacao_em: sourceStock.fabricacao_em,
      })
      .select("id")
      .single();

    if (createTargetError || !createdDestinationStock) {
      throw new Error(
        `Falha ao criar o saldo de destino: ${createTargetError?.message ?? "erro desconhecido"}`,
      );
    }

    destinationStockId = createdDestinationStock.id;
  }

  if (!destinationStockId) {
    throw new Error("Não foi possível determinar o saldo de destino após a transferência.");
  }

  const transferReferenceId = randomUUID();
  const baseMovement = {
    depositante_id: sourceStock.depositante_id,
    produto_id: sourceStock.produto_id,
    quantidade: input.quantity,
    tipo: "TRANSFERENCIA",
    referencia_tipo: "TRANSFERENCIA_INTERNA",
    referencia_id: transferReferenceId,
    observacoes: `Transferência interna de ${sourceAddress?.codigo ?? "origem"} para ${destinationAddress.codigo}.`,
    criado_por: input.userId,
    endereco_origem_id: sourceStock.endereco_id,
    endereco_destino_id: destinationAddress.id,
  };

  const { error: movementError } = await supabase.from("movimentacoes_estoque").insert([
    {
      ...baseMovement,
      estoque_id: sourceStock.id,
    },
    {
      ...baseMovement,
      estoque_id: destinationStockId,
    },
  ]);

  if (movementError) {
    throw new Error(`Falha ao registrar a transferência: ${movementError.message}`);
  }

  return {
    sourceStockId: sourceStock.id,
    destinationStockId,
    sourceRemainingQuantity,
    transferredQuantity: input.quantity,
    sourceAddressCode: sourceAddress?.codigo ?? "Origem",
    destinationAddressCode: destinationAddress.codigo,
  };
}
