import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireApiModuleAccess } from "@/lib/api-auth";
import type { AppUserContext } from "@/lib/auth";
import { listDamageReport } from "@/lib/damage-report";
import { listFiscalSummaryRows } from "@/lib/fiscal-documents";
import {
  listOperationalSlaReport,
  type OperationalSlaBand,
} from "@/lib/operational-sla-report";
import { listReverseLogisticsReport } from "@/lib/reverse-logistics-report";
import { listSalesReport } from "@/lib/sales-report";
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

type SlaExportRow = {
  Pedido: string;
  Depositante: string;
  Cliente: string;
  Status: string;
  EtapaAtual: string;
  CriadoEm: string;
  InicioSeparacao: string;
  InicioConferencia: string;
  Conclusao: string;
  TempoDecorrido: string;
  Meta: string;
  SLA: string;
};

type DamageExportRow = {
  Depositante: string;
  SKU: string;
  Produto: string;
  CodigoInterno: string;
  Quantidade: string;
  Motivo: string;
  Endereco: string;
  Área: string;
  Status: string;
  Decisao: string;
  CriadoEm: string;
  CriadoPor: string;
  ResolvidoEm: string;
  ResolvidoPor: string;
};

type ReverseLogisticsExportRow = {
  Depositante: string;
  Pedido: string;
  Cliente: string;
  Quantidade: string;
  ValorUnitario: string;
  ValorTotal: string;
  NFDevolucao: string;
  ChaveNFDevolucao: string;
  NFRecebidaEm: string;
  MesAno: string;
  LancadoEm: string;
};

type SalesExportRow = {
  Depositante: string;
  Pedido: string;
  Cliente: string;
  UF: string;
  Canal: string;
  Marketplace: string;
  Status: string;
  ValorTotal: string;
  Itens: string;
  Unidades: string;
  CriadoEm: string;
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
        "sla-operacional",
        "avarias",
        "logistica-reversa",
        "vendas",
      ],
    });
  }

  if (report === "saldo-estoque") {
    return exportStockBalanceReport(auth.user, searchParams, format);
  }

  if (report === "nfe-resumo") {
    return exportFiscalSummaryReport(auth.user, searchParams, format);
  }

  if (report === "sla-operacional") {
    return exportOperationalSlaReport(auth.user, searchParams, format);
  }

  if (report === "avarias") {
    return exportDamageReport(auth.user, searchParams, format);
  }

  if (report === "logistica-reversa") {
    return exportReverseLogisticsReport(auth.user, searchParams, format);
  }

  if (report === "vendas") {
    return exportSalesReport(auth.user, searchParams, format);
  }

  return Response.json(
    {
      error:
        "Relatório inválido. Use saldo-estoque, nfe-resumo, sla-operacional, avarias, logistica-reversa ou vendas.",
    },
    { status: 400 },
  );
}

async function exportSalesReport(user: AppUserContext, searchParams: URLSearchParams, format: string) {
  const depositanteId =
    user.papel === "DEPOSITANTE"
      ? user.depositanteId ?? undefined
      : searchParams.get("depositante")?.trim() || undefined;

  const report = await listSalesReport(user, {
    depositanteId,
    dateFrom: searchParams.get("dataInicio")?.trim() || undefined,
    dateTo: searchParams.get("dataFim")?.trim() || undefined,
    channel: searchParams.get("canal")?.trim() || undefined,
  });

  const rows: SalesExportRow[] = report.rows.map((item) => ({
    Depositante: item.depositante,
    Pedido: item.orderNumber,
    Cliente: item.customer,
    UF: item.uf,
    Canal: item.channelLabel,
    Marketplace: item.isMarketplace ? "Sim" : "Não",
    Status: item.statusLabel,
    ValorTotal: formatCurrency(item.totalValue),
    Itens: String(item.totalItems),
    Unidades: String(item.totalUnits),
    CriadoEm: item.createdAtLabel,
  }));

  return exportRows(rows, format, {
    fileBaseName: `relatorio-vendas-${new Date().toISOString().slice(0, 10)}`,
    worksheetName: "Vendas",
  });
}

async function exportReverseLogisticsReport(
  user: AppUserContext,
  searchParams: URLSearchParams,
  format: string,
) {
  const depositanteId =
    user.papel === "DEPOSITANTE"
      ? user.depositanteId ?? undefined
      : searchParams.get("depositante")?.trim() || undefined;

  const report = await listReverseLogisticsReport(user, {
    depositanteId,
    dateFrom: searchParams.get("dataInicio")?.trim() || undefined,
    dateTo: searchParams.get("dataFim")?.trim() || undefined,
  });

  const rows: ReverseLogisticsExportRow[] = report.rows.map((item) => ({
    Depositante: item.depositante,
    Pedido: item.orderNumber,
    Cliente: item.customer,
    Quantidade: item.quantityLabel,
    ValorUnitario: formatCurrency(item.unitValue),
    ValorTotal: formatCurrency(item.totalValue),
    NFDevolucao: item.invoiceNumber || "-",
    ChaveNFDevolucao: item.invoiceKey || "-",
    NFRecebidaEm: item.invoiceReceivedAtLabel || "-",
    MesAno: item.mesAno,
    LancadoEm: item.createdAtLabel,
  }));

  return exportRows(rows, format, {
    fileBaseName: `relatorio-logistica-reversa-${new Date().toISOString().slice(0, 10)}`,
    worksheetName: "Logistica Reversa",
  });
}

async function exportDamageReport(
  user: AppUserContext,
  searchParams: URLSearchParams,
  format: string,
) {
  const depositanteId =
    user.papel === "DEPOSITANTE"
      ? user.depositanteId ?? undefined
      : searchParams.get("depositante")?.trim() || undefined;

  const report = await listDamageReport(user, {
    depositanteId,
    dateFrom: searchParams.get("dataInicio")?.trim() || undefined,
    dateTo: searchParams.get("dataFim")?.trim() || undefined,
    status: searchParams.get("status")?.trim() || undefined,
  });

  const rows: DamageExportRow[] = report.rows.map((item) => ({
    Depositante: item.depositante,
    SKU: item.sku,
    Produto: item.productName,
    CodigoInterno: item.internalCode || "-",
    Quantidade: item.quantityLabel,
    Motivo: item.reason,
    Endereco: item.endereco,
    Área: item.area,
    Status: item.statusLabel,
    Decisao: item.depositanteDecisionLabel || "-",
    CriadoEm: item.createdAtLabel,
    CriadoPor: item.createdBy,
    ResolvidoEm: item.resolvedAtLabel || "-",
    ResolvidoPor: item.resolvedBy || "-",
  }));

  return exportRows(rows, format, {
    fileBaseName: `relatorio-avarias-${new Date().toISOString().slice(0, 10)}`,
    worksheetName: "Avarias",
  });
}

async function exportOperationalSlaReport(
  user: AppUserContext,
  searchParams: URLSearchParams,
  format: string,
) {
  const depositanteId =
    user.papel === "DEPOSITANTE"
      ? user.depositanteId ?? undefined
      : searchParams.get("depositante")?.trim() || undefined;
  const band = normalizeSlaBand(searchParams.get("faixa"));

  const report = await listOperationalSlaReport(user, {
    depositanteId,
    dateFrom: searchParams.get("dataInicio")?.trim() || undefined,
    dateTo: searchParams.get("dataFim")?.trim() || undefined,
    status: searchParams.get("status")?.trim() || undefined,
    band: band || undefined,
  });

  const rows: SlaExportRow[] = report.rows.map((item) => ({
    Pedido: item.orderNumber,
    Depositante: item.depositante,
    Cliente: item.customer,
    Status: item.statusLabel,
    EtapaAtual: item.currentStage,
    CriadoEm: item.createdAtLabel,
    InicioSeparacao: formatIsoDate(item.pickingStartedAtIso),
    InicioConferencia: formatIsoDate(item.conferenceStartedAtIso),
    Conclusao: formatIsoDate(item.completedAtIso),
    TempoDecorrido: item.elapsedLabel,
    Meta: `Até ${item.targetHours}h`,
    SLA: item.bandLabel,
  }));

  return exportRows(rows, format, {
    fileBaseName: `relatorio-sla-operacional-${new Date().toISOString().slice(0, 10)}`,
    worksheetName: "SLA Operacional",
  });
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

async function exportRows<T extends Record<string, string>>(
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

  if (format === "pdf") {
    return buildPdfReport(rows, options);
  }

  return Response.json(
    { error: "Formato de exportaÃ§Ã£o invÃ¡lido. Use csv ou excel." },
    { status: 400 },
  );
}

// Renderizador de PDF genérico (pdf-lib) — serve qualquer relatório: título +
// tabela (cabeçalho, linhas e paginação) em A4 paisagem. As colunas vêm das
// chaves das linhas, então funciona igual para os 6 relatórios.
async function buildPdfReport<T extends Record<string, string>>(
  rows: T[],
  options: { fileBaseName: string; worksheetName: string },
) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const headers = rows.length ? (Object.keys(rows[0]) as Array<keyof T>) : [];
  const PAGE_W = 842;
  const PAGE_H = 595; // A4 paisagem
  const MARGIN = 28;
  const usableW = PAGE_W - MARGIN * 2;
  const colW = headers.length ? usableW / headers.length : usableW;
  const ROW_H = 15;
  const CELL = 6.5;
  const HEAD = 7.5;
  const ink = rgb(0.13, 0.16, 0.22);
  const muted = rgb(0.42, 0.46, 0.52);
  const lineColor = rgb(0.85, 0.87, 0.9);
  const headerBg = rgb(0.9, 0.92, 0.95);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  page.drawText(options.worksheetName, {
    x: MARGIN,
    y: y - 6,
    size: 13,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
  });
  const gerado = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  page.drawText(`Infinoos WMS | gerado em ${gerado} | ${rows.length} registro(s)`, {
    x: MARGIN,
    y: y - 22,
    size: 8,
    font,
    color: muted,
  });
  y -= 42;

  // Sanitiza (Helvetica/WinAnsi cobre Latin-1 + reticências) e trunca à coluna.
  const fit = (raw: string, w: number, size: number, f = font) => {
    let t = (raw ?? "").replace(/[^ -ÿ–—…]/g, "");
    if (f.widthOfTextAtSize(t, size) <= w - 6) return t;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}…`, size) > w - 6) t = t.slice(0, -1);
    return `${t}…`;
  };

  const drawHead = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - ROW_H + 3,
      width: usableW,
      height: ROW_H,
      color: headerBg,
    });
    headers.forEach((h, i) => {
      page.drawText(fit(String(h), colW, HEAD, bold), {
        x: MARGIN + i * colW + 3,
        y: y - ROW_H + 8,
        size: HEAD,
        font: bold,
        color: ink,
      });
    });
    y -= ROW_H;
  };

  if (!headers.length) {
    page.drawText("Nenhum registro para os filtros atuais.", {
      x: MARGIN,
      y: y - 6,
      size: 10,
      font,
      color: muted,
    });
  } else {
    drawHead();
    for (const row of rows) {
      if (y < MARGIN + ROW_H) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
        drawHead();
      }
      headers.forEach((h, i) => {
        page.drawText(fit(String(row[h] ?? ""), colW, CELL), {
          x: MARGIN + i * colW + 3,
          y: y - ROW_H + 7,
          size: CELL,
          font,
          color: rgb(0.25, 0.29, 0.35),
        });
      });
      page.drawLine({
        start: { x: MARGIN, y: y - ROW_H + 2 },
        end: { x: MARGIN + usableW, y: y - ROW_H + 2 },
        thickness: 0.3,
        color: lineColor,
      });
      y -= ROW_H;
    }
  }

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${options.fileBaseName}.pdf"`,
    },
  });
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

function normalizeSlaBand(value: string | null): OperationalSlaBand | "" {
  if (
    value === "NO_PRAZO" ||
    value === "ATENCAO" ||
    value === "ATRASADO" ||
    value === "CANCELADO"
  ) {
    return value;
  }

  return "";
}

function formatIsoDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}


