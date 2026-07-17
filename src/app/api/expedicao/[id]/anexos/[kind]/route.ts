import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { documentsBucketName } from "@/lib/storage";

type RouteProps = {
  params: Promise<{
    id: string;
    kind: string;
  }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const auth = await requireApiModuleAccess("expedicao");

  if (auth.response) {
    return auth.response;
  }

  const { id, kind } = await params;
  const normalizedKind = normalizeKind(kind);

  if (!normalizedKind) {
    return NextResponse.json({ error: "Tipo de anexo inválido." }, { status: 400 });
  }

  const disposition =
    new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  const adminSupabase = createSupabaseAdminClient();

  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, depositante_id")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      { error: `Não foi possível localizar o pedido: ${orderError.message}` },
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

  const { data: document, error: documentError } = await adminSupabase
    .from("documentos_armazenados")
    .select("id, nome_arquivo, caminho_storage, mime_type")
    .eq("pedido_expedicao_id", id)
    .eq("tipo", normalizedKind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json(
      { error: `Não foi possível localizar o anexo do pedido: ${documentError.message}` },
      { status: 500 },
    );
  }

  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const downloadResult = await adminSupabase.storage
    .from(documentsBucketName)
    .download(document.caminho_storage);

  if (downloadResult.error || !downloadResult.data) {
    return NextResponse.json(
      { error: "Não foi possível carregar o documento armazenado." },
      { status: 500 },
    );
  }

  let bytes = Buffer.from(await downloadResult.data.arrayBuffer());

  if ((document.mime_type || "").includes("xml") && isGzipBuffer(bytes)) {
    bytes = gunzipSync(bytes);
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": resolveContentType(document.mime_type),
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(document.nome_arquivo)}"`,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeKind(kind: string) {
  const normalized = kind.trim().toLowerCase();

  if (normalized === "xml-nf") {
    return "NF";
  }

  if (normalized === "etiqueta") {
    return "ETIQUETA";
  }

  return null;
}

function resolveContentType(mimeType: string | null) {
  if (mimeType?.includes("xml")) {
    return "application/xml; charset=utf-8";
  }

  return mimeType || "application/octet-stream";
}

function isGzipBuffer(value: Buffer) {
  return value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;
}
