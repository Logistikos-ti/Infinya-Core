import { NextResponse } from "next/server";
import { getReceivingOrderById } from "@/lib/wms-data";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const order = getReceivingOrderById(id);

  if (!order) {
    return NextResponse.json(
      { error: "Pedido de recebimento não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(order);
}
