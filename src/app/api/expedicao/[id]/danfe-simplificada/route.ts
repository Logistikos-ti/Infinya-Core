import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { buildSimplifiedDanfePdfFromXml } from "@/lib/shipping-danfe";
import { documentsBucketName } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  const adminSupabase = createSupabaseAdminClient();
  const disposition = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";

  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, codigo, depositante_id, origem")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      { error: `Não foi possível carregar o pedido de expedição: ${orderError.message}` },
      { status: 500 },
    );
  }

  if (!order) {
    return NextResponse.json({ error: "Pedido de expedição não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, order.depositante_id);
  if (scopeError) {
    return scopeError;
  }

  const { data: xmlDocument, error: documentError } = await adminSupabase
    .from("documentos_armazenados")
    .select("id, nome_arquivo, caminho_storage, mime_type")
    .eq("pedido_expedicao_id", id)
    .or("tipo.eq.NF,mime_type.ilike.%xml%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json(
      { error: `Não foi possível localizar o XML da nota fiscal: ${documentError.message}` },
      { status: 500 },
    );
  }

  if (!xmlDocument) {
    return NextResponse.json(
      { error: "Este pedido ainda não possui XML da nota fiscal anexado para gerar a DANFE simplificada." },
      { status: 409 },
    );
  }

  const downloadResult = await adminSupabase.storage
    .from(documentsBucketName)
    .download(xmlDocument.caminho_storage);

  if (downloadResult.error || !downloadResult.data) {
    return NextResponse.json(
      { error: "Não foi possível carregar o XML armazenado da nota fiscal." },
      { status: 500 },
    );
  }

  let xmlBytes = Buffer.from(await downloadResult.data.arrayBuffer());
  if ((xmlDocument.mime_type || "").includes("xml") && isGzipBuffer(xmlBytes)) {
    xmlBytes = gunzipSync(xmlBytes);
  }

  try {
    const pdfBytes = buildSimplifiedDanfePdfFromXml(xmlBytes.toString("utf-8"));

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${order.codigo.toLowerCase()}-danfe-simplificada.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar a DANFE simplificada a partir do XML da NF-e.",
      },
      { status: 500 },
    );
  }
}

function isGzipBuffer(value: Buffer) {
  return value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;
}
