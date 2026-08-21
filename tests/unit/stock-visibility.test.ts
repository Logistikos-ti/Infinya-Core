import { test } from "node:test";
import assert from "node:assert/strict";
import { isHiddenLegacyDamageEntry } from "../../src/lib/stock-visibility.ts";

test("hides damage entries before 19 August 2026 in Sao Paulo", () => {
  assert.equal(
    isHiddenLegacyDamageEntry({
      createdAt: "2026-08-19T02:59:59.999Z",
      type: "AVARIA",
    }),
    true,
  );
});

test("keeps damage entries from the cutoff onwards", () => {
  assert.equal(
    isHiddenLegacyDamageEntry({
      createdAt: "2026-08-19T03:00:00.000Z",
      description: "Avaria identificada",
    }),
    false,
  );
});

test("keeps unrelated historical stock entries", () => {
  assert.equal(
    isHiddenLegacyDamageEntry({
      createdAt: "2026-08-18T12:00:00.000Z",
      type: "INVENTARIO",
      description: "Ajuste de contagem",
    }),
    false,
  );
});

test("recognizes damage descriptions regardless of accents or case", () => {
  assert.equal(
    isHiddenLegacyDamageEntry({
      createdAt: "2026-08-18T12:00:00.000Z",
      description: "Correção para baixa de AVARIA",
    }),
    true,
  );
});
