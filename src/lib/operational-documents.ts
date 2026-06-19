import type { SupabaseClient } from "@supabase/supabase-js";
import { documentsBucketName, sanitizeFileName } from "@/lib/storage";

type StoredDocumentRow = {
  id: string;
  tipo: string;
  nome_arquivo: string;
  created_at: string;
  pedido_expedicao_id: string | null;
};

export async function listShippingOrderDocumentTypes(
  adminSupabase: SupabaseClient,
  shippingOrderId: string,
) {
  const { data, error } = await adminSupabase
    .from("documentos_armazenados")
    .select("tipo")
    .eq("pedido_expedicao_id", shippingOrderId);

  if (error) {
    throw error;
  }

  return new Set(
    ((data as Array<{ tipo: string }> | null) ?? [])
      .map((item) => item.tipo)
      .filter(Boolean),
  );
}

export async function storeOperationalDocumentFromBuffer({
  adminSupabase,
  depositanteId,
  tipo,
  fileName,
  mimeType,
  bytes,
  pedidoExpedicaoId = null,
  pedidoRecebimentoId = null,
  enviadoPor = null,
}: {
  adminSupabase: SupabaseClient;
  depositanteId: string;
  tipo: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  pedidoExpedicaoId?: string | null;
  pedidoRecebimentoId?: string | null;
  enviadoPor?: string | null;
}) {
  const safeName = sanitizeFileName(fileName);
  const extension = safeName.includes(".") ? safeName.split(".").pop() : "";
  const finalName = extension ? safeName : `${safeName}.bin`;
  const storagePath = `${depositanteId}/${new Date().getFullYear()}/${crypto.randomUUID()}-${finalName}`;

  const uploadResult = await adminSupabase.storage
    .from(documentsBucketName)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadResult.error) {
    throw new Error(`Falha ao enviar arquivo para o Storage: ${uploadResult.error.message}`);
  }

  const { data, error } = await adminSupabase
    .from("documentos_armazenados")
    .insert({
      depositante_id: depositanteId,
      pedido_recebimento_id: pedidoRecebimentoId,
      pedido_expedicao_id: pedidoExpedicaoId,
      tipo,
      nome_arquivo: fileName,
      caminho_storage: storagePath,
      mime_type: mimeType,
      tamanho_bytes: bytes.byteLength,
      enviado_por: enviadoPor,
    })
    .select("id, tipo, nome_arquivo, created_at, pedido_expedicao_id")
    .single();

  if (error) {
    await adminSupabase.storage.from(documentsBucketName).remove([storagePath]);
    throw error;
  }

  return data as StoredDocumentRow;
}
