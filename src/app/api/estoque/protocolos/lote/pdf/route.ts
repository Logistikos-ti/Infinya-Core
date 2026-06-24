import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { buildDepositProtocolBatchPdf } from "@/lib/deposit-protocol";
import { getStockTraceabilityDetailFromDb } from "@/lib/stock";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const ids = [...new Set(searchParams.getAll("ids").map((item) => item.trim()).filter(Boolean))];

  if (!ids.length) {
    return NextResponse.json(
      { error: "Selecione ao menos um protocolo para emissão em lote." },
      { status: 400 },
    );
  }

  const details = (
    await Promise.all(ids.map((id) => getStockTraceabilityDetailFromDb(id)))
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!details.length) {
    return NextResponse.json(
      { error: "Nenhum protocolo válido foi encontrado para emissão em lote." },
      { status: 404 },
    );
  }

  const pdfBytes = buildDepositProtocolBatchPdf(details);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="protocolos-deposito-lote.pdf"`,
    },
  });
}
