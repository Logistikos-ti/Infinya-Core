// Pure status-resolution logic for the picking/separação save actions in
// src/app/(dashboard)/expedicao/separacao/actions.ts. Kept as a standalone,
// framework-free module (no "use server", no Supabase, no Next imports) so
// it can be unit-tested directly -- see tests/unit/shipping-picking-status.test.ts.
//
// Background: a pedido that has advanced past picking (EM_CONFERENCIA,
// CONFERIDO, PRONTO_ROMANEIO, EXPEDIDO, CANCELADO) must never have its
// status column touched by a picking save/auto-save action. Before this was
// centralized, three separate call sites each recomputed the status inline
// with only "preserve CANCELADO" as a guard, so a stale separação tab left
// open after a wave had already moved on could silently clobber an order
// that another operator had already released to conferência/romaneio back
// to SEPARADO -- the order would vanish from the conference queue and then
// reappear "uns minutos depois" the next time the picking tab's debounced
// autosave fired.

/** Statuses where a picking save action is allowed to change order.status. */
export const PICKING_EDITABLE_STATUSES = new Set(["NOVO", "EM_SEPARACAO", "SEPARADO"]);

export type ResolvePickingStatusParams = {
  /** The order's current status column value, read fresh right before the update. */
  currentStatus: string;
  /**
   * "complete" == the operator is finishing picking now (either this single
   * order or the whole wave). "draft" == an in-progress save (manual "save
   * without finishing" or the wave interface's debounced autosave).
   */
  intent: "complete" | "draft";
  /** Whether every requested unit across the order's items has been separated. */
  itemsComplete: boolean;
  /**
   * Only matters when intent is "complete" and itemsComplete is false: some
   * call sites leave the order exactly as found instead of downgrading it to
   * EM_SEPARACAO. Defaults to false (downgrade), matching the two wave-level
   * actions; the single-order save action passes true to keep its original
   * behavior unchanged by this refactor.
   */
  keepStatusIfIncomplete?: boolean;
};

/**
 * Resolves the next pedidos_expedicao.status for a picking save action.
 * Returns currentStatus unchanged whenever it is outside
 * PICKING_EDITABLE_STATUSES -- this is the actual regression guard.
 */
export function resolveNextPickingStatus({
  currentStatus,
  intent,
  itemsComplete,
  keepStatusIfIncomplete = false,
}: ResolvePickingStatusParams): string {
  if (!PICKING_EDITABLE_STATUSES.has(currentStatus)) {
    return currentStatus;
  }

  if (intent === "complete") {
    if (itemsComplete) {
      return "SEPARADO";
    }
    return keepStatusIfIncomplete ? currentStatus : "EM_SEPARACAO";
  }

  return "EM_SEPARACAO";
}

/**
 * Whether an order may be thrown back to the picking queue (status NOVO,
 * quantidade_separada zeroed) by a wave-level reset -- i.e. deleting a wave
 * or returning it to the queue after a cancellation/inactivity.
 *
 * Same guard set as PICKING_EDITABLE_STATUSES, but this is a separate,
 * explicitly-named entry point because the failure mode is different and
 * much more destructive: those resets do not just recompute a status, they
 * also wipe every item's quantidade_separada. Without this check, deleting
 * an already-CONCLUIDA wave (a natural "clean up the list" action) dragged
 * every order in it back to NOVO -- including orders that had long since
 * moved on to EM_CONFERENCIA / CONFERIDO / PRONTO_ROMANEIO / EXPEDIDO --
 * making already-separated (and even already-shipped) pedidos reappear in
 * the "criar onda" list to be picked all over again.
 */
export function canResetPickingOrderToQueue(currentStatus: string): boolean {
  return PICKING_EDITABLE_STATUSES.has(currentStatus);
}
