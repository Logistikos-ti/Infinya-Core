import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { canUploadOperationalDocuments } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  allowedDocumentMimeTypes,
  documentsBucketName,
  maxDocumentFileSizeBytes,
  sanitizeFileName,
} from "@/lib/storage";

const tiposDocumentoPermitidos = new Set([
  "NF",
  "CTE",
  "ROMANEIO",
  "CHECKLIST",
  "FOTO",
  "COMPROVANTE",
  "OUTRO",
]);

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("nfe");

  if (auth.response) {
    return auth.response;
  }

  if (!canUploadOperationalDocuments(auth.user)) {
    return NextResponse.json(
      {
        error: "Seu perfil pode consultar documentos, mas não pode enviar novos arquivos.",
      },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim().toUpperCase();
  const file = formData.get("arquivo");

  if (!depositanteId) {
    return NextResponse.json({ error: "Selecione o depositante do documento." }, { status: 400 });
  }

  if (!tiposDocumentoPermitidos.has(tipo)) {
    return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione um arquivo para upload." }, { status: 400 });
  }

  if (!file.name) {
    return NextResponse.json({ error: "O arquivo precisa ter um nome válido." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "O arquivo enviado está vazio." }, { status: 400 });
  }

  if (file.size > maxDocumentFileSizeBytes) {
    return NextResponse.json({ error: "O arquivo excede o limite de 10 MB." }, { status: 400 });
  }

  if (!allowedDocumentMimeTypes.includes(file.type as (typeof allowedDocumentMimeTypes)[number])) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie PDF, XML, PNG ou JPG." },
      { status: 400 },
    );
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);

  if (scopeError) {
    return scopeError;
  }

  const adminSupabase = createSupabaseAdminClient();

  const { data: depositante } = await adminSupabase
    .from("depositantes")
    .select("id, nome")
    .eq("id", depositanteId)
    .maybeSingle();

  if (!depositante) {
    return NextResponse.json({ error: "Depositante não encontrado." }, { status: 404 });
  }

  const safeName = sanitizeFileName(file.name);
  const extension = safeName.includes(".") ? safeName.split(".").pop() : "";
  const fileName = extension ? safeName : `${safeName}.bin`;
  const storagePath = `${depositanteId}/${new Date().getFullYear()}/${crypto.randomUUID()}-${fileName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploadResult = await adminSupabase.storage
    .from(documentsBucketName)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return NextResponse.json(
      { error: `Falha ao enviar arquivo para o Storage: ${uploadResult.error.message}` },
      { status: 500 },
    );
  }

  const { data: insertedDocument, error: insertError } = await adminSupabase
    .from("documentos_armazenados")
    .insert({
      depositante_id: depositanteId,
      tipo,
      nome_arquivo: file.name,
      caminho_storage: storagePath,
      mime_type: file.type,
      tamanho_bytes: file.size,
      enviado_por: auth.user.id,
    })
    .select("id, nome_arquivo, tipo, created_at")
    .single();

  if (insertError) {
    await adminSupabase.storage.from(documentsBucketName).remove([storagePath]);

    return NextResponse.json(
      { error: `Falha ao registrar documento no banco: ${insertError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: `Upload concluído para ${depositante.nome}.`,
    document: insertedDocument,
  });
}
