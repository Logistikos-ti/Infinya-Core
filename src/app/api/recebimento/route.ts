import { NextResponse } from "next/server";
import {
  listOperationalIssues,
  listReceivingOrders,
  listReceivingTasks,
} from "@/lib/wms-data";
import { receivingOrderDraftSchema } from "@/lib/validations/receiving";

export async function GET() {
  return NextResponse.json({
    orders: listReceivingOrders(),
    tasks: listReceivingTasks(),
    issues: listOperationalIssues(),
  });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = receivingOrderDraftSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload inválido para abertura de recebimento.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const code = `REC-DRAFT-${Date.now()}`;

  return NextResponse.json(
    {
      message: "Rascunho de recebimento validado com sucesso.",
      draft: {
        id: code.toLowerCase(),
        code,
        ...parsed.data,
      },
    },
    { status: 201 },
  );
}
