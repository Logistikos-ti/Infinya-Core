import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function zeroStockBalance(stockId: string, userId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: stock, error } = await supabase
    .from("estoque")
    .select("id, depositante_id, produto_id, endereco_id, quantidade, quantidade_reservada")
    .eq("id", stockId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao localizar o saldo: ${error.message}`);
  }

  if (!stock) {
    throw new Error("Saldo de estoque não encontrado.");
  }

  const quantity = Number(stock.quantidade ?? 0);
  const reserved = Number(stock.quantidade_reservada ?? 0);

  if (reserved > 0) {
    throw new Error("Este saldo possui quantidade reservada e não pode ser zerado agora.");
  }

  if (quantity === 0) {
    return { alreadyZero: true };
  }

  const { error: updateError } = await supabase
    .from("estoque")
    .update({ quantidade: 0 })
    .eq("id", stock.id);

  if (updateError) {
    throw new Error(`Falha ao zerar o saldo: ${updateError.message}`);
  }

  const { error: movementError } = await supabase.from("movimentacoes_estoque").insert({
    depositante_id: stock.depositante_id,
    estoque_id: stock.id,
    produto_id: stock.produto_id,
    endereco_origem_id: stock.endereco_id,
    endereco_destino_id: null,
    tipo: "AJUSTE_NEGATIVO",
    quantidade: quantity,
    referencia_tipo: "AJUSTE_ADMINISTRATIVO",
    observacoes: "Saldo zerado manualmente por administrador no protocolo de estoque.",
    criado_por: userId,
  });

  if (movementError) {
    throw new Error(`Falha ao registrar o ajuste: ${movementError.message}`);
  }

  return { alreadyZero: false };
}

export async function deleteStockBalance(stockId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: stock, error } = await supabase
    .from("estoque")
    .select("id, quantidade, quantidade_reservada")
    .eq("id", stockId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao localizar o saldo: ${error.message}`);
  }

  if (!stock) {
    throw new Error("Saldo de estoque não encontrado.");
  }

  const quantity = Number(stock.quantidade ?? 0);
  const reserved = Number(stock.quantidade_reservada ?? 0);

  if (reserved > 0) {
    throw new Error("Este saldo possui quantidade reservada e não pode ser excluído.");
  }

  if (quantity !== 0) {
    throw new Error("Zere o saldo antes de excluir esta linha de estoque.");
  }

  const { error: deleteMovementsError } = await supabase
    .from("movimentacoes_estoque")
    .delete()
    .eq("estoque_id", stock.id);

  if (deleteMovementsError) {
    throw new Error(`Falha ao remover as movimentações: ${deleteMovementsError.message}`);
  }

  const { error: deleteStockError } = await supabase
    .from("estoque")
    .delete()
    .eq("id", stock.id);

  if (deleteStockError) {
    throw new Error(`Falha ao excluir a linha de estoque: ${deleteStockError.message}`);
  }
}
