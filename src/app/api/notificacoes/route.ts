import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { listNotificationsForUser } from "@/lib/notifications";

const NOTIFICATION_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireApiRoleAccess(NOTIFICATION_ROLES);
  if (auth.response) return auth.response;

  // "Master preview" do portal (ADMIN/TI olhando o portal de um
  // depositante específico) -- mesmo padrão de /api/suporte/notificacoes.
  // listNotificationsForUser já ignora isso pra um DEPOSITANTE (sempre
  // usa o próprio depositanteId dele, nunca o de outro via query param).
  const requestedDepositanteId = request.nextUrl.searchParams.get("depositanteId")?.trim() ?? "";

  const { notifications, unreadCount } = await listNotificationsForUser(
    auth.user,
    30,
    requestedDepositanteId || null,
  );

  return NextResponse.json(
    { notifications, unreadCount },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
