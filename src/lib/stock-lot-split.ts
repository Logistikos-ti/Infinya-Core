import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SplitStockLotResult = {
  novoEstoqueId: string;
  novoLote: string;
  novaValidade: string | null;
  quantidadeNovoLote: number;
  quantidadeOrigemRestante: number;
  merged: boolean;
};

/**
 * Divide um saldo existente em dois lotes, movendo `quantity` unidades para
 * um lote/validade novos (ou mesclando com um lote já existente com essa
 * mesma identidade). Delegado inteiramente para a RPC `dividir_lote_estoque`,
 * que trava a linha de origem e valida o disponível no banco.
 */
export async function splitStockLot(input: {
  stockId: string;
  quantity: number;
  newLot: string;
  newExpiry: string | null;
  userId: string;
}): Promise<SplitStockLotResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("dividir_lote_estoque" as never, {
    p_estoque_id: input.stockId,
    p_quantidade: input.quantity,
    p_novo_lote: input.newLot,
    p_nova_validade: input.newExpiry,
    p_usuario_id: input.userId,
  } as never);

  if (error) {
    throw new Error(error.message || "Nao foi possivel dividir o lote.");
  }

  return data as SplitStockLotResult;
}
