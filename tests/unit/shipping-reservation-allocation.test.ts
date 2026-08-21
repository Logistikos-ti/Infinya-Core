import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRemainingPickingAllocations } from "../../src/lib/shipping-reservation-allocation.ts";

test("reservation allocation aggregates split movements before subtracting scans", () => {
  const allocations = buildRemainingPickingAllocations(
    [
      { orderId: "order-1", itemId: "item-1", stockId: "stock-1", quantity: 5 },
      { orderId: "order-1", itemId: "item-1", stockId: "stock-1", quantity: 5 },
    ],
    [{ orderId: "order-1", itemId: "item-1", stockId: "stock-1", quantity: 2 }],
  );

  assert.equal(allocations.get("order-1")?.get("item-1")?.get("stock-1"), 8);
});

test("reservation allocation never exposes a negative route quantity", () => {
  const allocations = buildRemainingPickingAllocations(
    [{ orderId: "order-1", itemId: "item-1", stockId: "stock-1", quantity: 1 }],
    [{ orderId: "order-1", itemId: "item-1", stockId: "stock-1", quantity: 3 }],
  );

  assert.equal(allocations.get("order-1")?.get("item-1")?.get("stock-1"), 0);
});

test("reservation allocation keeps orders, items and stock addresses isolated", () => {
  const allocations = buildRemainingPickingAllocations(
    [
      { orderId: "order-1", itemId: "item-1", stockId: "stock-1", quantity: 4 },
      { orderId: "order-1", itemId: "item-2", stockId: "stock-1", quantity: 6 },
      { orderId: "order-2", itemId: "item-1", stockId: "stock-2", quantity: 3 },
    ],
    [],
  );

  assert.equal(allocations.get("order-1")?.get("item-1")?.get("stock-1"), 4);
  assert.equal(allocations.get("order-1")?.get("item-2")?.get("stock-1"), 6);
  assert.equal(allocations.get("order-2")?.get("item-1")?.get("stock-2"), 3);
});
