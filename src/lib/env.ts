export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
}

export function hasSupabaseEnv() {
  const env = getSupabaseEnv();

  return Boolean(env.url && env.anonKey);
}

export function getAppEnv() {
  return {
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "",
  };
}

export function getBlingEnv() {
  return {
    clientId: process.env.BLING_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.BLING_CLIENT_SECRET?.trim() ?? "",
  };
}

export function getMercadoLivreEnv() {
  return {
    clientId: process.env.MERCADO_LIVRE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.MERCADO_LIVRE_CLIENT_SECRET?.trim() ?? "",
  };
}
