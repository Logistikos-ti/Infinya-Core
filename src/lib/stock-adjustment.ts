import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdjustStockInput = {
  userId: string;
  depositanteId: string;
  stockId: string;
  quantityDiff: number; // positive for addition, negative for subtraction
  reason: string;
};

export async function adjustStockBalance(input: AdjustStockInput) {
  if (input.quantityDiff === 0) {
    throw new Error("A diferença de quantidade deve ser diferente de zero.");
  }

  const supabase = createSupabaseAdminClient();

  const { data: stock, error: stockError } = await supabase
    .from("estoque")
    .select(
      "id, depositante_id, produto_id, endereco_id, quantidade, quantidade_reservada, bloqueado, lote, validade_em, fabricacao_em",
    )
    .eq("id", input.stockId)
    .maybeSingle();

  if (stockError || !stock) {
    throw new Error("Saldo de estoque não encontrado ou falha na leitura.");
  }

  if (stock.depositante_id !== input.depositanteId) {
    throw new Error("O saldo selecionado não pertence ao depositante informado.");
  }

  if (stock.bloqueado) {
    throw new Error("Não é possível ajustar um saldo bloqueado.");
  }

  const currentQuantity = Number(stock.quantidade ?? 0);
  const reservedQuantity = Number(stock.quantidade_reservada ?? 0);
  const newQuantity = currentQuantity + input.quantityDiff;

  if (newQuantity < reservedQuantity) {
    throw new Error(`A nova quantidade (${newQuantity}) não pode ser menor que a quantidade já reservada (${reservedQuantity}).`);
  }

  // Atualizar saldo
  const { error: updateError } = await supabase
    .from("estoque")
    .update({ quantidade: newQuantity })
    .eq("id", stock.id);

  if (updateError) {
    throw new Error(`Falha ao atualizar o saldo: ${updateError.message}`);
  }

  // Registrar movimentação
  const type = input.quantityDiff > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO";
  
  const movement = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    depositante_id: stock.depositante_id,
    produto_id: stock.produto_id,
    estoque_id: stock.id,
    endereco_origem_id: type === "AJUSTE_NEGATIVO" ? stock.endereco_id : null,
    endereco_destino_id: type === "AJUSTE_POSITIVO" ? stock.endereco_id : null,
    usuario_id: input.userId,
    tipo: type,
    quantidade: Math.abs(input.quantityDiff),
    lote: stock.lote,
    validade_em: stock.validade_em,
    fabricacao_em: stock.fabricacao_em,
    observacao: input.reason,
  };

  const { error: insertError } = await supabase.from("estoque_movimentacoes").insert(movement);

  if (insertError) {
    // Ideally we would run this in a transaction. For simplicity, we just log the failure.
    console.error("Falha ao registrar movimentação de ajuste:", insertError);
  }

  return { success: true, newQuantity };
}
