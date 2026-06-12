import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentsBucketName } from "@/lib/storage";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const user = await getCurrentUserContext();

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: document } = await supabase
    .from("documentos_armazenados")
    .select("id, nome_arquivo, caminho_storage")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const adminSupabase = createSupabaseAdminClient();
  const signedUrlResult = await adminSupabase.storage
    .from(documentsBucketName)
    .createSignedUrl(document.caminho_storage, 60);

  if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
    return NextResponse.json(
      { error: "Não foi possível gerar o link temporário do documento." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signedUrlResult.data.signedUrl, 302);
}
