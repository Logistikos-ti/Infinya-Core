import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { markNotificationRead } from "@/lib/notifications";

const NOTIFICATION_ROLES = ["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"] as const;

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteProps) {
  const auth = await requireApiRoleAccess(NOTIFICATION_ROLES);
  if (auth.response) return auth.response;

  const { id } = await params;
  await markNotificationRead(auth.user.id, id);

  return NextResponse.json({ ok: true });
}
