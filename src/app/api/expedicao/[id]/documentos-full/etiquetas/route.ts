import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { ensureUserCanAccessDepositante, requireApiShippingDocumentAccess } from "@/lib/api-auth";
import { documentsBucketName } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteProps = {
  params: Promise<{ id: string }>;
};

const labelWidth = 100 * 2.834645669;
const labelHeight = 150 * 2.834645669;

export async function GET(request: Request, { params }: RouteProps) {
  const auth = await requireApiShippingDocumentAccess();
  if (auth.response) return auth.response;

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: order } = await admin
    .from("pedidos_expedicao")
    .select("depositante_id, remessa_full_id, numero_wms")
    .eq("id", id)
    .maybeSingle();

  if (!order?.remessa_full_id) {
    return NextResponse.json({ error: "Pedido Full não encontrado." }, { status: 404 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, order.depositante_id);
  if (scopeError) return scopeError;

  const { data: labels, error } = await admin
    .from("remessas_full_documentos")
    .select("nome_arquivo, caminho_storage, mime_type")
    .eq("remessa_full_id", order.remessa_full_id)
    .eq("tipo", "ETIQUETA_ITEM")
    .order("created_at", { ascending: true });

  if (error || !labels?.length) {
    return NextResponse.json({ error: "Nenhuma etiqueta de produto foi encontrada." }, { status: 404 });
  }

  const output = await PDFDocument.create();
  let printableFiles = 0;

  for (const label of labels) {
    const download = await admin.storage.from(documentsBucketName).download(label.caminho_storage);
    if (download.error || !download.data) continue;

    const bytes = new Uint8Array(await download.data.arrayBuffer());
    const mimeType = (label.mime_type || "").toLocaleLowerCase("pt-BR");
    try {
      if (mimeType.includes("pdf") || label.nome_arquivo.toLocaleLowerCase("pt-BR").endsWith(".pdf")) {
        const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await output.copyPages(source, source.getPageIndices());
        pages.forEach((page) => output.addPage(page));
        printableFiles += 1;
        continue;
      }

      const image = mimeType.includes("png")
        ? await output.embedPng(bytes)
        : mimeType.includes("jpeg") || mimeType.includes("jpg")
          ? await output.embedJpg(bytes)
          : null;
      if (!image) continue;

      const page = output.addPage([labelWidth, labelHeight]);
      const availableWidth = labelWidth - 24;
      const availableHeight = labelHeight - 24;
      const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, {
        x: (labelWidth - width) / 2,
        y: (labelHeight - height) / 2,
        width,
        height,
      });
      printableFiles += 1;
    } catch {
      // Um arquivo inválido não impede que as demais etiquetas sejam reunidas.
    }
  }

  if (!printableFiles || output.getPageCount() === 0) {
    return NextResponse.json(
      { error: "As etiquetas anexadas não estão em PDF, PNG ou JPG válido." },
      { status: 422 },
    );
  }

  const bytes = await output.save();
  const body = Uint8Array.from(bytes).buffer;
  const disposition = new URL(request.url).searchParams.get("disposition") === "attachment"
    ? "attachment"
    : "inline";
  const fileName = `etiquetas-full-${order.numero_wms ?? id}.pdf`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
