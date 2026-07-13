export const documentsBucketName = "wms-documentos";
export const depositantesLogosBucketName = "wms-depositantes-logos";
export const produtosImagesBucketName = "wms-produtos-imagens";

export const allowedDocumentMimeTypes = [
  "application/pdf",
  "application/xml",
  "text/xml",
  "image/png",
  "image/jpeg",
] as const;

export const maxDocumentFileSizeBytes = 10 * 1024 * 1024;
export const maxDepositanteLogoFileSizeBytes = 2 * 1024 * 1024;
export const maxProdutoImageFileSizeBytes = 3 * 1024 * 1024;

export const allowedDepositanteLogoMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const allowedProdutoImageMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
