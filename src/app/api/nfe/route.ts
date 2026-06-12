import { NextResponse } from "next/server";
import { listNfeInbox } from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    inbox: listNfeInbox(),
  });
}
