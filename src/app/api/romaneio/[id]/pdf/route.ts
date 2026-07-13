import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { buildRomaneioRecordPdf } from "@/lib/romaneio-pdf";
import { getRomaneioRecordDetailFromDb } from "@/lib/romaneio-records";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiModuleAccess("romaneio");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const record = await getRomaneioRecordDetailFromDb(auth.user, id);

  if (!record) {
    return NextResponse.json(
      { error: "Romaneio não encontrado para emissão do PDF." },
      { status: 404 },
    );
  }

  const pdfBytes = buildRomaneioRecordPdf(record);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="romaneio-${record.code.toLowerCase()}.pdf"`,
    },
  });
}
