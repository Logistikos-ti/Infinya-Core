import { NextResponse } from "next/server";
import { listRouteLoads, listShippingFlow, listShippingQueues } from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    queues: listShippingQueues(),
    flow: listShippingFlow(),
    routeLoads: listRouteLoads(),
  });
}
