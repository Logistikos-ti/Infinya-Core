// Pure quantity-resolution logic shared by the desktop
// (shipping-picking-interface.tsx) and mobile (mobile-wave-picking-panel.tsx)
// wave picking scan handlers. Kept standalone (no React, no server actions)
// so it's directly unit-testable -- see
// tests/unit/shipping-picking-scan.test.ts.
//
// Background: products like Dêvi's have two barcodes -- one for the loose
// unit and one for the sealed pack/caixa (quantidade_por_embalagem units per
// pack). Both scan handlers already accepted the pack barcode as a valid
// code for the item, but always incremented the separated quantity by
// exactly 1 regardless of which code was scanned -- bipar a caixa inteira
// só contava 1 unidade em vez das N unidades que ela realmente contém.

/**
 * How many units a single scan should add to the item's separated quantity.
 * Returns 1 for anything that isn't specifically the pack barcode (unit
 * barcode, SKU, internal code, or any other accepted scanTarget).
 */
export function resolveScannedPickingQuantity({
  isPackMatch,
  packQuantity,
}: {
  isPackMatch: boolean;
  packQuantity: number | string | null | undefined;
}): number {
  if (!isPackMatch) {
    return 1;
  }

  const parsed = Math.floor(Number(packQuantity));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
