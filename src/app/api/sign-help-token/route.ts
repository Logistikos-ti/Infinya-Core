import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";

// Assina o token de entrada automática no Infinoos Help (aba "Ajuda" do
// Suporte). Mesmo algoritmo (HMAC-SHA256) e mesma INFINOOS_SSO_SECRET
// esperados por infinoos-chamados/backend/src/services/ssoInfinoos.js e
// pelo equivalente do RH (supabase/functions/sign-help-token) — não mude
// um lado sem mudar o outro.

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TTL_MS = 2 * 60 * 1000; // token só precisa sobreviver ao redirect

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administração",
  TI: "TI",
  OPERADOR: "Operação",
};

function base64url(json: string) {
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST() {
  // Identidade vem só da sessão autenticada — nunca de campos enviados no
  // corpo da requisição, senão qualquer chamada poderia se passar por outro
  // usuário (ou por um admin) no Infinoos Help.
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  if (auth.response) return auth.response;

  const secret = process.env.INFINOOS_SSO_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "INFINOOS_SSO_SECRET não configurado" },
      { status: 500 },
    );
  }

  const payload = {
    email: auth.user.email,
    name: auth.user.nome,
    department: ROLE_LABEL[auth.user.papel] ?? auth.user.papel,
    photo: null,
    product: "WMS",
    exp: Date.now() + TTL_MS,
  };

  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");

  return NextResponse.json({ token: `${payloadB64}.${sig}` });
}
