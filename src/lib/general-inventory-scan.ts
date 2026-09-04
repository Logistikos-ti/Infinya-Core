/**
 * Pure decision logic for the scan-driven Inventário Geral flow. Kept
 * DOM/rede/câmera-free so it can be unit tested without a real camera --
 * the React panel only calls this and executes the resulting side effect
 * (setState, fetch, flash).
 */

export type GeneralInventoryScanItem = {
  id: string;
  sku: string;
  codigoExterno: string | null;
  codigoInterno: string | null;
  codigoExternoPack: string | null;
  /** Unidades por embalagem -- usado quando o bipe casa com codigoExternoPack. */
  quantidadePorEmbalagem: number | null;
  quantidadeSistema: number;
  quantidadeContada: number | null;
  atribuidoA: string | null;
};

export type GeneralInventoryScanState<T extends GeneralInventoryScanItem> = {
  items: T[];
  activeItemId: string | null;
  /** Local (client-only) tally for the active item, seeded from quantidadeContada. */
  activeCount: number;
  currentUserId: string;
};

export type GeneralInventoryScanDecision<T extends GeneralInventoryScanItem> =
  | { kind: "not-found" }
  | { kind: "claimed-by-other"; item: T }
  | { kind: "switch-item"; item: T; nextCount: number; complete: boolean }
  | { kind: "increment"; item: T; nextCount: number; complete: boolean }
  | { kind: "surplus-prompt"; item: T; switchingItem: boolean; seededCount: number };

export function normalizeScan(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

/**
 * Genérica em T (que estende GeneralInventoryScanItem) para devolver ao
 * chamador o mesmo tipo completo que ele passou (ex.: o `Item` rico do
 * general-inventory-client.tsx, com nome/imagem/status/etc.), sem exigir
 * cast no call site.
 */
export function findGeneralInventoryScanItem<T extends GeneralInventoryScanItem>(
  items: T[],
  rawCode: string,
): T | null {
  const normalized = normalizeScan(rawCode);
  if (!normalized) return null;

  return (
    items.find((item) =>
      [item.sku, item.codigoExterno, item.codigoInterno, item.codigoExternoPack]
        .filter((value): value is string => Boolean(value))
        .some((value) => normalizeScan(value) === normalized),
    ) ?? null
  );
}

/**
 * Resolves a single scan against the general-inventory item list.
 *
 * Switching to a different product than the currently active one seeds the
 * count from that product's own last known quantidadeContada (0 if never
 * counted) and treats the very same scan as unit #1 -- selecting and
 * counting are the same bip, mirroring receiving. If that seeded count is
 * already at or past quantidadeSistema (a zero-expected product, or one
 * resumed from a previous partial session that already hit the limit), the
 * switch itself surfaces the surplus prompt instead of silently counting.
 */
/**
 * Bipe do código de PACK (ex.: Dêvi) conta como a quantidade de unidades da
 * embalagem de uma vez, não como 1 -- mesmo critério do painel de conferência
 * de recebimento (shipping-conference-panel.tsx).
 */
function getScanIncrement(item: GeneralInventoryScanItem, normalized: string): number {
  if (item.codigoExternoPack && normalizeScan(item.codigoExternoPack) === normalized) {
    return Math.max(item.quantidadePorEmbalagem ?? 1, 1);
  }
  return 1;
}

export function resolveGeneralInventoryScan<T extends GeneralInventoryScanItem>(
  rawCode: string,
  state: GeneralInventoryScanState<T>,
): GeneralInventoryScanDecision<T> {
  const normalized = normalizeScan(rawCode);
  const item = findGeneralInventoryScanItem(state.items, rawCode);
  if (!item) {
    return { kind: "not-found" };
  }

  if (item.atribuidoA && item.atribuidoA !== state.currentUserId) {
    return { kind: "claimed-by-other", item };
  }

  const isSwitchingItem = item.id !== state.activeItemId;
  const currentCount = isSwitchingItem ? item.quantidadeContada ?? 0 : state.activeCount;

  if (currentCount >= item.quantidadeSistema) {
    return { kind: "surplus-prompt", item, switchingItem: isSwitchingItem, seededCount: currentCount };
  }

  const nextCount = currentCount + getScanIncrement(item, normalized);
  return {
    kind: isSwitchingItem ? "switch-item" : "increment",
    item,
    nextCount,
    complete: nextCount >= item.quantidadeSistema,
  };
}
