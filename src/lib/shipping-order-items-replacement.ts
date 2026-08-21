import type { SupabaseClient } from "@supabase/supabase-js";

export type ShippingOrderItemPayload = {
  pedido_expedicao_id: string;
  depositante_id: string;
  referencia_externa: string | null;
  produto_id: string | null;
  codigo_produto: string | null;
  sku: string | null;
  nome: string;
  unidade: string | null;
  quantidade: number;
  quantidade_separada: number;
  payload_origem: unknown;
};

type StoredShippingOrderItem = ShippingOrderItemPayload & {
  id: string;
  created_at: string;
  updated_at: string;
};

export class ShippingOrderItemsReplacementError extends Error {
  readonly databaseError: { message: string };

  constructor(message: string, databaseError: { message: string }) {
    super(message);
    this.name = "ShippingOrderItemsReplacementError";
    this.databaseError = databaseError;
  }
}

/**
 * Replaces integration items while preserving the previous order if the new
 * payload cannot reserve stock. Database triggers release and recreate the
 * reservation as each old/new item is deleted or inserted.
 */
export async function replaceShippingOrderItems({
  adminSupabase,
  orderId,
  items,
  removeNewOrderOnFailure,
}: {
  adminSupabase: SupabaseClient;
  orderId: string;
  items: ShippingOrderItemPayload[];
  removeNewOrderOnFailure: boolean;
}) {
  const { data: previousItems, error: readError } = await adminSupabase
    .from("pedidos_expedicao_itens")
    .select(
      "id, pedido_expedicao_id, depositante_id, referencia_externa, produto_id, codigo_produto, sku, nome, unidade, quantidade, quantidade_separada, payload_origem, created_at, updated_at",
    )
    .eq("pedido_expedicao_id", orderId);

  if (readError) {
    throw new ShippingOrderItemsReplacementError(readError.message, readError);
  }

  const storedItems = (previousItems ?? []) as StoredShippingOrderItem[];
  const { error: deleteError } = await adminSupabase
    .from("pedidos_expedicao_itens")
    .delete()
    .eq("pedido_expedicao_id", orderId);

  if (deleteError) {
    throw new ShippingOrderItemsReplacementError(deleteError.message, deleteError);
  }

  if (!items.length) return;

  const { error: insertError } = await adminSupabase.from("pedidos_expedicao_itens").insert(items);
  if (!insertError) return;

  if (storedItems.length) {
    const { error: restoreError } = await adminSupabase.from("pedidos_expedicao_itens").insert(storedItems);
    if (restoreError) {
      throw new ShippingOrderItemsReplacementError(
        `${insertError.message} O pedido anterior também não pôde ser restaurado: ${restoreError.message}`,
        insertError,
      );
    }
  } else if (removeNewOrderOnFailure) {
    await adminSupabase.from("pedidos_expedicao").delete().eq("id", orderId);
  }

  throw new ShippingOrderItemsReplacementError(insertError.message, insertError);
}
