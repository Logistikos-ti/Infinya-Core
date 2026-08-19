import type { ParsedNfe } from "@/lib/nfe-import";

export type ReturnInvoiceOrderItem = {
  produtoId: string | null;
  codigoProduto: string | null;
  sku: string | null;
  nome: string;
  quantidade: number;
};

export type ReturnInvoiceDivergence = {
  kind: "QUANTIDADE" | "FALTANDO_NA_NF" | "SOBRANDO_NA_NF";
  code: string;
  name: string;
  expected: number;
  found: number;
};

export type ReturnInvoiceValidationResult = {
  ok: boolean;
  divergences: ReturnInvoiceDivergence[];
};

/**
 * O casamento é por código do produto + quantidade total, conforme a regra
 * acordada para a retirada: diferenças fiscais (valor, CFOP, imposto) não
 * bloqueiam; bipar produto errado ou quantidade errada, sim.
 */
export function normalizeProductCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^0+(?=.)/, "");
}

/** Tolerância para ruído de ponto flutuante em quantidades numeric(12,3). */
const QUANTITY_EPSILON = 0.001;

function sumByCode<T>(entries: T[], code: (entry: T) => string[], quantity: (entry: T) => number) {
  const totals = new Map<string, { quantity: number; label: string }>();

  for (const entry of entries) {
    const codes = code(entry).map(normalizeProductCode).filter(Boolean);
    // Um item sem nenhum código utilizável não tem como ser casado; ele vira uma
    // chave própria para aparecer explicitamente como divergência.
    const key = codes[0] ?? `__SEM_CODIGO__${totals.size}`;
    const current = totals.get(key);
    totals.set(key, {
      quantity: (current?.quantity ?? 0) + quantity(entry),
      label: current?.label ?? key,
    });
  }

  return totals;
}

export function validateReturnInvoiceAgainstOrder(
  orderItems: ReturnInvoiceOrderItem[],
  parsedNfe: ParsedNfe,
): ReturnInvoiceValidationResult {
  const expectedTotals = sumByCode(
    orderItems,
    (item) => [item.codigoProduto ?? "", item.sku ?? ""],
    (item) => Number(item.quantidade ?? 0),
  );
  const expectedNames = new Map<string, string>();
  for (const item of orderItems) {
    const key = normalizeProductCode(item.codigoProduto ?? item.sku ?? "");
    if (key && !expectedNames.has(key)) expectedNames.set(key, item.nome);
  }

  const foundTotals = sumByCode(
    parsedNfe.items,
    (item) => [item.codigo ?? "", item.ean ?? ""],
    (item) => Number(item.quantidade ?? 0),
  );
  const foundNames = new Map<string, string>();
  for (const item of parsedNfe.items) {
    const key = normalizeProductCode(item.codigo ?? item.ean ?? "");
    if (key && !foundNames.has(key)) foundNames.set(key, item.descricao);
  }

  const divergences: ReturnInvoiceDivergence[] = [];

  for (const [code, expected] of expectedTotals) {
    const found = foundTotals.get(code);

    if (!found) {
      divergences.push({
        kind: "FALTANDO_NA_NF",
        code,
        name: expectedNames.get(code) ?? code,
        expected: expected.quantity,
        found: 0,
      });
      continue;
    }

    if (Math.abs(found.quantity - expected.quantity) > QUANTITY_EPSILON) {
      divergences.push({
        kind: "QUANTIDADE",
        code,
        name: expectedNames.get(code) ?? code,
        expected: expected.quantity,
        found: found.quantity,
      });
    }
  }

  for (const [code, found] of foundTotals) {
    if (!expectedTotals.has(code)) {
      divergences.push({
        kind: "SOBRANDO_NA_NF",
        code,
        name: foundNames.get(code) ?? code,
        expected: 0,
        found: found.quantity,
      });
    }
  }

  return { ok: divergences.length === 0, divergences };
}

export function describeReturnInvoiceDivergence(divergence: ReturnInvoiceDivergence): string {
  const format = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  switch (divergence.kind) {
    case "FALTANDO_NA_NF":
      return `${divergence.name} (${divergence.code}): esperado ${format(divergence.expected)}, ausente na NF-e.`;
    case "SOBRANDO_NA_NF":
      return `${divergence.name} (${divergence.code}): ${format(divergence.found)} na NF-e, mas não consta no pedido.`;
    case "QUANTIDADE":
    default:
      return `${divergence.name} (${divergence.code}): esperado ${format(divergence.expected)}, NF-e traz ${format(divergence.found)}.`;
  }
}
