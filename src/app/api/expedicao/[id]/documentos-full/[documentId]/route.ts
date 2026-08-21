import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiShippingDocumentAccess } from "@/lib/api-auth";
import { documentsBucketName } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteProps = {
  params: Promise<{ id: string; documentId: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const auth = await requireApiShippingDocumentAccess();
  if (auth.response) return auth.response;

  const { id, documentId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: order } = await admin
    .from("pedidos_expedicao")
    .select("depositante_id, remessa_full_id")
    .eq("id", id)
    .maybeSingle();

  if (!order?.remessa_full_id) {
    return NextResponse.json({ error: "Pedido Full não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, order.depositante_id);
  if (scopeError) return scopeError;

  const { data: document } = await admin
    .from("remessas_full_documentos")
    .select("id, nome_arquivo, caminho_storage, mime_type")
    .eq("id", documentId)
    .eq("remessa_full_id", order.remessa_full_id)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "Documento Full não encontrado." }, { status: 404 });
  }

  const download = await admin.storage
    .from(documentsBucketName)
    .download(document.caminho_storage);
  if (download.error || !download.data) {
    return NextResponse.json({ error: "Não foi possível carregar o arquivo." }, { status: 500 });
  }

  let bytes = Buffer.from(await download.data.arrayBuffer());
  if ((document.mime_type || "").includes("xml") && isGzipBuffer(bytes)) {
    bytes = gunzipSync(bytes);
  }

  const disposition = new URL(request.url).searchParams.get("disposition") === "inline"
    ? "inline"
    : "attachment";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": resolveContentType(document.mime_type),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(document.nome_arquivo)}"`,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function resolveContentType(mimeType: string | null) {
  return mimeType?.includes("xml") ? "application/xml; charset=utf-8" : mimeType || "application/octet-stream";
}

function isGzipBuffer(value: Buffer) {
  return value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;
}
