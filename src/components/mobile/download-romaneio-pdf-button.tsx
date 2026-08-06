"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

/**
 * A plain `<a href={pdfUrl} target="_blank">` opens the PDF in a new tab,
 * but in a mobile/PWA context that new tab often has no browser chrome at
 * all -- no address bar, no back button -- leaving the operator stuck on
 * the PDF with no way back to the app. Same problem already fixed for the
 * romaneio export (handleExport in romaneio-list-client.tsx) and for the
 * audit photo download (DownloadPhotoButton): fetch the bytes as a blob
 * and trigger a save via a temporary object-URL <a>, so this screen never
 * navigates away. The PDF still opens fine afterward, just from the
 * device's own downloads/files app instead of a dead-end tab.
 */
export function DownloadRomaneioPdfButton({
  pdfUrl,
  fileName,
  label = "Baixar PDF do Romaneio",
  loadingLabel = "Gerando PDF...",
  className,
  style,
}: {
  pdfUrl: string;
  fileName: string;
  label?: string;
  loadingLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (isDownloading) return;
    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Não foi possível baixar o PDF.");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Falha ao baixar o PDF. Tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p
          className="rounded-xl px-3 py-2 text-center text-[12px] font-medium"
          style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}
        >
          {error}
        </p>
      )}
      <button type="button" onClick={handleDownload} disabled={isDownloading} className={className} style={style}>
        <FileDown className="h-4 w-4 shrink-0" />
        <span>{isDownloading ? loadingLabel : label}</span>
      </button>
    </div>
  );
}
