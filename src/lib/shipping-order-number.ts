export function formatWmsOrderNumber(
  value: number | string | null | undefined,
  fallback: string,
  depositanteName?: string | null,
) {
  let numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    const match = fallback.match(/\d+$/);
    if (match && fallback.startsWith("WMS-")) {
      numericValue = Number(match[0]);
    }
  }

  if (Number.isFinite(numericValue) && numericValue > 0) {
    let prefix = "WMS";
    if (depositanteName) {
      const shortName = depositanteName.trim().substring(0, 3).toUpperCase();
      if (shortName) {
        prefix = `WMS-${shortName}`;
      }
    }
    return `${prefix}-${String(Math.trunc(numericValue)).padStart(5, "0")}`;
  }

  return fallback;
}
