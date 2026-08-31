import { NextRequest, NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "suporte-anexos";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB por arquivo

// Recebe fotos/documentos, sobe pro bucket público de anexos (via service_role)
// e devolve as URLs; o cliente depois envia essas URLs junto do comentário.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"]);
  if (auth.response) return auth.response;
  const { id } = await params;

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const anexos: Array<{ url: string; nome: string; tipo: string; tamanho: number }> = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `"${file.name}" excede o limite de 10 MB.` }, { status: 400 });
    }
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${id}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      return NextResponse.json(
        { error: `Falha ao enviar "${file.name}": ${error.message}` },
        { status: 500 },
      );
    }
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    anexos.push({
      url: data.publicUrl,
      nome: file.name,
      tipo: file.type || "application/octet-stream",
      tamanho: file.size,
    });
  }

  return NextResponse.json({ anexos }, { status: 201 });
}
