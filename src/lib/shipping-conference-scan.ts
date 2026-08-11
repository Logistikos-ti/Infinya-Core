// Pure selection logic shared by the desktop (shipping-conference-panel.tsx)
// and mobile (mobile-conference-panel.tsx) conference scan handlers. Kept
// standalone (no React) so it's directly unit-testable -- see
// tests/unit/shipping-conference-scan.test.ts.
//
// Background: some invoices (notas fiscais) launch the same product as two
// (or more) separate line items instead of one line with the combined
// quantity (e.g. 1x + 1x instead of 2x). That produces two conference items
// that both accept the same barcode. The scan handlers used to always match
// the *first* item with a matching barcode, regardless of whether it was
// already fully conferred -- so once the first line reached its requested
// quantity, scanning the same code again matched that same completed line
// and errored with "já foi totalmente conferido" instead of advancing the
// second, still-pending line.

export type ConferenceScanCandidate = {
  /** Whether this item's scan targets (barcode/SKU/etc.) match the scanned code. */
  matches: boolean;
  /** Whether this item (or, for kits, all of its components) is already fully conferred. */
  fullyConferred: boolean;
};

/**
 * Picks which item a scanned code should apply to.
 *
 * Prefers the first matching item that still has pending quantity, so a
 * product split across multiple order lines (e.g. by an invoice quirk) can
 * be scanned once per unit across all of its lines. Falls back to the first
 * matching item (even if already complete) only when every matching item is
 * already fully conferred, so the correct "already conferred" message is
 * still shown in that case.
 *
 * Returns -1 when no candidate matches.
 */
export function pickConferenceScanMatchIndex(candidates: ConferenceScanCandidate[]): number {
  const pendingIndex = candidates.findIndex((candidate) => candidate.matches && !candidate.fullyConferred);
  if (pendingIndex !== -1) {
    return pendingIndex;
  }

  return candidates.findIndex((candidate) => candidate.matches);
}
