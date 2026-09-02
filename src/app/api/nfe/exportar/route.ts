import { NextResponse } from "next/server";
import { ensureUserCanAccessDepositante, requireApiUser } from "@/lib/api-auth";
import { canAccessModule } from "@/lib/permissions";
import { loadFiscalDocumentsForExport } from "@/lib/fiscal-documents";
import { buildCsv, buildPdf, buildXlsx, buildZip, nfeStatusKey } from "@/lib/nfe-export";
import type { FiscalDocumentDetail } from "@/lib/fiscal-documents";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function monthLabel(ym: string | null): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "todas";
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]}-${y}`;
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  if (!canAccessModule(auth.user, "nfe")) {
    return NextResponse.json({ error: "Sem acesso ao módulo de NF-e." }, { status: 403 });
  }

  const url = new URL(request.url);
  const mes = url.searchParams.get("mes");
  const tipo = url.searchParams.get("tipo"); // ENTRADA | SAIDA | null(todas)
  const status = url.searchParams.get("status"); // AUTORIZADA | ... | null
  const depositanteParam = url.searchParams.get("depositante") || undefined;
  const de = url.searchParams.get("de"); // yyyy-mm-dd
  const ate = url.searchParams.get("ate");
  const formato = (url.searchParams.get("formato") || "csv").toLowerCase();
  const incluirZip = url.searchParams.get("zip") === "1";

  // Depositante DEPOSITANTE só enxerga o próprio escopo.
  const isDepositante = auth.user.papel === "DEPOSITANTE";
  const depositanteScope = isDepositante ? auth.user.depositanteId ?? undefined : depositanteParam;
  if (depositanteScope) {
    const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteScope);
    if (scopeError) return scopeError;
  }

  let docs;
  try {
    docs = await loadFiscalDocumentsForExport(auth.user, {
      depositanteId: depositanteScope,
      month: mes ?? undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar as NF-e para exportação." },
      { status: 500 },
    );
  }

  // Filtros do popup.
  const filtered = docs.filter(({ detail }) => {
    if (tipo === "ENTRADA" || tipo === "SAIDA") {
      if (detail.flow !== tipo) return false;
    }
    if (status && nfeStatusKey(detail.protocolStatusCode) !== status) return false;
    if (!isDepositante && depositanteScope && detail.depositanteId !== depositanteScope) return false;
    const day = (detail.issuedAt ?? detail.createdAt)?.slice(0, 10) ?? "";
    if (de && (!day || day < de)) return false;
    if (ate && (!day || day > ate)) return false;
    return true;
  });

  const details: FiscalDocumentDetail[] = filtered.map((d) => d.detail);
  const stamp = monthLabel(mes);
  const base = `nfe-${stamp}`;

  let file: { name: string; content: Buffer; type: string };
  try {
    if (formato === "xlsx") {
      file = { name: `${base}.xlsx`, content: buildXlsx(details), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    } else if (formato === "pdf") {
      file = { name: `${base}.pdf`, content: await buildPdf(details, `NF-e · ${stamp}`), type: "application/pdf" };
    } else {
      file = { name: `${base}.csv`, content: buildCsv(details), type: "text/csv; charset=utf-8" };
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o arquivo de exportação." },
      { status: 500 },
    );
  }

  // Se marcou "Incluir XMLs em ZIP", empacota o arquivo + os XMLs.
  if (incluirZip) {
    const xmls = filtered.map((d, i) => ({
      name: sanitize(d.detail.noteNumber ? `NFe-${d.detail.noteNumber}.xml` : d.fileName || `nota-${i + 1}.xml`),
      content: Buffer.from(d.xml, "utf-8"),
    }));
    const zipBuffer = buildZip({ name: file.name, content: file.content }, xmls);
    return binary(zipBuffer, `${base}.zip`, "application/zip");
  }

  return binary(file.content, file.name, file.type);
}

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_");
}

function binary(content: Buffer, filename: string, type: string) {
  return new NextResponse(new Uint8Array(content), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(content.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
