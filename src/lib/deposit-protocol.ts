import type { StockTraceabilityDetail } from "@/lib/stock";

type ProtocolPageContent = {
  title: string;
  lines: string[];
};

export function buildDepositProtocolPdf(detail: StockTraceabilityDetail) {
  return buildDepositProtocolBatchPdf([detail]);
}

export function buildDepositProtocolBatchPdf(details: StockTraceabilityDetail[]) {
  const pages = details.map(buildProtocolPageContent);
  return createSimplePdfDocument(pages);
}

function buildProtocolPageContent(detail: StockTraceabilityDetail): ProtocolPageContent {
  const firstMovements = detail.movements.slice(0, 6);

  const lines = [
    `Protocolo: ${detail.protocol}`,
    `Depositante: ${detail.depositante}`,
    `SKU: ${detail.sku}`,
    `Produto: ${detail.productName}`,
    `Endereço: ${detail.endereco} (${detail.area})`,
    `Lote: ${detail.lote}`,
    `Validade: ${detail.validade}`,
    `Fabricação: ${detail.fabricacao}`,
    `Saldo: ${detail.saldo} | Reservado: ${detail.reservado} | Disponível: ${detail.disponivel}`,
    `Status: ${detail.status}`,
    `Política de retirada: ${detail.withdrawalLabel}`,
    `Entrada registrada em: ${detail.createdAt}`,
    "",
    "ORIGEM",
    detail.source
      ? `Recebimento ${detail.source.receivingCode} | NF-e ${detail.source.noteNumber}`
      : "Origem não localizada",
    detail.source ? `Fornecedor: ${detail.source.supplier}` : "",
    detail.source ? `Lançado em: ${detail.source.launchedAt}` : "",
    "",
    "MOVIMENTAÇÕES",
    ...firstMovements.map(
      (movement, index) =>
        `${index + 1}. ${movement.type} | ${movement.quantity} | ${movement.route} | ${movement.createdAt}`,
    ),
  ].filter(Boolean);

  if (detail.movements.length > firstMovements.length) {
    lines.push(`... e mais ${detail.movements.length - firstMovements.length} movimentação(ões).`);
  }

  lines.push("");
  lines.push("RESPONSAVEL OPERACIONAL");
  lines.push("Protocolo com campo de assinatura reservado para conferencia fisica e arquivo operacional.");

  return {
    title: "INFINYA LOG - PROTOCOLO DE DEP\u00D3SITO",
    lines,
  };
}

function createSimplePdfDocument(pages: ProtocolPageContent[]) {
  const fontObjectNumber = 3;
  const firstPageObjectNumber = 4;
  const pageObjectNumbers = pages.map((_, index) => firstPageObjectNumber + index * 2);
  const contentObjectNumbers = pages.map((_, index) => firstPageObjectNumber + index * 2 + 1);

  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((page) => `${page} 0 R`).join(" ")}] >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((page, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = contentObjectNumbers[index];
    const contentStream = buildPageContentStream(page);

    objects[pageObjectNumber - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber - 1] =
      `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((objectContent, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${objectContent}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

function buildPageContentStream(page: ProtocolPageContent) {
  const operators: string[] = [];
  let currentY = 790;

  operators.push("BT");
  operators.push("/F1 17 Tf");
  operators.push(`40 ${currentY} Td`);
  operators.push(`(${escapePdfString(page.title)}) Tj`);
  operators.push("ET");

  currentY -= 28;

  for (const line of page.lines) {
    operators.push("BT");
    operators.push(`/F1 ${line === line.toUpperCase() && line ? 12 : 10} Tf`);
    operators.push(`40 ${currentY} Td`);
    operators.push(`(${escapePdfString(line)}) Tj`);
    operators.push("ET");
    currentY -= line === "" ? 9 : 18;
  }

  operators.push("0.2 w");
  operators.push("40 775 m 555 775 l S");
  operators.push("40 135 m 555 135 l S");
  operators.push("40 90 m 250 90 l S");
  operators.push("300 90 m 555 90 l S");

  operators.push("BT");
  operators.push("/F1 10 Tf");
  operators.push("40 75 Td");
  operators.push("(Assinatura para conferencia fisica) Tj");
  operators.push("ET");

  operators.push("BT");
  operators.push("/F1 10 Tf");
  operators.push("300 75 Td");
  operators.push("(Data e hora da conferencia) Tj");
  operators.push("ET");

  return operators.join("\n");
}

function escapePdfString(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}
