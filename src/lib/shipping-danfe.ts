import { parseNfeXml } from "@/lib/nfe-import";

export function buildSimplifiedDanfePdfFromXml(xml: string) {
  const parsed = parseNfeXml(xml);
  const firstItems = parsed.items.slice(0, 8);
  const contentLines = [
    "INFINYA LOG - DANFE SIMPLIFICADA",
    "",
    `NF-e: ${parsed.noteNumber}`,
    `Chave de acesso: ${parsed.accessKey ?? "Não informada"}`,
    `Direção: ${parsed.direction}`,
    `Emissão: ${formatDateTime(parsed.issuedAt)}`,
    `Protocolo: ${parsed.protocolNumber ?? "Não informado"}`,
    `Status SEFAZ: ${[parsed.protocolStatusCode, parsed.protocolStatusLabel].filter(Boolean).join(" - ") || "Não informado"}`,
    "",
    "EMITENTE",
    parsed.supplierName,
    `Documento: ${parsed.supplierDocument ?? "Não informado"}`,
    "",
    "DESTINATARIO",
    parsed.recipientName,
    `Documento: ${parsed.recipientDocument ?? "Não informado"}`,
    "",
    "TOTAIS",
    `Volumes: ${parsed.volumeCount.toLocaleString("pt-BR")}`,
    `Valor total: ${parsed.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    "",
    "ITENS",
    ...firstItems.map(
      (item, index) =>
        `${index + 1}. ${item.descricao} | Cód.: ${item.codigo ?? "-"} | EAN: ${item.ean ?? "-"} | Qtd.: ${item.quantidade.toLocaleString("pt-BR")}`,
    ),
  ];

  if (parsed.items.length > firstItems.length) {
    contentLines.push(`... e mais ${parsed.items.length - firstItems.length} item(ns).`);
  }

  const operators: string[] = [];
  let currentY = 790;

  for (const [index, line] of contentLines.entries()) {
    operators.push("BT");
    operators.push(`/F1 ${index === 0 ? 17 : line === line.toUpperCase() && line ? 12 : 10} Tf`);
    operators.push(`40 ${currentY} Td`);
    operators.push(`(${escapePdfString(line)}) Tj`);
    operators.push("ET");
    currentY -= line === "" ? 9 : 18;
  }

  operators.push("0.2 w");
  operators.push("40 775 m 555 775 l S");
  operators.push("40 635 m 555 635 l S");
  operators.push("40 545 m 555 545 l S");
  operators.push("40 455 m 555 455 l S");

  const contentStream = operators.join("\n");
  return createSimplePdf(contentStream);
}

function createSimplePdf(contentStream: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`,
  ];

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

function escapePdfString(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Não informada";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
