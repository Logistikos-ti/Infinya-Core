// Regression test for the "pedido volta para conferência após ser liberado
// via DANFE" bug (see the commit that added src/lib/shipping-picking-status.ts).
//
// Run with:
//   node --experimental-strip-types --test tests/unit/shipping-picking-status.test.ts
// (Node's built-in test runner + TypeScript type-stripping -- no extra
// dependency needed. Node 22.6+ required; this repo runs Node 24.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveNextPickingStatus,
  canResetPickingOrderToQueue,
  PICKING_EDITABLE_STATUSES,
} from "../../src/lib/shipping-picking-status.ts";

// Every status a pedido can reach once it has moved past picking. None of
// these should ever be touched by a picking save/autosave action, no
// matter the intent or item-completeness combination.
const POST_PICKING_STATUSES = ["EM_CONFERENCIA", "CONFERIDO", "PRONTO_ROMANEIO", "EXPEDIDO", "CANCELADO"];

test("preserves any post-picking status regardless of intent or item completeness (the actual bug)", () => {
  for (const currentStatus of POST_PICKING_STATUSES) {
    for (const intent of ["complete", "draft"] as const) {
      for (const itemsComplete of [true, false]) {
        for (const keepStatusIfIncomplete of [true, false]) {
          const next = resolveNextPickingStatus({
            currentStatus,
            intent,
            itemsComplete,
            keepStatusIfIncomplete,
          });
          assert.equal(
            next,
            currentStatus,
            `expected ${currentStatus} to be preserved (intent=${intent}, itemsComplete=${itemsComplete}, keepStatusIfIncomplete=${keepStatusIfIncomplete}), got ${next}`,
          );
        }
      }
    }
  }
});

test("specifically: a PRONTO_ROMANEIO order untouched by a wave draft autosave", () => {
  // This is the exact real-world shape of the bug: savePickingWaveDraftAction
  // recomputes status from item completeness alone (no "intent" concept),
  // and the order's items are still fully separated (nobody un-separated
  // anything) even though the order itself has already been released to
  // romaneio by a different operator via DANFE scan.
  const next = resolveNextPickingStatus({
    currentStatus: "PRONTO_ROMANEIO",
    intent: "complete",
    itemsComplete: true,
  });
  assert.equal(next, "PRONTO_ROMANEIO");
});

test("completing picking with all items separated moves an editable order to SEPARADO", () => {
  for (const currentStatus of PICKING_EDITABLE_STATUSES) {
    const next = resolveNextPickingStatus({
      currentStatus,
      intent: "complete",
      itemsComplete: true,
    });
    assert.equal(next, "SEPARADO");
  }
});

test("a draft save on an editable order always lands on EM_SEPARACAO", () => {
  for (const currentStatus of PICKING_EDITABLE_STATUSES) {
    for (const itemsComplete of [true, false]) {
      const next = resolveNextPickingStatus({ currentStatus, intent: "draft", itemsComplete });
      assert.equal(next, "EM_SEPARACAO");
    }
  }
});

test("completing with items still pending downgrades to EM_SEPARACAO by default", () => {
  const next = resolveNextPickingStatus({
    currentStatus: "SEPARADO",
    intent: "complete",
    itemsComplete: false,
  });
  assert.equal(next, "EM_SEPARACAO");
});

test("keepStatusIfIncomplete leaves the order exactly as found instead of downgrading it", () => {
  const next = resolveNextPickingStatus({
    currentStatus: "SEPARADO",
    intent: "complete",
    itemsComplete: false,
    keepStatusIfIncomplete: true,
  });
  assert.equal(next, "SEPARADO");
});

// --- Wave-level reset guard (deleting a wave / returning it to the queue) ---
// Regression test for "finalizamos a onda, ela fica concluída, mas ao criar
// uma nova onda os pedidos já separados aparecem de novo pra separar".

test("a wave reset never drags an order that already advanced past picking back to the queue (the actual bug)", () => {
  for (const currentStatus of POST_PICKING_STATUSES) {
    assert.equal(
      canResetPickingOrderToQueue(currentStatus),
      false,
      `${currentStatus} must never be reset back to NOVO by a wave delete/return`,
    );
  }
});

test("specifically: deleting a concluded wave must not resurrect an EXPEDIDO or PRONTO_ROMANEIO order", () => {
  assert.equal(canResetPickingOrderToQueue("EXPEDIDO"), false);
  assert.equal(canResetPickingOrderToQueue("PRONTO_ROMANEIO"), false);
  assert.equal(canResetPickingOrderToQueue("CONFERIDO"), false);
  assert.equal(canResetPickingOrderToQueue("EM_CONFERENCIA"), false);
});

test("orders still in the picking stage remain resettable, so cancelling/deleting a genuinely in-progress wave still works", () => {
  for (const currentStatus of PICKING_EDITABLE_STATUSES) {
    assert.equal(
      canResetPickingOrderToQueue(currentStatus),
      true,
      `${currentStatus} should still be returnable to the picking queue`,
    );
  }
});

test("an unknown/empty status is never resettable (fails closed)", () => {
  assert.equal(canResetPickingOrderToQueue(""), false);
  assert.equal(canResetPickingOrderToQueue("STATUS_INEXISTENTE"), false);
});
