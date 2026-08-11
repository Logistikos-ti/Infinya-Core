// Tests for the picking-wave grouping/distribution logic used to combine
// the same product across different orders in the same wave into a single
// pick step. Run with:
//   node --experimental-strip-types --test tests/unit/shipping-picking-groups.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPickGroupUnits,
  distributeScannedQuantityAcrossGroup,
  type PickGroupSourceItem,
} from "../../src/lib/shipping-picking-groups.ts";

function item(overrides: Partial<PickGroupSourceItem> & { compositeId: string }): PickGroupSourceItem {
  return {
    orderId: overrides.compositeId,
    orderSequenceKey: "2026-01-01T00:00:00.000Z",
    productId: "prod-1",
    isKit: false,
    isDone: false,
    routeLines: [{ stockId: "stock-1", quantity: 5 }],
    routeLineIndex: 0,
    ...overrides,
  };
}

test("two pending orders needing the same product from the same bin are grouped together", () => {
  const units = buildPickGroupUnits([
    item({ compositeId: "a" }),
    item({ compositeId: "b" }),
  ]);

  assert.equal(units.length, 1);
  assert.equal(units[0].kind, "group");
  if (units[0].kind === "group") {
    assert.equal(units[0].members.length, 2);
    assert.equal(units[0].productId, "prod-1");
    assert.equal(units[0].stockId, "stock-1");
  }
});

test("same product but different stock bins are NOT grouped", () => {
  const units = buildPickGroupUnits([
    item({ compositeId: "a", routeLines: [{ stockId: "stock-1", quantity: 5 }] }),
    item({ compositeId: "b", routeLines: [{ stockId: "stock-2", quantity: 5 }] }),
  ]);

  assert.equal(units.length, 2);
  assert.ok(units.every((unit) => unit.kind === "single"));
});

test("different products at the same bin are NOT grouped", () => {
  const units = buildPickGroupUnits([
    item({ compositeId: "a", productId: "prod-1" }),
    item({ compositeId: "b", productId: "prod-2" }),
  ]);

  assert.equal(units.length, 2);
  assert.ok(units.every((unit) => unit.kind === "single"));
});

test("kit items are never grouped, even against a matching simple item", () => {
  const units = buildPickGroupUnits([
    item({ compositeId: "a", isKit: true }),
    item({ compositeId: "b", isKit: true }),
  ]);

  assert.equal(units.length, 2);
  assert.ok(units.every((unit) => unit.kind === "single"));
});

test("already-done items are never grouped (they no longer have an active stop to share)", () => {
  const units = buildPickGroupUnits([
    item({ compositeId: "a", isDone: true }),
    item({ compositeId: "b", isDone: true }),
  ]);

  assert.equal(units.length, 2);
  assert.ok(units.every((unit) => unit.kind === "single"));
});

test("items without a resolvable productId are never grouped", () => {
  const units = buildPickGroupUnits([
    item({ compositeId: "a", productId: null }),
    item({ compositeId: "b", productId: null }),
  ]);

  assert.equal(units.length, 2);
  assert.ok(units.every((unit) => unit.kind === "single"));
});

test("a solo bucket (only one member ends up matching) is returned as a single, not a group of one", () => {
  const units = buildPickGroupUnits([item({ compositeId: "a" })]);
  assert.equal(units.length, 1);
  assert.equal(units[0].kind, "single");
});

test("three orders at the same bin are grouped together in one unit", () => {
  const units = buildPickGroupUnits([
    item({ compositeId: "a" }),
    item({ compositeId: "b" }),
    item({ compositeId: "c" }),
  ]);

  assert.equal(units.length, 1);
  assert.equal(units[0].kind, "group");
  if (units[0].kind === "group") {
    assert.equal(units[0].members.length, 3);
  }
});

test("distribution: a scan exactly covering every member's need splits it across all of them, oldest order first", () => {
  const allocations = distributeScannedQuantityAcrossGroup(
    [
      { compositeId: "newest", orderSequenceKey: "2026-03-01", remainingAtStop: 2 },
      { compositeId: "oldest", orderSequenceKey: "2026-01-01", remainingAtStop: 2 },
      { compositeId: "middle", orderSequenceKey: "2026-02-01", remainingAtStop: 2 },
    ],
    6,
  );

  assert.deepEqual(allocations, [
    { compositeId: "oldest", quantity: 2 },
    { compositeId: "middle", quantity: 2 },
    { compositeId: "newest", quantity: 2 },
  ]);
});

test("distribution: a pack scan that only covers part of the group fills the oldest order(s) first and leaves the rest untouched", () => {
  // Pack of 12 units, but the oldest order only needs 5 -- the remaining 7
  // should go entirely to the next-oldest order, not be spread evenly.
  const allocations = distributeScannedQuantityAcrossGroup(
    [
      { compositeId: "oldest", orderSequenceKey: "2026-01-01", remainingAtStop: 5 },
      { compositeId: "middle", orderSequenceKey: "2026-02-01", remainingAtStop: 10 },
    ],
    12,
  );

  assert.deepEqual(allocations, [
    { compositeId: "oldest", quantity: 5 },
    { compositeId: "middle", quantity: 7 },
  ]);
});

test("distribution: a scan smaller than any single member's need only fills the oldest order", () => {
  const allocations = distributeScannedQuantityAcrossGroup(
    [
      { compositeId: "oldest", orderSequenceKey: "2026-01-01", remainingAtStop: 5 },
      { compositeId: "middle", orderSequenceKey: "2026-02-01", remainingAtStop: 5 },
    ],
    1,
  );

  assert.deepEqual(allocations, [{ compositeId: "oldest", quantity: 1 }]);
});

test("distribution: members with nothing left to fill are skipped entirely", () => {
  const allocations = distributeScannedQuantityAcrossGroup(
    [
      { compositeId: "already-full", orderSequenceKey: "2026-01-01", remainingAtStop: 0 },
      { compositeId: "pending", orderSequenceKey: "2026-02-01", remainingAtStop: 3 },
    ],
    3,
  );

  assert.deepEqual(allocations, [{ compositeId: "pending", quantity: 3 }]);
});

test("distribution: a quantity larger than the group's total capacity only allocates up to capacity, no negative/overflow", () => {
  const allocations = distributeScannedQuantityAcrossGroup(
    [{ compositeId: "a", orderSequenceKey: "2026-01-01", remainingAtStop: 4 }],
    999,
  );

  assert.deepEqual(allocations, [{ compositeId: "a", quantity: 4 }]);
});

test("distribution: zero quantity to apply allocates nothing", () => {
  const allocations = distributeScannedQuantityAcrossGroup(
    [{ compositeId: "a", orderSequenceKey: "2026-01-01", remainingAtStop: 4 }],
    0,
  );

  assert.deepEqual(allocations, []);
});
