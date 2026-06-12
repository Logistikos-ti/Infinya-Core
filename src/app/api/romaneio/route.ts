import { NextResponse } from "next/server";
import { listRouteLoads } from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    routeLoads: listRouteLoads(),
  });
}
