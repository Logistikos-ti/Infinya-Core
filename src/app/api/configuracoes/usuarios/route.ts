import { NextResponse } from "next/server";
import { listUsersOverview } from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    users: listUsersOverview(),
  });
}
