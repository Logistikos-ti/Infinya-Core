type MaybeRecord = Record<string, unknown> | null | undefined;

export type ProductKitComponentOption = {
  id: string;
  depositanteId: string;
  nome: string;
  sku: string | null;
  codigoInterno: string | null;
  codigoExterno: string | null;
};

export type ProductKitComponentDraft = {
  componentProductId: string;
  quantity: number;
};

export type ProductKitComponentDefinition = {
  componentProductId: string;
  quantityPerKit: number;
  sku: string;
  name: string;
  internalCode: string;
  barcode: string;
};

export type ProductKitProgress = {
  componentProductId: string;
  separatedQuantity: number;
};

export function normalizeProductKitDrafts(
  componentIds: string[],
  quantityValues: string[],
) {
  return componentIds
    .map((componentProductId, index) => ({
      componentProductId: componentProductId.trim(),
      quantity: normalizePositiveQuantity(quantityValues[index] ?? ""),
    }))
    .filter((item) => item.componentProductId && item.quantity > 0);
}

export function normalizePickingKitProgress(payload: MaybeRecord) {
  const section = readRecord(payload?.separacaoKit);
  const components = readArray(section?.componentes);

  return components
    .map((entry) => {
      const row = readRecord(entry);
      const componentProductId = readString(row?.produtoComponenteId);
      const separatedQuantity = normalizePositiveQuantity(row?.quantidadeSeparada);

      if (!componentProductId) {
        return null;
      }

      return { componentProductId, separatedQuantity } satisfies ProductKitProgress;
    })
    .filter((item): item is ProductKitProgress => Boolean(item));
}

export function normalizeConferenceKitProgress(payload: MaybeRecord) {
  const section = readRecord(payload?.conferenciaKit);
  const components = readArray(section?.componentes);

  return components
    .map((entry) => {
      const row = readRecord(entry);
      const componentProductId = readString(row?.produtoComponenteId);
      const separatedQuantity = normalizePositiveQuantity(row?.quantidadeConferida);

      if (!componentProductId) {
        return null;
      }

      return { componentProductId, separatedQuantity } satisfies ProductKitProgress;
    })
    .filter((item): item is ProductKitProgress => Boolean(item));
}

export function buildKitProgressMap(progress: ProductKitProgress[]) {
  return new Map(progress.map((item) => [item.componentProductId, item.separatedQuantity]));
}

export function calculateKitOperationalTotals(
  kitComponents: ProductKitComponentDefinition[],
  requestedKits: number,
  progressMap: Map<string, number>,
) {
  const normalizedRequestedKits = Math.max(requestedKits, 0);
  const operationalRequestedQuantity = kitComponents.reduce(
    (sum, component) => sum + normalizedRequestedKits * component.quantityPerKit,
    0,
  );
  const operationalSeparatedQuantity = kitComponents.reduce(
    (sum, component) => sum + Math.min(progressMap.get(component.componentProductId) ?? 0, normalizedRequestedKits * component.quantityPerKit),
    0,
  );

  const completedKits = kitComponents.length
    ? Math.min(
        ...kitComponents.map((component) => {
          const separated = progressMap.get(component.componentProductId) ?? 0;
          return Math.floor(separated / component.quantityPerKit);
        }),
      )
    : 0;

  return {
    operationalRequestedQuantity,
    operationalSeparatedQuantity,
    completedKits: Math.max(0, Math.min(completedKits, normalizedRequestedKits)),
  };
}

export function buildPickingKitPayload(
  currentPayload: Record<string, unknown>,
  requestedKits: number,
  progress: ProductKitProgress[],
) {
  return {
    ...currentPayload,
    separacaoKit: {
      quantidadeKitsSolicitada: requestedKits,
      componentes: progress.map((item) => ({
        produtoComponenteId: item.componentProductId,
        quantidadeSeparada: item.separatedQuantity,
      })),
    },
  };
}

export function buildConferenceKitPayload(
  currentPayload: Record<string, unknown>,
  requestedKits: number,
  progress: ProductKitProgress[],
) {
  return {
    ...currentPayload,
    conferenciaKit: {
      quantidadeKitsSolicitada: requestedKits,
      componentes: progress.map((item) => ({
        produtoComponenteId: item.componentProductId,
        quantidadeConferida: item.separatedQuantity,
      })),
    },
  };
}

export function isKitProduct(
  tipoProduto: string | null | undefined,
  kitComponents: ProductKitComponentDefinition[],
) {
  return tipoProduto === "KIT" && kitComponents.length > 0;
}

function normalizePositiveQuantity(value: unknown) {
  const source = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const numeric = Number(source.replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, numeric);
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  return null;
}
