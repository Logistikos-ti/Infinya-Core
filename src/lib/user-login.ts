export function normalizeUserLogin(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");
}

export function buildInternalAuthEmail(login: string, seed: string) {
  const safeLogin = normalizeUserLogin(login) || "usuario";
  const safeSeed = seed.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "interno";
  return `${safeLogin}.${safeSeed}@auth.infinyalog.local`;
}

export function isEmailLike(value: string) {
  return value.includes("@");
}
