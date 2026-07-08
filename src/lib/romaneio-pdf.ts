import type { RomaneioCarrierGroup } from "@/lib/romaneio";

type RomaneioPageContent = {
  title: string;
  lines: string[];
};

export function buildRomaneioPdf(group: RomaneioCarrierGroup) {
  const chunkSize = 18;
  const pages: RomaneioPageContent[] = [];

  for (let start = 0; start < group.orders.length; start += chunkSize) {
    const chunk = group.orders.slice(start, start + chunkSize);
    pages.push(buildRomaneioPage(group, chunk, Math.floor(start / chunkSize) + 1));
  }

  return createSimplePdfDocument(pages.length ? pages : [buildRomaneioPage(group, [], 1)]);
}

function buildRomaneioPage(
  group: RomaneioCarrierGroup,
  orders: RomaneioCarrierGroup["orders"],
  pageNumber: number,
): RomaneioPageContent {
  const lines = [
    `Transportadora: ${group.carrierName}`,
    `Página: ${pageNumber}`,
    `Data de emissão: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    `Pedidos no grupo: ${group.orderCount} | Unidades: ${group.totalUnits} | Valor: ${group.totalValue}`,
    `Cutoff operacional: ${group.cutoff}`,
    `Depositantes: ${group.depositantes.join(", ") || "-"}`,
    `Destinos: ${group.destinations.join(", ") || "-"}`,
    "",
    "PEDIDOS",
    ...orders.map(
      (order, index) =>
        `${index + 1}. ${order.externalNumber} | ${order.customer} | ${order.destination} | ${order.units} un | ${order.total} | ${order.statusLabel}`,
    ),
    "",
    "ASSINATURAS",
    "Conferido para despacho e liberação do carregamento.",
  ];

  return {
    title: "INFINOOS WMS - ROMANEIO DE EXPEDIÇÃO",
    lines,
  };
}

function createSimplePdfDocument(pages: RomaneioPageContent[]) {
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

function buildPageContentStream(page: RomaneioPageContent) {
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
  operators.push("(Responsável pela expedição) Tj");
  operators.push("ET");

  operators.push("BT");
  operators.push("/F1 10 Tf");
  operators.push("300 75 Td");
  operators.push("(Motorista / transportadora) Tj");
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
