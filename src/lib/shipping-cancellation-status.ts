// Pure status-resolution logic for the cancellation-with-return-scan flow in
// src/app/(dashboard)/expedicao/cancelamento/actions.ts. Kept as a
// standalone, framework-free module (no "use server", no Supabase, no Next
// imports) so it can be unit-tested directly -- see
// tests/unit/shipping-cancellation-status.test.ts. Mirrors the shape of
// src/lib/shipping-picking-status.ts.

/**
 * Whether cancelling an order at this status requires the mandatory
 * scan-to-return-to-stock process instead of an instant status flip. Only
 * NOVO (nothing physical has left the shelf yet) and an already-CANCELADO
 * order skip it.
 */
export function requiresBipagemForCancellation(status: string): boolean {
  return status !== "NOVO" && status !== "CANCELADO";
}

export type CancellationLineStatus = "PENDENTE" | "CONCLUIDO";

/**
 * Mirrors concluir/registrar_bipagem_cancelamento_expedicao's own
 * status-resolution so the UI can reflect scan progress optimistically
 * without waiting on a round-trip.
 */
export function resolveCancellationLineStatus(params: {
  quantidadeEsperada: number;
  quantidadeConfirmada: number;
}): CancellationLineStatus {
  return params.quantidadeConfirmada >= params.quantidadeEsperada ? "CONCLUIDO" : "PENDENTE";
}
