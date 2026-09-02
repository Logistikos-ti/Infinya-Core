import assert from "node:assert/strict";
import { test } from "node:test";
import {
  matchesCycleCountProduct,
  resolveCycleCountScan,
  type CycleCountScanProduct,
} from "../../src/lib/cycle-count-scan.ts";

const PRODUCT: CycleCountScanProduct = {
  barcode: "7891234567890",
  codigoInterno: "INT-42",
  sku: "SKU-42",
};

test("matchesCycleCountProduct casa por barcode, codigoInterno e sku, ignorando formatação", () => {
  assert.equal(matchesCycleCountProduct("789 1234 567890", PRODUCT), true);
  assert.equal(matchesCycleCountProduct("int-42", PRODUCT), true);
  assert.equal(matchesCycleCountProduct("sku-42", PRODUCT), true);
  assert.equal(matchesCycleCountProduct("outro-codigo", PRODUCT), false);
});

test("produto sem barcode/codigoInterno ainda casa pelo sku", () => {
  const product: CycleCountScanProduct = { barcode: null, codigoInterno: null, sku: "SO-SKU" };
  assert.equal(matchesCycleCountProduct("so-sku", product), true);
});

test("código sem match -> not-found", () => {
  const decision = resolveCycleCountScan("codigo-errado", { product: PRODUCT, currentCount: 0, quantidadeSistema: 5 });
  assert.deepEqual(decision, { kind: "not-found" });
});

test("bipe abaixo do limite -> increment sem completar", () => {
  const decision = resolveCycleCountScan("SKU-42", { product: PRODUCT, currentCount: 2, quantidadeSistema: 5 });
  assert.deepEqual(decision, { kind: "increment", nextCount: 3, complete: false });
});

test("bipe que fecha exatamente no limite -> increment com complete=true", () => {
  const decision = resolveCycleCountScan("SKU-42", { product: PRODUCT, currentCount: 4, quantidadeSistema: 5 });
  assert.deepEqual(decision, { kind: "increment", nextCount: 5, complete: true });
});

test("bipe além do limite -> surplus-prompt, sem incrementar", () => {
  const decision = resolveCycleCountScan("SKU-42", { product: PRODUCT, currentCount: 5, quantidadeSistema: 5 });
  assert.deepEqual(decision, { kind: "surplus-prompt" });
});

test("contagem cega (quantidadeSistema=0): primeiro bipe já é excedente", () => {
  const decision = resolveCycleCountScan("SKU-42", { product: PRODUCT, currentCount: 0, quantidadeSistema: 0 });
  assert.deepEqual(decision, { kind: "surplus-prompt" });
});
