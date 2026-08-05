import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saidaManualFotosBucketName, maxSaidaManualFotoFileSizeBytes, allowedSaidaManualFotoMimeTypes, sanitizeFileName } from "@/lib/storage";

type ManualStockExitInput = {
  userId: string;
  depositanteId: string;
  stockId: string;
  quantity: number;
  reason: string;
  fotoUrl?: string | null;
};

export async function uploadManualExitPhoto({
  depositanteId,
  fileName,
  mimeType,
  bytes,
}: {
  depositanteId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const supabase = createSupabaseAdminClient();

  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((bucket) => bucket.id === saidaManualFotosBucketName);
  if (!bucketExists) {
    await supabase.storage.createBucket(saidaManualFotosBucketName, {
      public: true,
      fileSizeLimit: maxSaidaManualFotoFileSizeBytes,
      allowedMimeTypes: [...allowedSaidaManualFotoMimeTypes],
    });
  }

  const safeName = sanitizeFileName(fileName || "avaria.jpg");
  const extension = safeName.includes(".") ? safeName.split(".").pop() : "jpg";
  const storagePath = `${depositanteId}/${new Date().getFullYear()}/${randomUUID()}.${extension}`;

  const uploadResult = await supabase.storage.from(saidaManualFotosBucketName).upload(storagePath, bytes, {
    contentType: mimeType,
    upsert: false,
  });

  if (uploadResult.error) {
    throw new Error(`Falha ao enviar a foto: ${uploadResult.error.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(saidaManualFotosBucketName).getPublicUrl(storagePath);

  return publicUrlData.publicUrl;
}

export async function createManualStockExit(input: ManualStockExitInput) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Informe uma quantidade maior que zero para a saída.");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Informe o motivo da saída manual.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: stock, error: stockError } = await supabase
    .from("estoque")
    .select("id, depositante_id, produto_id, endereco_id, quantidade, quantidade_reservada, bloqueado")
    .eq("id", input.stockId)
    .maybeSingle();

  if (stockError) {
    throw new Error(`Falha ao localizar o saldo: ${stockError.message}`);
  }
  if (!stock) {
    throw new Error("Saldo de estoque não encontrado.");
  }
  if (stock.depositante_id !== input.depositanteId) {
    throw new Error("O saldo selecionado não pertence ao depositante informado.");
  }
  if (stock.bloqueado) {
    throw new Error("Não é possível dar saída em um saldo bloqueado.");
  }

  const currentQuantity = Number(stock.quantidade ?? 0);
  const reservedQuantity = Number(stock.quantidade_reservada ?? 0);
  const availableQuantity = Math.max(currentQuantity - reservedQuantity, 0);

  if (input.quantity > availableQuantity) {
    throw new Error(`A saída solicitada é maior que o saldo disponível (${availableQuantity.toLocaleString("pt-BR")} un).`);
  }

  const nextQuantity = currentQuantity - input.quantity;
  const { data: updatedRows, error: updateError } = await supabase
    .from("estoque")
    .update({ quantidade: nextQuantity })
    .eq("id", stock.id)
    .eq("quantidade", currentQuantity)
    .select("id");

  if (updateError) {
    throw new Error(`Falha ao baixar o saldo: ${updateError.message}`);
  }
  if (!updatedRows?.length) {
    throw new Error("O saldo foi alterado por outra operação. Atualize a tela e tente novamente.");
  }

  const { error: movementError } = await supabase.from("movimentacoes_estoque").insert({
    depositante_id: stock.depositante_id,
    estoque_id: stock.id,
    produto_id: stock.produto_id,
    endereco_origem_id: stock.endereco_id,
    endereco_destino_id: null,
    tipo: "SAIDA",
    quantidade: input.quantity,
    referencia_tipo: "SAIDA_MANUAL",
    observacoes: reason,
    criado_por: input.userId,
    foto_url: input.fotoUrl ?? null,
  });

  if (movementError) {
    await supabase
      .from("estoque")
      .update({ quantidade: currentQuantity })
      .eq("id", stock.id)
      .eq("quantidade", nextQuantity);
    throw new Error(`Falha ao registrar a saída manual: ${movementError.message}`);
  }

  return {
    stockId: stock.id,
    previousQuantity: currentQuantity,
    quantity: nextQuantity,
    movedQuantity: input.quantity,
  };
}
