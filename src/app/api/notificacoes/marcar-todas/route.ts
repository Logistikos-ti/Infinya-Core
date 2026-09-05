import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { markAllNotificationsRead } from "@/lib/notifications";

const NOTIFICATION_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

export async function POST() {
  const auth = await requireApiRoleAccess(NOTIFICATION_ROLES);
  if (auth.response) return auth.response;

  await markAllNotificationsRead(auth.user);

  return NextResponse.json({ ok: true });
}
