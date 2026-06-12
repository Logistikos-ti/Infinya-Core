import { NextResponse } from "next/server";
import { listReportsCatalog } from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    reports: listReportsCatalog(),
  });
}
