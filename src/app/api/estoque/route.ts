import { NextResponse } from "next/server";
import { listStockBalances } from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    balances: listStockBalances(),
  });
}
