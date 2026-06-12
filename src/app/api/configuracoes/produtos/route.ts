import { NextResponse } from "next/server";
import { listProductOverview } from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    products: listProductOverview(),
  });
}
