import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  faturasBucketName,
  maxFaturaFileSizeBytes,
  allowedFaturaMimeTypes,
  sanitizeFileName,
} from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

async function ensureFaturasBucket(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.id === faturasBucketName)) return;

  await admin.storage.createBucket(faturasBucketName, {
    public: true,
    fileSizeLimit: maxFaturaFileSizeBytes,
    allowedMimeTypes: [...allowedFaturaMimeTypes],
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const admin = createSupabaseAdminClient();

  const { data: fatura } = await admin
    .from("faturas")
    .select("id, depositante_id, boleto_url, nf_url, status")
    .eq("id", id)
    .single();

  if (!fatura) {
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }

  const formData = await request.formData();
  const tipo = String(formData.get("tipo") ?? "").trim();
  const file = formData.get("file");

  if (tipo !== "boleto" && tipo !== "nf") {
    return NextResponse.json({ error: "Tipo deve ser 'boleto' ou 'nf'." }, { status: 400 });
  }

  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }

  if (file.size > maxFaturaFileSizeBytes) {
    return NextResponse.json({ error: "Arquivo excede 10 MB." }, { status: 400 });
  }

  if (!allowedFaturaMimeTypes.includes(file.type as typeof allowedFaturaMimeTypes[number])) {
    return NextResponse.json({ error: "Tipo de arquivo não permitido. Use PDF, PNG ou JPEG." }, { status: 400 });
  }

  await ensureFaturasBucket(admin);

  const safeName = sanitizeFileName(file.name || tipo);
  const extension = safeName.split(".").pop() || "pdf";
  const storagePath = `${fatura.depositante_id}/${id}/${tipo}-${randomUUID()}.${extension}`;
  const fileBytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(faturasBucketName)
    .upload(storagePath, fileBytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Falha no upload: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = admin.storage
    .from(faturasBucketName)
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // Anexar o boleto já deixa a fatura pronta pra cobrança — promove
  // Fechada -> Enviada (mesmo status usado pelo botão "Enviar por e-mail")
  // sem disparar o e-mail automático; o depositante passa a ver o boleto
  // assim que entrar no portal.
  const updatePayload =
    tipo === "boleto"
      ? {
          boleto_url: publicUrl,
          boleto_nome: file.name,
          ...(fatura.status === "FECHADA"
            ? { status: "ENVIADA", enviado_em: new Date().toISOString() }
            : {}),
        }
      : { nf_url: publicUrl, nf_nome: file.name };

  const { error: dbError } = await admin
    .from("faturas")
    .update(updatePayload)
    .eq("id", id);

  if (dbError) {
    await admin.storage.from(faturasBucketName).remove([storagePath]);
    return NextResponse.json({ error: `Erro ao salvar: ${dbError.message}` }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl, nome: file.name, tipo });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");

  if (tipo !== "boleto" && tipo !== "nf") {
    return NextResponse.json({ error: "Tipo deve ser 'boleto' ou 'nf'." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: fatura } = await admin
    .from("faturas")
    .select("id, boleto_url, nf_url")
    .eq("id", id)
    .single();

  if (!fatura) {
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }

  const url = tipo === "boleto" ? fatura.boleto_url : fatura.nf_url;

  if (url) {
    const pathMatch = url.match(/\/object\/public\/[^/]+\/(.+)$/);
    if (pathMatch?.[1]) {
      await admin.storage.from(faturasBucketName).remove([decodeURIComponent(pathMatch[1])]);
    }
  }

  const clearPayload =
    tipo === "boleto"
      ? { boleto_url: null, boleto_nome: null }
      : { nf_url: null, nf_nome: null };

  await admin.from("faturas").update(clearPayload).eq("id", id);

  return NextResponse.json({ removed: tipo });
}
