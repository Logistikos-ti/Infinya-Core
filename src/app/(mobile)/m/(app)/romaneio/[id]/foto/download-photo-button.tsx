"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { mobileColors, hexAlpha } from "@/components/mobile/mobile-kit-tokens";

/**
 * A plain `<a href={imageSrc} download>` still navigates the tab to the
 * image URL in some mobile/PWA contexts instead of triggering a save --
 * the exact same "stuck with no way back" problem already fixed for the
 * romaneio PDF export (see handleExport in romaneio-list-client.tsx).
 * Same fix here: fetch the bytes as a blob and trigger the save via a
 * temporary object-URL <a>, so the viewer page never navigates away.
 */
export function DownloadPhotoButton({ imageSrc, fileName }: { imageSrc: string; fileName: string }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (isDownloading) return;
    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch(imageSrc);
      if (!response.ok) throw new Error("Não foi possível baixar a foto.");

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
      setError("Falha ao baixar a foto. Tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p
          className="rounded-xl px-3 py-2 text-center text-[12px] font-medium"
          style={{ background: hexAlpha(mobileColors.red, 0.12), color: mobileColors.red }}
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-70"
        style={{ border: `1px solid ${hexAlpha("#94A3B8", 0.2)}`, background: hexAlpha("#94A3B8", 0.06), color: mobileColors.muted }}
      >
        <Download className="h-4 w-4" />
        {isDownloading ? "Baixando..." : "Baixar foto"}
      </button>
    </div>
  );
}
