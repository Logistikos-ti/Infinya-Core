import { NextResponse } from "next/server";
import { listDepositantesResumo } from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    depositantes: listDepositantesResumo(),
  });
}
