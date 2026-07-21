import { requireApiModuleAccess } from "@/lib/api-auth";
import type { AppUserContext } from "@/lib/auth";
import { listFiscalSummaryRows } from "@/lib/fiscal-documents";
import { listStockBalancesFromDb } from "@/lib/stock";

type StockExportRow = {
  Protocolo: string;
  Depositante: string;
  SKU: string;
  Produto: string;
  CodigoInterno: string;
  Área: string;
  Endereco: string;
  Lote: string;
  Saldo: string;
  Metodo: string;
  Validade: string;
  Status: string;
  Entrada: string;
};

type FiscalExportRow = {
  Depositante: string;
  Fluxo: string;
  Emitente: string;
  Destinatario: string;
  NFEntrada: string;
  NFSaida: string;
  TotalNFe: string;
  ValorEntrada: string;
  ValorSaida: string;
  ValorTotal: string;
  Itens: string;
  Volumes: string;
  PrimeiraEmissao: string;
  UltimaEmissao: string;
};

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("relatorios");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const report = searchParams.get("report");
  const format = searchParams.get("format");

  if (!report || !format) {
    return Response.json({
      reports: [
        "saldo-estoque",
        "nfe-resumo",
      ],
    });
  }

  if (report === "saldo-estoque") {
    return exportStockBalanceReport(auth.user, searchParams, format);
  }

  if (report === "nfe-resumo") {
    return exportFiscalSummaryReport(auth.user, searchParams, format);
  }

  return Response.json(
    { error: "RelatÃ³rio invÃ¡lido. Use saldo-estoque ou nfe-resumo." },
    { status: 400 },
  );
}

async function exportStockBalanceReport(
  user: AppUserContext,
  searchParams: URLSearchParams,
  format: string,
) {
  const depositanteId =
    user.papel === "DEPOSITANTE"
      ? user.depositanteId ?? undefined
      : searchParams.get("depositante")?.trim() || undefined;

  const balances = await listStockBalancesFromDb({
    depositanteId,
    productTerm: searchParams.get("produto")?.trim() || undefined,
    area: searchParams.get("area")?.trim() || undefined,
    lot: searchParams.get("lote")?.trim() || undefined,
  });

  const rows: StockExportRow[] = balances.map((item) => ({
    Protocolo: item.protocol,
    Depositante: item.depositante,
    SKU: item.sku,
    Produto: item.productName,
    CodigoInterno: item.internalCode || "-",
    Área: formatÁreaLabel(item.area),
    Endereco: item.endereco,
    Lote: item.lote,
    Saldo: item.saldo,
    Metodo: item.withdrawalLabel,
    Validade: item.validade,
    Status: item.status,
    Entrada: item.createdAt,
  }));

  return exportRows(rows, format, {
    fileBaseName: `relatorio-saldo-estoque-${new Date().toISOString().slice(0, 10)}`,
    worksheetName: "Saldo Estoque",
  });
}

async function exportFiscalSummaryReport(
  user: AppUserContext,
  searchParams: URLSearchParams,
  format: string,
) {
  const depositanteId =
    user.papel === "DEPOSITANTE"
      ? user.depositanteId ?? undefined
      : searchParams.get("depositante")?.trim() || undefined;
  const flow = searchParams.get("fluxoFiscal")?.trim() || undefined;
  const issuerTerm = searchParams.get("emitente")?.trim() || undefined;
  const recipientTerm = searchParams.get("destinatario")?.trim() || undefined;

  const summary = await listFiscalSummaryRows(user, {
    depositanteId,
    dateFrom: searchParams.get("dataInicio")?.trim() || undefined,
    dateTo: searchParams.get("dataFim")?.trim() || undefined,
    flow: flow === "ENTRADA" || flow === "SAIDA" ? flow : undefined,
    issuerTerm,
    recipientTerm,
  });

  const rows: FiscalExportRow[] = summary.map((item) => ({
    Depositante: item.depositante,
    Fluxo: flow === "ENTRADA" ? "Entrada" : flow === "SAIDA" ? "SaÃ­da" : "Todos",
    Emitente: issuerTerm || "Todos",
    Destinatario: recipientTerm || "Todos",
    NFEntrada: String(item.entradaDocuments),
    NFSaida: String(item.saidaDocuments),
    TotalNFe: String(item.totalDocuments),
    ValorEntrada: formatCurrency(item.entradaValue),
    ValorSaida: formatCurrency(item.saidaValue),
    ValorTotal: formatCurrency(item.totalValue),
    Itens: String(item.totalItems),
    Volumes: String(item.totalVolumes),
    PrimeiraEmissao: item.firstIssuedAtLabel,
    UltimaEmissao: item.lastIssuedAtLabel,
  }));

  return exportRows(rows, format, {
    fileBaseName: `relatorio-nfe-resumo-${new Date().toISOString().slice(0, 10)}`,
    worksheetName: "Resumo NFe",
  });
}

function exportRows<T extends Record<string, string>>(
  rows: T[],
  format: string,
  options: {
    fileBaseName: string;
    worksheetName: string;
  },
) {
  if (format === "csv") {
    const csvContent = buildCsv(rows);

    return new Response(`\uFEFF${csvContent}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${options.fileBaseName}.csv"`,
      },
    });
  }

  if (format === "excel") {
    const workbook = buildExcelXml(rows, options.worksheetName);

    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${options.fileBaseName}.xls"`,
      },
    });
  }

  return Response.json(
    { error: "Formato de exportaÃ§Ã£o invÃ¡lido. Use csv ou excel." },
    { status: 400 },
  );
}

function buildCsv<T extends Record<string, string>>(rows: T[]) {
  const headers = Object.keys(rows[0] ?? {}) as Array<keyof T>;

  if (!headers.length) {
    return "";
  }

  const lines = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header] ?? "")).join(";")),
  ];

  return lines.join("\r\n");
}

function buildExcelXml<T extends Record<string, string>>(rows: T[], worksheetName: string) {
  const headers = Object.keys(rows[0] ?? {}) as Array<keyof T>;
  const headerCells = headers
    .map(
      (header) =>
        `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(String(header))}</Data></Cell>`,
    )
    .join("");

  const bodyRows = rows
    .map(
      (row) =>
        `<Row>${headers
          .map(
            (header) =>
              `<Cell><Data ss:Type="String">${escapeXml(String(row[header] ?? ""))}</Data></Cell>`,
          )
          .join("")}</Row>`,
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(worksheetName)}">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

function escapeCsvValue(value: string) {
  const normalized = String(value ?? "");
  const escaped = normalized.replaceAll('"', '""');
  return `"${escaped}"`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatÁreaLabel(value: string) {
  switch (value) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Armazenagem";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "ExpediÃ§Ã£o";
    default:
      return value;
  }
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}


