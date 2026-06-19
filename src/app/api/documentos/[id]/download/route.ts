import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentsBucketName } from "@/lib/storage";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const auth = await requireApiModuleAccess("nfe");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const disposition =
    new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  const supabase = await createSupabaseServerClient();

  const { data: document } = await supabase
    .from("documentos_armazenados")
    .select("id, nome_arquivo, caminho_storage, depositante_id, mime_type")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, document.depositante_id);

  if (scopeError) {
    return scopeError;
  }

  const adminSupabase = createSupabaseAdminClient();
  const downloadResult = await adminSupabase.storage
    .from(documentsBucketName)
    .download(document.caminho_storage);

  if (downloadResult.error || !downloadResult.data) {
    return NextResponse.json(
      { error: "Não foi possível carregar o documento armazenado." },
      { status: 500 },
    );
  }

  const bytes = Buffer.from(await downloadResult.data.arrayBuffer());

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": document.mime_type || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(document.nome_arquivo)}"`,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
