import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { listNotificationsForUser } from "@/lib/notifications";

const NOTIFICATION_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireApiRoleAccess(NOTIFICATION_ROLES);
  if (auth.response) return auth.response;

  const { notifications, unreadCount } = await listNotificationsForUser(auth.user);

  return NextResponse.json(
    { notifications, unreadCount },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
