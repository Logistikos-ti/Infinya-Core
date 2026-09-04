import Link from "next/link";
import { notFound } from "next/navigation";
import { PenLine, Truck, User } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { getRomaneioRecordDetailFromDb } from "@/lib/romaneio-records";
import { mobileColors, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";
import { DownloadPhotoButton } from "./download-photo-button";

type FotoRomaneioPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
};

/**
 * Dedicated full-screen viewer for a romaneio audit photo, linked from the
 * PhotoCheck cards on the "Visualizar Romaneio" summary. Opening the raw
 * /api/romaneio/[id]/foto image response directly in a browser tab (the
 * previous behaviour) handed the layout entirely to the browser's own
 * minimal image viewer, which on mobile rendered the photo tiny and
 * pinned to the top with a lot of dead white space below it. This page
 * takes over that layout instead: same dark shell as the rest of the
 * app, image centered and scaled to fill the available space via
 * object-fit: contain (never cropped, never oversized).
 */
export default async function FotoRomaneioPage({ params, searchParams }: FotoRomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const { id } = await params;
  const { type } = await searchParams;

  if (type !== "operador" && type !== "motorista") {
    notFound();
  }

  const romaneio = await getRomaneioRecordDetailFromDb(user, id);
  if (!romaneio) {
    notFound();
  }

  const { hasPhoto, captureType } = parsePhotoMeta(romaneio.conferenceInfoJson, type);
  if (!hasPhoto) {
    notFound();
  }

  const imageSrc = `/api/romaneio/${id}/foto?type=${type}`;
  const isSignature = type === "motorista" && captureType === "assinatura";
  const label = isSignature ? "Assinatura do motorista" : type === "operador" ? "Foto do operador" : "Foto do motorista / carga";
  const Icon = isSignature ? PenLine : type === "operador" ? User : Truck;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: "18px 18px 14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href={`/m/romaneio/${id}/visualizar`}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
            background: hexAlpha("#94A3B8", 0.06),
            color: mobileColors.text,
            cursor: "pointer",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          &#8249;
        </Link>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span className="flex items-center gap-1.5" style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>
            <Icon className="h-4 w-4" style={{ color: mobileColors.green }} />
            {label}
          </span>
          <span style={{ fontSize: 12, color: mobileColors.muted }}>{romaneio.code}</span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 14px 14px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- proxied binary response, not a static/optimizable asset */}
        <img
          src={imageSrc}
          alt={label}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            borderRadius: 16,
            border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
          }}
        />
      </div>

      <div style={{ flexShrink: 0, padding: "0 18px 24px" }}>
        <DownloadPhotoButton imageSrc={imageSrc} fileName={`romaneio-${romaneio.code}-${type}.${isSignature ? "png" : "jpg"}`} />
      </div>
    </div>
  );
}

function parsePhotoMeta(notes: string | null, type: "operador" | "motorista") {
  const empty = { hasPhoto: false, captureType: "foto" as const };
  if (!notes) return empty;
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    const key = type === "operador" ? "foto_operador_url" : "foto_motorista_url";
    const value = parsed[key];
    const hasPhoto = typeof value === "string" && value.length > 0;
    const captureType = parsed.foto_motorista_tipo === "assinatura" ? ("assinatura" as const) : ("foto" as const);
    return { hasPhoto, captureType };
  } catch {
    return empty;
  }
}
