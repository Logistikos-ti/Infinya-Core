import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { buildRelatorioFaturaData } from "@/lib/relatorio-fatura";
import { renderRelatorioFaturaHtml } from "@/lib/relatorio-fatura-html";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiModuleAccess("financeiro");
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const data = await buildRelatorioFaturaData(id);
  if (!data) {
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }

  const html = renderRelatorioFaturaHtml(data);
  const fileName = `Fechamento-Infinoos-WMS-${data.cliente.replace(/[^\w-]+/g, "-")}-${data.periodoRef.replace("/", "-")}.html`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
