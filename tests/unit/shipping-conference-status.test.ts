// Regression test for the "danfe_conferida_em gravado duas vezes" bug (a
// duplicate/stale saveShippingConferenceAction submission silently
// re-finalizing an order that already left conference) -- see the commit
// that added src/lib/shipping-conference-status.ts, and the picking-side
// equivalent tests/unit/shipping-picking-status.test.ts.
//
// Run with:
//   node --experimental-strip-types --test tests/unit/shipping-conference-status.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFERENCE_EDITABLE_STATUSES,
  isConferenceStatusEditable,
} from "../../src/lib/shipping-conference-status.ts";

// Every status a pedido can be in that a conference save action must never
// touch again -- either it hasn't reached conference yet, or it already left
// it. None of these should ever have their status/payload_origem rewritten
// by saveShippingConferenceAction, no matter which intent was submitted.
const NON_EDITABLE_STATUSES = [
  "NOVO",
  "EM_SEPARACAO",
  "CONFERIDO",
  "PRONTO_ROMANEIO",
  "EXPEDIDO",
  "CANCELADO",
  "EM_CANCELAMENTO",
  "EM_DIVERGENCIA",
];

test("rejects every status outside the conference window", () => {
  for (const status of NON_EDITABLE_STATUSES) {
    assert.equal(
      isConferenceStatusEditable(status),
      false,
      `expected ${status} to be rejected as non-editable for conference`,
    );
  }
});

test("specifically: a PRONTO_ROMANEIO order (WMS-1680) is not editable -- the exact regression", () => {
  // This is the real-world shape of the bug: the order already reached
  // PRONTO_ROMANEIO via a first "concluir conferência" click; a duplicate
  // submission of the same form must not be allowed to re-finalize it.
  assert.equal(isConferenceStatusEditable("PRONTO_ROMANEIO"), false);
});

test("accepts the two statuses conference actions are meant to operate on", () => {
  for (const status of CONFERENCE_EDITABLE_STATUSES) {
    assert.equal(isConferenceStatusEditable(status), true);
  }
  assert.deepEqual([...CONFERENCE_EDITABLE_STATUSES].sort(), ["EM_CONFERENCIA", "SEPARADO"]);
});
