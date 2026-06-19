import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncPendingBlingInvoiceAttachments } from "@/lib/shipping-attachment-sync";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado no ambiente." },
      { status: 500 },
    );
  }

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const adminSupabase = createSupabaseAdminClient();
  const summary = await syncPendingBlingInvoiceAttachments(adminSupabase, 40);

  return NextResponse.json({
    ok: true,
    executedAt: new Date().toISOString(),
    summary,
  });
}
