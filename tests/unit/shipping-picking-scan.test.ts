// Regression test for the "bipar o código de pack conta como 1 unidade em
// vez da quantidade da caixa" bug (Dêvi's products, which have a separate
// barcode for the sealed pack/caixa).
//
// Run with:
//   node --experimental-strip-types --test tests/unit/shipping-picking-scan.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveScannedPickingQuantity } from "../../src/lib/shipping-picking-scan.ts";

test("a unit/SKU/internal-code scan always adds exactly 1, regardless of packQuantity", () => {
  for (const packQuantity of [1, 6, 12, 24, null, undefined, 0, -3, "abc"]) {
    const quantity = resolveScannedPickingQuantity({ isPackMatch: false, packQuantity: packQuantity as never });
    assert.equal(quantity, 1, `expected 1 for packQuantity=${packQuantity}, got ${quantity}`);
  }
});

test("a pack scan adds the product's packQuantity", () => {
  assert.equal(resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: 12 }), 12);
  assert.equal(resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: 6 }), 6);
  assert.equal(resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: "24" }), 24);
});

test("specifically: a pack scan does NOT fall back to 1 (the actual bug)", () => {
  // Before the fix, both scan handlers always did `separated + 1` no matter
  // which accepted code was scanned, so a caixa of 12 units only counted 1.
  const quantity = resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: 12 });
  assert.notEqual(quantity, 1);
  assert.equal(quantity, 12);
});

test("a malformed/missing packQuantity on a pack scan falls back to 1 instead of crashing or going negative", () => {
  assert.equal(resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: null }), 1);
  assert.equal(resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: undefined }), 1);
  assert.equal(resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: 0 }), 1);
  assert.equal(resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: -5 }), 1);
  assert.equal(resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: "not-a-number" }), 1);
});

test("fractional packQuantity is floored", () => {
  assert.equal(resolveScannedPickingQuantity({ isPackMatch: true, packQuantity: 12.9 }), 12);
});
