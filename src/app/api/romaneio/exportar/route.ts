import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { buildRomaneioRecordsSummaryPdf } from "@/lib/romaneio-pdf";
import { getRomaneioRecordDetailFromDb } from "@/lib/romaneio-records";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("romaneio");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!ids.length) {
    return NextResponse.json({ error: "Selecione ao menos um romaneio para exportar." }, { status: 400 });
  }

  const records = await Promise.all(ids.map((id) => getRomaneioRecordDetailFromDb(auth.user, id)));
  const foundRecords = records.filter((record): record is NonNullable<typeof record> => record !== null);

  if (!foundRecords.length) {
    return NextResponse.json({ error: "Nenhum dos romaneios selecionados foi encontrado." }, { status: 404 });
  }

  const pdfBytes = buildRomaneioRecordsSummaryPdf(foundRecords);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="romaneios-resumo-${stamp}.pdf"`,
    },
  });
}
