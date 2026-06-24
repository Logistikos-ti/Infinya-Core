import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { buildRomaneioPdf } from "@/lib/romaneio-pdf";
import { getRomaneioGroupFromIds } from "@/lib/romaneio";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("romaneio");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const ids = [...new Set(searchParams.getAll("ids").map((item) => item.trim()).filter(Boolean))];

  if (!ids.length) {
    return NextResponse.json(
      { error: "Selecione ao menos um pedido para emitir o romaneio." },
      { status: 400 },
    );
  }

  const group = await getRomaneioGroupFromIds(auth.user, ids);

  if (!group) {
    return NextResponse.json(
      { error: "Nenhum pedido válido foi encontrado para este romaneio." },
      { status: 404 },
    );
  }

  const pdfBytes = buildRomaneioPdf(group);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="romaneio-${group.slug || "expedicao"}.pdf"`,
    },
  });
}
