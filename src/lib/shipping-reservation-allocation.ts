export type PickingReservationMovement = {
  orderId: string | null;
  itemId: string | null;
  stockId: string | null;
  quantity: number;
};

export type PickingReservationScan = {
  orderId: string;
  itemId: string;
  stockId: string;
  quantity: number;
};

export type PickingItemStockAllocation = Map<string, number>;
export type PickingOrderAllocations = Map<string, PickingItemStockAllocation>;
export type PickingAllocationsByOrder = Map<string, PickingOrderAllocations>;

export function buildRemainingPickingAllocations(
  movements: PickingReservationMovement[],
  scans: PickingReservationScan[],
): PickingAllocationsByOrder {
  const allocations: PickingAllocationsByOrder = new Map();
  const scannedByKey = new Map<string, number>();
  const reservedByKey = new Map<
    string,
    { orderId: string; itemId: string; stockId: string; quantity: number }
  >();

  for (const scan of scans) {
    const key = `${scan.orderId}:${scan.itemId}:${scan.stockId}`;
    scannedByKey.set(key, (scannedByKey.get(key) ?? 0) + scan.quantity);
  }

  for (const movement of movements) {
    const orderId = movement.orderId?.trim();
    const itemId = movement.itemId?.trim();
    const stockId = movement.stockId?.trim();

    if (!orderId || !itemId || !stockId || movement.quantity <= 0) {
      continue;
    }

    const key = `${orderId}:${itemId}:${stockId}`;
    const current = reservedByKey.get(key);
    reservedByKey.set(key, {
      orderId,
      itemId,
      stockId,
      quantity: (current?.quantity ?? 0) + movement.quantity,
    });
  }

  for (const reservation of reservedByKey.values()) {
    const { orderId, itemId, stockId } = reservation;
    const key = `${orderId}:${itemId}:${stockId}`;
    const remaining = Math.max(reservation.quantity - (scannedByKey.get(key) ?? 0), 0);
    const orderAllocation = allocations.get(orderId) ?? new Map<string, PickingItemStockAllocation>();
    const itemAllocation = orderAllocation.get(itemId) ?? new Map<string, number>();
    itemAllocation.set(stockId, remaining);
    orderAllocation.set(itemId, itemAllocation);
    allocations.set(orderId, orderAllocation);
  }

  return allocations;
}
