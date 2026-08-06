import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { getRomaneioRecordDetailFromDb } from "@/lib/romaneio-records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { documentsBucketName } from "@/lib/storage";

type RouteProps = {
  params: Promise<{ id: string }>;
};

/**
 * Proxies an audit photo captured during romaneio closing (double-check
 * operator/driver photos, PhotoCheck cards on the "Visualizar Romaneio"
 * mobile page). The URL saved on the romaneio (foto_operador_url /
 * foto_motorista_url inside notes) is a Supabase Storage "public" URL,
 * but the wms-documentos bucket itself is private (see
 * supabase/migrations/20260612143000_create_storage_bucket.sql) --
 * hitting that URL directly 404s. This route authenticates the request
 * the same way the rest of the app does, then downloads the file with
 * the admin client and streams it back, mirroring the pattern in
 * src/app/api/documentos/[id]/download/route.ts.
 */
export async function GET(request: Request, { params }: RouteProps) {
  const auth = await requireApiModuleAccess("romaneio");
  if (auth.response) {
    return auth.response;
  }

  const { id } = await params;
  const type = new URL(request.url).searchParams.get("type");
  if (type !== "operador" && type !== "motorista") {
    return NextResponse.json({ error: "Tipo de foto inválido." }, { status: 400 });
  }

  const romaneio = await getRomaneioRecordDetailFromDb(auth.user, id);
  if (!romaneio) {
    return NextResponse.json({ error: "Romaneio não encontrado." }, { status: 404 });
  }

  const photoUrl = extractPhotoUrl(romaneio.notes, type);
  if (!photoUrl) {
    return NextResponse.json({ error: "Nenhuma foto registrada para este romaneio." }, { status: 404 });
  }

  const storagePath = extractStoragePath(photoUrl);
  if (!storagePath) {
    // Not a Supabase Storage URL -- e.g. the base64 data-uri fallback
    // uploadRomaneioPhotoAction returns when the original upload failed.
    // Browsers block top-level navigation to a data: URL reached via a
    // redirect, so decode it here and serve it the same way as a real
    // storage download instead of just forwarding the raw value.
    const dataUriMatch = photoUrl.match(/^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/);
    if (dataUriMatch) {
      return respondWithImage(Buffer.from(dataUriMatch[2], "base64"), dataUriMatch[1], type);
    }
    // Some other absolute URL -- best effort, just send the browser there.
    return NextResponse.redirect(photoUrl);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(documentsBucketName).download(storagePath);

  if (error || !data) {
    return NextResponse.json({ error: "Não foi possível carregar a foto." }, { status: 500 });
  }

  return respondWithImage(Buffer.from(await data.arrayBuffer()), "image/jpeg", type);
}

function respondWithImage(bytes: Buffer, contentType: string, type: "operador" | "motorista") {
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="romaneio-${type}.jpg"`,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function extractPhotoUrl(notes: string | null, type: "operador" | "motorista") {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    const key = type === "operador" ? "foto_operador_url" : "foto_motorista_url";
    const value = parsed[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

// Supabase's public-URL shape is {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}.
function extractStoragePath(url: string) {
  const marker = `/object/public/${documentsBucketName}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}
