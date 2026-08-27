import type { AppUserContext } from "@/lib/auth";
import { listStockQuarantineFromDb, type StockQuarantineItem } from "@/lib/stock-quarantine";

export type DamageReportFilters = {
  depositanteId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
};

export type DamageReportRow = StockQuarantineItem;

export type DamageReportTopProduct = {
  sku: string;
  productName: string;
  occurrences: number;
  quantity: number;
};

export type DamageReport = {
  rows: DamageReportRow[];
  summary: {
    totalOccurrences: number;
    totalQuantity: number;
    pending: number;
    donated: number;
    discarded: number;
    averageResolutionHours: number;
    topProducts: DamageReportTopProduct[];
  };
};

export async function listDamageReport(
  user: AppUserContext,
  filters: DamageReportFilters = {},
): Promise<DamageReport> {
  const effectiveDepositanteId =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : filters.depositanteId;

  const allItems = await listStockQuarantineFromDb({
    depositanteId: effectiveDepositanteId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    formalOnly: true,
  });

  const rows = allItems.filter((item) => item.tipo === "AVARIA" && matchesStatus(item, filters.status));

  return { rows, summary: buildSummary(rows) };
}

function matchesStatus(item: DamageReportRow, status?: string) {
  return !status || status === "TODOS" || item.status === status;
}

function buildSummary(rows: DamageReportRow[]) {
  const totalQuantity = rows.reduce((total, row) => total + row.quantity, 0);
  const pending = rows.filter((row) => row.status === "EM_QUARENTENA").length;
  const donated = rows.filter((row) => row.status === "LIBERADO").length;
  const discarded = rows.filter((row) => row.status === "DESCARTADO").length;

  const resolutionHours = rows
    .filter((row) => row.resolvedAt)
    .map((row) => (Date.parse(row.resolvedAt as string) - Date.parse(row.createdAt)) / 3_600_000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0);

  const averageResolutionHours = resolutionHours.length
    ? Math.round(
        (resolutionHours.reduce((total, hours) => total + hours, 0) / resolutionHours.length) * 10,
      ) / 10
    : 0;

  const productTotals = new Map<string, DamageReportTopProduct>();
  for (const row of rows) {
    const key = `${row.sku}::${row.productName}`;
    const existing = productTotals.get(key);
    if (existing) {
      existing.occurrences += 1;
      existing.quantity += row.quantity;
    } else {
      productTotals.set(key, {
        sku: row.sku,
        productName: row.productName,
        occurrences: 1,
        quantity: row.quantity,
      });
    }
  }

  const topProducts = [...productTotals.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    totalOccurrences: rows.length,
    totalQuantity,
    pending,
    donated,
    discarded,
    averageResolutionHours,
    topProducts,
  };
}
