import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "wms-evolveg",
    supabaseEnvConfigured: hasSupabaseEnv(),
    timestamp: new Date().toISOString(),
  });
}
