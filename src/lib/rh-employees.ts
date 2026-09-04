import { createClient } from "@supabase/supabase-js";

let rhClient: ReturnType<typeof createClient> | null = null;

function getRhClient() {
  const url = process.env.RH_SUPABASE_URL;
  const key = process.env.RH_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!rhClient) {
    rhClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return rhClient;
}

// Busca a foto da ficha de funcionário no Infinoos People (RH) por email —
// completa o avatar de usuários do WMS que também têm cadastro como
// colaborador lá. Nunca lança erro: se o RH estiver fora do ar ou a chave
// não estiver configurada, devolve mapa vazio (cai pro fallback de iniciais).
export async function getEmployeePhotosByEmail(emails: Array<string | null | undefined>): Promise<Map<string, string>> {
  const photos = new Map<string, string>();
  const uniqueEmails = [...new Set(emails.filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))];
  if (uniqueEmails.length === 0) return photos;

  const client = getRhClient();
  if (!client) return photos;

  try {
    const { data, error } = await client
      .from("employees")
      .select("email, photo_url")
      .in("email", uniqueEmails)
      .not("photo_url", "is", null);
    if (error || !data) return photos;
    for (const row of data as Array<{ email: string | null; photo_url: string | null }>) {
      if (row.email && row.photo_url) photos.set(row.email.toLowerCase(), row.photo_url);
    }
  } catch {
    // RH fora do ar ou instável — segue sem foto, não quebra a tela do WMS.
  }

  return photos;
}
