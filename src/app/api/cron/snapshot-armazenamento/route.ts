import { NextResponse } from "next/server";
import { registrarSnapshotArmazenamento } from "@/lib/billing";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const result = await registrarSnapshotArmazenamento();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
