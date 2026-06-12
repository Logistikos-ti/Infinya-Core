import { NextResponse } from "next/server";
import {
  listAddressBlueprint,
  listConfigModules,
  listDepositantesResumo,
  listProductOverview,
  listUsersOverview,
} from "@/lib/wms-data";

export async function GET() {
  return NextResponse.json({
    modules: listConfigModules(),
    depositantes: listDepositantesResumo(),
    users: listUsersOverview(),
    products: listProductOverview(),
    addresses: listAddressBlueprint(),
  });
}
