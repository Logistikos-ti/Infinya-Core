import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ManualStockEntryInput = {
  userId: string;
  depositanteId: string;
  stockId: string;
  quantity: number;
  reason: string;
};

export async function createManualStockEntry(input: ManualStockEntryInput) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Informe uma quantidade maior que zero para a entrada.");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Informe o motivo da entrada manual.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: stock, error: stockError } = await supabase
    .from("estoque")
    .select("id, depositante_id, produto_id, endereco_id, quantidade, bloqueado")
    .eq("id", input.stockId)
    .maybeSingle();

  if (stockError) {
    throw new Error(`Falha ao localizar o saldo: ${stockError.message}`);
  }
  if (!stock) {
    throw new Error("Saldo de estoque não encontrado.");
  }
  if (stock.depositante_id !== input.depositanteId) {
    throw new Error("O saldo selecionado não pertence ao depositante informado.");
  }
  if (stock.bloqueado) {
    throw new Error("Não é possível dar entrada em um saldo bloqueado.");
  }

  const currentQuantity = Number(stock.quantidade ?? 0);
  const nextQuantity = currentQuantity + input.quantity;

  const { data: updatedRows, error: updateError } = await supabase
    .from("estoque")
    .update({ quantidade: nextQuantity })
    .eq("id", stock.id)
    .eq("quantidade", currentQuantity)
    .select("id");

  if (updateError) {
    throw new Error(`Falha ao atualizar o saldo: ${updateError.message}`);
  }
  if (!updatedRows?.length) {
    throw new Error("O saldo foi alterado por outra operação. Atualize a tela e tente novamente.");
  }

  const { error: movementError } = await supabase.from("movimentacoes_estoque").insert({
    depositante_id: stock.depositante_id,
    estoque_id: stock.id,
    produto_id: stock.produto_id,
    endereco_origem_id: null,
    endereco_destino_id: stock.endereco_id,
    tipo: "ENTRADA",
    quantidade: input.quantity,
    referencia_tipo: "ENTRADA_MANUAL",
    observacoes: reason,
    criado_por: input.userId,
  });

  if (movementError) {
    await supabase
      .from("estoque")
      .update({ quantidade: currentQuantity })
      .eq("id", stock.id)
      .eq("quantidade", nextQuantity);
    throw new Error(`Falha ao registrar a entrada manual: ${movementError.message}`);
  }

  return { previousQuantity: currentQuantity, nextQuantity };
}
