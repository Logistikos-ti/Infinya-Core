import { gunzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseNfeXml } from "@/lib/nfe-import";
import { documentsBucketName } from "@/lib/storage";

export type ShippingDanfeValidationResult = {
  valid: boolean;
  noteNumber: string | null;
  recipientName: string | null;
  accessKey: string | null;
  message: string;
};

export async function validateShippingDanfeScan(
  adminSupabase: SupabaseClient,
  orderId: string,
  scannedCode: string,
): Promise<ShippingDanfeValidationResult> {
  const normalizedScan = normalizeDanfeCode(scannedCode);
  if (!normalizedScan) {
    return invalidResult("Bipe o código de barras da DANFE simplificada.");
  }

  const { data: document, error: documentError } = await adminSupabase
    .from("documentos_armazenados")
    .select("caminho_storage, mime_type")
    .eq("pedido_expedicao_id", orderId)
    .eq("tipo", "NF")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (documentError || !document) {
    return invalidResult("Este pedido ainda não possui XML da NF-e para validar a DANFE.");
  }

  const downloadResult = await adminSupabase.storage
    .from(documentsBucketName)
    .download(document.caminho_storage);

  if (downloadResult.error || !downloadResult.data) {
    return invalidResult("Não foi possível carregar o XML da NF-e armazenado.");
  }

  let xmlBytes = Buffer.from(await downloadResult.data.arrayBuffer());
  if ((document.mime_type || "").includes("xml") && isGzipBuffer(xmlBytes)) {
    xmlBytes = gunzipSync(xmlBytes);
  }

  try {
    const parsed = parseNfeXml(xmlBytes.toString("utf-8"));
    const accessKey = normalizeDanfeCode(parsed.accessKey ?? "");
    const noteNumber = normalizeDanfeCode(parsed.noteNumber);
    const valid = normalizedScan === accessKey || normalizedScan === noteNumber;

    return {
      valid,
      noteNumber: parsed.noteNumber,
      recipientName: parsed.recipientName,
      accessKey: parsed.accessKey,
      message: valid
        ? `DANFE validada. NF ${parsed.noteNumber} - ${parsed.recipientName}.`
        : "A DANFE bipada não pertence a este pedido.",
    };
  } catch {
    return invalidResult("Não foi possível interpretar o XML da NF-e deste pedido.");
  }
}

export function normalizeDanfeCode(value: string) {
  return value.replace(/\D/g, "");
}

function invalidResult(message: string): ShippingDanfeValidationResult {
  return {
    valid: false,
    noteNumber: null,
    recipientName: null,
    accessKey: null,
    message,
  };
}

function isGzipBuffer(value: Buffer) {
  return value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;
}
