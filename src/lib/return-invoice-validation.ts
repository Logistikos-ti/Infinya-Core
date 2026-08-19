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

function uniqueCodes(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeProductCode(value);
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}

/**
 * Um produto costuma carregar mais de um código, e cada lado guarda numa
 * ordem diferente: no pedido o `codigo_produto` pode ser o EAN e o `sku` o
 * código interno, enquanto na NF-e o `cProd` é o código interno e o `cEAN` é
 * o EAN. Casar pelo "primeiro código" faz o mesmo item aparecer como
 * faltando de um lado e sobrando do outro.
 *
 * Então tratamos todos os códigos que aparecem juntos num item como apelidos
 * do mesmo produto (union-find) e reduzimos cada item a um representante
 * único. Assim {EAN, SKU} no pedido e {SKU, EAN} na nota colapsam na mesma
 * chave e o casamento acontece.
 */
function createCodeAliasResolver(codeGroups: string[][]) {
  const parent = new Map<string, string>();

  const find = (code: string): string => {
    let root = code;
    while (true) {
      const next = parent.get(root);
      if (next === undefined || next === root) break;
      root = next;
    }

    let cursor = code;
    while (cursor !== root) {
      const next = parent.get(cursor) ?? root;
      parent.set(cursor, root);
      cursor = next;
    }

    return root;
  };

  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (const group of codeGroups) {
    for (const code of group) {
      if (!parent.has(code)) parent.set(code, code);
    }
    for (let index = 1; index < group.length; index += 1) {
      union(group[0], group[index]);
    }
  }

  return find;
}

function sumByResolvedCode<T>(
  entries: T[],
  codeGroups: string[][],
  resolve: (code: string) => string,
  quantity: (entry: T) => number,
  label: (entry: T) => string,
  missingCodePrefix: string,
) {
  const totals = new Map<string, { quantity: number; label: string; displayCode: string }>();

  entries.forEach((entry, index) => {
    const codes = codeGroups[index];
    // Item sem nenhum código utilizável não tem como ser casado; ganha uma
    // chave própria para aparecer explicitamente como divergência.
    const key = codes.length > 0 ? resolve(codes[0]) : `${missingCodePrefix}${index}`;
    const current = totals.get(key);

    totals.set(key, {
      quantity: (current?.quantity ?? 0) + quantity(entry),
      label: current?.label ?? label(entry),
      displayCode: current?.displayCode ?? (codes[0] ?? "sem código"),
    });
  });

  return totals;
}

export function validateReturnInvoiceAgainstOrder(
  orderItems: ReturnInvoiceOrderItem[],
  parsedNfe: ParsedNfe,
): ReturnInvoiceValidationResult {
  const expectedGroups = orderItems.map((item) => uniqueCodes([item.codigoProduto, item.sku]));
  const foundGroups = parsedNfe.items.map((item) => uniqueCodes([item.codigo, item.ean]));
  const resolve = createCodeAliasResolver([...expectedGroups, ...foundGroups]);

  const expectedTotals = sumByResolvedCode(
    orderItems,
    expectedGroups,
    resolve,
    (item) => Number(item.quantidade ?? 0),
    (item) => item.nome,
    "__SEM_CODIGO_PEDIDO__",
  );

  const foundTotals = sumByResolvedCode(
    parsedNfe.items,
    foundGroups,
    resolve,
    (item) => Number(item.quantidade ?? 0),
    (item) => item.descricao,
    "__SEM_CODIGO_NFE__",
  );

  const divergences: ReturnInvoiceDivergence[] = [];

  for (const [key, expected] of expectedTotals) {
    const found = foundTotals.get(key);

    if (!found) {
      divergences.push({
        kind: "FALTANDO_NA_NF",
        code: expected.displayCode,
        name: expected.label,
        expected: expected.quantity,
        found: 0,
      });
      continue;
    }

    if (Math.abs(found.quantity - expected.quantity) > QUANTITY_EPSILON) {
      divergences.push({
        kind: "QUANTIDADE",
        code: expected.displayCode,
        name: expected.label,
        expected: expected.quantity,
        found: found.quantity,
      });
    }
  }

  for (const [key, found] of foundTotals) {
    if (!expectedTotals.has(key)) {
      divergences.push({
        kind: "SOBRANDO_NA_NF",
        code: found.displayCode,
        name: found.label,
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
