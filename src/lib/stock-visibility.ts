const LEGACY_DAMAGE_CUTOFF = Date.parse("2026-08-19T03:00:00.000Z");

type LegacyDamageEntry = {
  createdAt?: string | null;
  type?: string | null;
  description?: string | null;
};

export function isHiddenLegacyDamageEntry({
  createdAt,
  type,
  description,
}: LegacyDamageEntry) {
  const timestamp = Date.parse(createdAt ?? "");
  if (!Number.isFinite(timestamp) || timestamp >= LEGACY_DAMAGE_CUTOFF) {
    return false;
  }

  const searchableText = `${type ?? ""} ${description ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  return searchableText.includes("avaria");
}
