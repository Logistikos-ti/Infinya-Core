/**
 * Pure decision logic for the scan-driven Contagem Cíclica flow. Unlike
 * general-inventory-scan.ts there is no "which item" resolution here --
 * inventario-scan-client.tsx already resolved a single stock position
 * (estoqueId) before this screen loads, so every scan either matches that
 * one product or it doesn't.
 */

export type CycleCountScanProduct = {
  barcode: string | null;
  codigoInterno: string | null;
  sku: string;
};

export type CycleCountScanState = {
  product: CycleCountScanProduct;
  currentCount: number;
  quantidadeSistema: number;
};

export type CycleCountScanDecision =
  | { kind: "not-found" }
  | { kind: "increment"; nextCount: number; complete: boolean }
  | { kind: "surplus-prompt" };

export function normalizeScan(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

export function matchesCycleCountProduct(rawCode: string, product: CycleCountScanProduct): boolean {
  const normalized = normalizeScan(rawCode);
  if (!normalized) return false;

  return [product.barcode, product.codigoInterno, product.sku]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizeScan(value) === normalized);
}

export function resolveCycleCountScan(rawCode: string, state: CycleCountScanState): CycleCountScanDecision {
  if (!matchesCycleCountProduct(rawCode, state.product)) {
    return { kind: "not-found" };
  }

  if (state.currentCount >= state.quantidadeSistema) {
    return { kind: "surplus-prompt" };
  }

  const nextCount = state.currentCount + 1;
  return { kind: "increment", nextCount, complete: nextCount >= state.quantidadeSistema };
}
