// Regression test for the cancellation-with-return-scan flow's status gate
// (see src/lib/shipping-cancellation-status.ts).
//
// Run with:
//   node --experimental-strip-types --test tests/unit/shipping-cancellation-status.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requiresBipagemForCancellation,
  resolveCancellationLineStatus,
} from "../../src/lib/shipping-cancellation-status.ts";

const POST_NOVO_STATUSES = [
  "EM_SEPARACAO",
  "SEPARADO",
  "EM_CONFERENCIA",
  "CONFERIDO",
  "PRONTO_ROMANEIO",
  "EXPEDIDO",
];

test("bipagem is required for every status once stock could already have left the shelf", () => {
  for (const status of POST_NOVO_STATUSES) {
    assert.equal(
      requiresBipagemForCancellation(status),
      true,
      `${status} should require the scan-to-return flow`,
    );
  }
});

test("a NOVO order cancels instantly -- nothing physical to return yet", () => {
  assert.equal(requiresBipagemForCancellation("NOVO"), false);
});

test("an already-CANCELADO order never re-triggers the flow", () => {
  assert.equal(requiresBipagemForCancellation("CANCELADO"), false);
});

test("resolveCancellationLineStatus: incomplete confirmation stays PENDENTE", () => {
  assert.equal(
    resolveCancellationLineStatus({ quantidadeEsperada: 3, quantidadeConfirmada: 2 }),
    "PENDENTE",
  );
});

test("resolveCancellationLineStatus: confirmation reaching the expected quantity concludes the line", () => {
  assert.equal(
    resolveCancellationLineStatus({ quantidadeEsperada: 3, quantidadeConfirmada: 3 }),
    "CONCLUIDO",
  );
});

test("resolveCancellationLineStatus: never regresses to PENDENTE past the expected quantity", () => {
  assert.equal(
    resolveCancellationLineStatus({ quantidadeEsperada: 3, quantidadeConfirmada: 4 }),
    "CONCLUIDO",
  );
});
