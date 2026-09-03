/**
 * Pure decision logic for the scan-driven desktop Contagem Cíclica screen.
 * Kept free of DOM/rede so it's unit-testable. Distinct from
 * general-inventory-scan.ts on purpose: contagens_estoque_itens is unique
 * per (contagem_id, estoque_id) -- NOT per produto -- so the same SKU can
 * appear at multiple positions (endereço/lote) within one area sweep, each
 * with its own quantidadeSistema. A bare barcode match can't tell those
 * apart; when it's ambiguous, a second scan (endereço) disambiguates,
 * mirroring the mobile inventario-resolver's produto->endereço pattern.
 */

export type CycleCountDesktopScanItem = {
  id: string;
  sku: string;
  codigoExterno: string | null;
  codigoInterno: string | null;
  codigoExternoPack: string | null;
  enderecoCodigo: string;
  /** null = contagem cega para este operador -- limite não revelado ao cliente. */
  quantidadeSistema: number | null;
  quantidadeContada: number | null;
  status: "PENDENTE" | "CONTADO" | "DIVERGENTE";
};

export type CycleCountDesktopScanState = {
  items: CycleCountDesktopScanItem[];
  activeItemId: string | null;
  /** Tally local (client-only) do item ativo, semeado de quantidadeContada. */
  activeCount: number;
  /** Setado quando um bipe de produto achou 2+ candidatos e aguardamos o
   * bipe do endereço para escolher entre eles. */
  pendingDisambiguation: CycleCountDesktopScanItem[] | null;
};

export type CycleCountDesktopScanDecision =
  | { kind: "not-found" }
  | { kind: "disambiguate"; candidates: CycleCountDesktopScanItem[] }
  | { kind: "disambiguation-no-match" }
  | { kind: "switch-item"; item: CycleCountDesktopScanItem; nextCount: number; complete: boolean }
  | { kind: "increment"; item: CycleCountDesktopScanItem; nextCount: number; complete: boolean }
  | { kind: "surplus-prompt"; item: CycleCountDesktopScanItem; switchingItem: boolean; seededCount: number };

export function normalizeScan(value: string) {
  return value.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase("pt-BR");
}

function matchesProductCode(item: CycleCountDesktopScanItem, normalized: string): boolean {
  return [item.sku, item.codigoExterno, item.codigoInterno, item.codigoExternoPack]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizeScan(value) === normalized);
}

function matchesAddressCode(item: CycleCountDesktopScanItem, normalized: string): boolean {
  return normalizeScan(item.enderecoCodigo) === normalized;
}

function isCountable(item: CycleCountDesktopScanItem): boolean {
  return item.status === "PENDENTE";
}

/**
 * Modo cego (quantidadeSistema null): nunca fecha sozinho nem pede
 * confirmação de excedente -- não há limite conhecido do lado do cliente.
 * Fechar o item nesse modo é sempre uma ação explícita do operador.
 */
function resolveThresholdDecision(
  item: CycleCountDesktopScanItem,
  currentCount: number,
  isSwitchingItem: boolean,
): CycleCountDesktopScanDecision {
  if (item.quantidadeSistema === null) {
    return { kind: isSwitchingItem ? "switch-item" : "increment", item, nextCount: currentCount + 1, complete: false };
  }

  if (currentCount >= item.quantidadeSistema) {
    return { kind: "surplus-prompt", item, switchingItem: isSwitchingItem, seededCount: currentCount };
  }

  const nextCount = currentCount + 1;
  return {
    kind: isSwitchingItem ? "switch-item" : "increment",
    item,
    nextCount,
    complete: nextCount >= item.quantidadeSistema,
  };
}

export function resolveCycleCountDesktopScan(
  rawCode: string,
  state: CycleCountDesktopScanState,
): CycleCountDesktopScanDecision {
  const normalized = normalizeScan(rawCode);
  if (!normalized) return { kind: "not-found" };

  if (state.pendingDisambiguation) {
    const match = state.pendingDisambiguation.find((item) => matchesAddressCode(item, normalized));
    if (!match) return { kind: "disambiguation-no-match" };
    const isSwitchingItem = match.id !== state.activeItemId;
    const currentCount = isSwitchingItem ? match.quantidadeContada ?? 0 : state.activeCount;
    return resolveThresholdDecision(match, currentCount, isSwitchingItem);
  }

  const candidates = state.items.filter((item) => isCountable(item) && matchesProductCode(item, normalized));
  if (candidates.length === 0) {
    return { kind: "not-found" };
  }

  // Se o item ativo está entre os candidatos, continua contando ELE -- a
  // ambiguidade já foi resolvida quando ele virou ativo; não repetir a
  // pergunta a cada unidade a mais do mesmo item.
  const activeMatch = candidates.find((item) => item.id === state.activeItemId);
  if (activeMatch) {
    return resolveThresholdDecision(activeMatch, state.activeCount, false);
  }

  if (candidates.length > 1) {
    return { kind: "disambiguate", candidates };
  }

  const match = candidates[0];
  return resolveThresholdDecision(match, match.quantidadeContada ?? 0, true);
}
