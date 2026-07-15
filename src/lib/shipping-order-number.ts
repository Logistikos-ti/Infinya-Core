export function formatWmsOrderNumber(
  value: number | string | null | undefined,
  fallback: string,
) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return `WMS-${String(Math.trunc(numericValue)).padStart(6, "0")}`;
  }

  return fallback;
}
