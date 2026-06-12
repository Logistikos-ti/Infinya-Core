import { NextResponse } from "next/server";
import {
  listReceivingOrders,
  listReceivingStats,
  listRoadmapMilestones,
  listShippingQueues,
} from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    receivingStats: listReceivingStats(),
    receivingOrders: listReceivingOrders(),
    roadmap: listRoadmapMilestones(),
    shippingQueues: listShippingQueues(),
  });
}
