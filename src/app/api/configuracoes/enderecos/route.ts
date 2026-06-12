import { NextResponse } from "next/server";
import { listAddressBlueprint } from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    addresses: listAddressBlueprint(),
  });
}
