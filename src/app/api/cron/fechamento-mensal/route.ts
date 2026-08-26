import { NextResponse } from "next/server";
import { fecharFaturasMensais } from "@/lib/billing";

function isUltimoDiaDoMes(): boolean {
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);
  return amanha.getDate() === 1;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!isUltimoDiaDoMes()) {
    return NextResponse.json({ skipped: true, reason: "Não é o último dia do mês." });
  }

  const result = await fecharFaturasMensais();
  return NextResponse.json(result);
}
