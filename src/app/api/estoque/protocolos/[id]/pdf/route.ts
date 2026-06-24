import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { buildDepositProtocolPdf } from "@/lib/deposit-protocol";
import { getStockTraceabilityDetailFromDb } from "@/lib/stock";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const detail = await getStockTraceabilityDetailFromDb(id);

  if (!detail) {
    return NextResponse.json({ error: "Protocolo de depósito não encontrado." }, { status: 404 });
  }

  const pdfBytes = buildDepositProtocolPdf(detail);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${detail.protocol.toLowerCase()}-protocolo.pdf"`,
    },
  });
}
