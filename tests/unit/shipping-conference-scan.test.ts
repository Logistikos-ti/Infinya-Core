// Regression test for the "nota fiscal lança o mesmo produto em duas
// linhas separadas e o segundo bipe erra 'já foi totalmente conferido'"
// bug in the shipping conference scan handlers.
//
// Run with:
//   node --experimental-strip-types --test tests/unit/shipping-conference-scan.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickConferenceScanMatchIndex } from "../../src/lib/shipping-conference-scan.ts";

test("no candidates match -> returns -1", () => {
  assert.equal(pickConferenceScanMatchIndex([]), -1);
  assert.equal(
    pickConferenceScanMatchIndex([
      { matches: false, fullyConferred: false },
      { matches: false, fullyConferred: true },
    ]),
    -1,
  );
});

test("a single pending match is picked", () => {
  assert.equal(
    pickConferenceScanMatchIndex([{ matches: true, fullyConferred: false }]),
    0,
  );
});

test("specifically: two lines for the same SKU (invoice split 1x + 1x) -- second scan advances the second, still-pending line instead of erroring on the first, already-complete line", () => {
  // This reproduces WMS-JOH-01102: item bipado 1/1 na primeira linha,
  // segunda linha continua 0/1. Antes do fix, o segundo bipe do mesmo
  // codigo sempre recaia no index 0 (ja completo) e retornava "-1 novo
  // match pendente", forcando o operador a ver "ja foi totalmente
  // conferido" em vez de avancar a segunda linha.
  const candidates = [
    { matches: true, fullyConferred: true }, // linha 1: 1/1
    { matches: true, fullyConferred: false }, // linha 2: 0/1
  ];

  assert.equal(pickConferenceScanMatchIndex(candidates), 1);
});

test("once every matching line is fully conferred, falls back to the first match so the 'already conferred' message is still shown", () => {
  const candidates = [
    { matches: true, fullyConferred: true },
    { matches: true, fullyConferred: true },
  ];

  assert.equal(pickConferenceScanMatchIndex(candidates), 0);
});

test("a non-matching item never wins over a matching one, regardless of order", () => {
  const candidates = [
    { matches: false, fullyConferred: false },
    { matches: true, fullyConferred: true },
    { matches: false, fullyConferred: false },
    { matches: true, fullyConferred: false },
  ];

  assert.equal(pickConferenceScanMatchIndex(candidates), 3);
});

test("three lines for the same SKU: scans fill the first pending line before moving to the next", () => {
  // linha 0 ja completa, linha 1 e linha 2 pendentes -> deve escolher a
  // linha 1 (primeira pendente), nao a linha 2.
  const candidates = [
    { matches: true, fullyConferred: true },
    { matches: true, fullyConferred: false },
    { matches: true, fullyConferred: false },
  ];

  assert.equal(pickConferenceScanMatchIndex(candidates), 1);
});
