import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { getShippingOrderDetailFromDb } from "@/lib/shipping";
import { buildShippingLabelDocument } from "@/lib/shipping-label";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiModuleAccess("expedicao");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const order = await getShippingOrderDetailFromDb(id, auth.user);

  if (!order) {
    return NextResponse.json({ error: "Pedido de expedição não encontrado." }, { status: 404 });
  }

  const url = new URL(request.url);
  const requestedFormat = url.searchParams.get("format")?.toUpperCase();
  const format = requestedFormat === "ZPL" ? "ZPL" : "PDF";
  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  const document = buildShippingLabelDocument(order, format);

  return new NextResponse(document.bytes, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `${disposition}; filename="${document.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
