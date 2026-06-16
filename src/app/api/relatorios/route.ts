import { requireApiModuleAccess } from "@/lib/api-auth";
import { listStockBalancesFromDb } from "@/lib/stock";
import { listReportsCatalog } from "@/lib/wms-data";

type ExportRow = {
  Protocolo: string;
  Depositante: string;
  SKU: string;
  Produto: string;
  CodigoInterno: string;
  Area: string;
  Endereco: string;
  Lote: string;
  Saldo: string;
  Metodo: string;
  Validade: string;
  Status: string;
  Entrada: string;
};

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("relatorios");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const report = searchParams.get("report");
  const format = searchParams.get("format");

  if (report !== "saldo-estoque" || !format) {
    return Response.json({
      reports: listReportsCatalog(),
    });
  }

  const depositanteId =
    auth.user.papel === "DEPOSITANTE"
      ? auth.user.depositanteId ?? undefined
      : searchParams.get("depositante")?.trim() || undefined;

  const balances = await listStockBalancesFromDb({
    depositanteId,
    productTerm: searchParams.get("produto")?.trim() || undefined,
    area: searchParams.get("area")?.trim() || undefined,
    lot: searchParams.get("lote")?.trim() || undefined,
  });

  const rows: ExportRow[] = balances.map((item) => ({
    Protocolo: item.protocol,
    Depositante: item.depositante,
    SKU: item.sku,
    Produto: item.productName,
    CodigoInterno: item.internalCode || "-",
    Area: formatAreaLabel(item.area),
    Endereco: item.endereco,
    Lote: item.lote,
    Saldo: item.saldo,
    Metodo: item.withdrawalLabel,
    Validade: item.validade,
    Status: item.status,
    Entrada: item.createdAt,
  }));

  const fileBaseName = `relatorio-saldo-estoque-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    const csvContent = buildCsv(rows);

    return new Response(`\uFEFF${csvContent}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBaseName}.csv"`,
      },
    });
  }

  if (format === "excel") {
    const workbook = buildExcelXml(rows, "Saldo Estoque");

    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBaseName}.xls"`,
      },
    });
  }

  return Response.json(
    { error: "Formato de exportação inválido. Use csv ou excel." },
    { status: 400 },
  );
}

function buildCsv(rows: ExportRow[]) {
  const headers = Object.keys(rows[0] ?? getEmptyExportRow()) as Array<keyof ExportRow>;
  const lines = [
    headers.join(";"),
    ...rows.map((row) =>
      headers
        .map((header) => escapeCsvValue(row[header]))
        .join(";"),
    ),
  ];

  return lines.join("\r\n");
}

function buildExcelXml(rows: ExportRow[], worksheetName: string) {
  const headers = Object.keys(rows[0] ?? getEmptyExportRow()) as Array<keyof ExportRow>;
  const headerCells = headers
    .map((header) => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
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

function getEmptyExportRow(): ExportRow {
  return {
    Protocolo: "",
    Depositante: "",
    SKU: "",
    Produto: "",
    CodigoInterno: "",
    Area: "",
    Endereco: "",
    Lote: "",
    Saldo: "",
    Metodo: "",
    Validade: "",
    Status: "",
    Entrada: "",
  };
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

function formatAreaLabel(value: string) {
  switch (value) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Pulmão";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "Expedição";
    default:
      return value;
  }
}
