import { NextResponse } from "next/server";
import { gunzipSync } from "node:zlib";
import { ensureUserCanAccessDepositante, requireApiUser } from "@/lib/api-auth";
import { canAccessModule } from "@/lib/permissions";
import {
  buildFullDanfePdfFromXml,
  buildSimplifiedDanfePdfFromXml,
} from "@/lib/shipping-danfe";
import { documentsBucketName } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteProps = {
  params: Promise<{ id: string }>;
};

// Gera a DANFE (PDF) de uma NF-e armazenada a partir do XML autorizado,
// reaproveitando o mesmo gerador usado na expedição. Por padrão devolve o
// documento inline para visualização no drawer/nova aba.
export async function GET(request: Request, { params }: RouteProps) {
  const auth = await requireApiUser();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const url = new URL(request.url);
  const disposition = url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
  const modelo = url.searchParams.get("modelo") === "simplificada" ? "simplificada" : "completa";
  const supabase = await createSupabaseServerClient();

  const { data: document } = await supabase
    .from("documentos_armazenados")
    .select("id, nome_arquivo, caminho_storage, depositante_id, mime_type, tipo")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  if (document.tipo !== "NF") {
    return NextResponse.json(
      { error: "Este documento não é uma NF-e." },
      { status: 400 },
    );
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, document.depositante_id);

  if (scopeError) {
    return scopeError;
  }

  if (!canAccessModule(auth.user, "nfe")) {
    return NextResponse.json(
      { error: "Seu perfil não tem acesso a este documento." },
      { status: 403 },
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const downloadResult = await adminSupabase.storage
    .from(documentsBucketName)
    .download(document.caminho_storage);

  if (downloadResult.error || !downloadResult.data) {
    return NextResponse.json(
      { error: "Não foi possível carregar o XML armazenado da nota fiscal." },
      { status: 500 },
    );
  }

  let bytes = Buffer.from(await downloadResult.data.arrayBuffer());

  if ((document.mime_type || "").includes("xml") && isGzipBuffer(bytes)) {
    bytes = gunzipSync(bytes);
  }

  const source = bytes.toString("utf-8");

  try {
    let pdfBytes: Buffer;
    if (modelo === "simplificada") {
      pdfBytes = buildSimplifiedDanfePdfFromXml(source);
    } else {
      try {
        pdfBytes = buildFullDanfePdfFromXml(source);
      } catch {
        // A DANFE completa é mais exigente com o XML; se falhar, a simplificada
        // ainda entrega uma representação válida em vez de um erro seco.
        pdfBytes = buildSimplifiedDanfePdfFromXml(source);
      }
    }

    const filename = `${(document.nome_arquivo || `nfe-${id}`).replace(/\.[^.]+$/, "")}-danfe.pdf`;

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBytes.byteLength),
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar a DANFE a partir do XML da NF-e.",
      },
      { status: 500 },
    );
  }
}

function isGzipBuffer(value: Buffer) {
  return value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;
}
