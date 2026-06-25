import type { ShippingOrderDetail } from "@/lib/shipping";

type ShippingLabelFormat = "PDF" | "ZPL";

export function buildShippingLabelDocument(
  order: ShippingOrderDetail,
  format: ShippingLabelFormat,
) {
  if (format === "ZPL") {
    return {
      bytes: Buffer.from(buildShippingLabelZpl(order), "utf-8"),
      mimeType: "text/plain; charset=utf-8",
      fileName: `${order.code.toLowerCase()}-etiqueta.zpl`,
    };
  }

  return {
    bytes: buildShippingLabelPdf(order),
    mimeType: "application/pdf",
    fileName: `${order.code.toLowerCase()}-etiqueta.pdf`,
  };
}

function buildShippingLabelZpl(order: ShippingOrderDetail) {
  const lines = [
    "^XA",
    "^CI28",
    "^PW812",
    "^LL1218",
    "^LH0,0",
    "^FO40,30^A0N,34,34^FDINFINYA LOG - ETIQUETA DE TRANSPORTE^FS",
    "^FO40,80^GB730,2,2^FS",
    `^FO40,110^A0N,28,28^FDPedido interno: ${sanitizeZpl(order.code)}^FS`,
    `^FO40,150^A0N,28,28^FDPedido da plataforma: ${sanitizeZpl(order.externalNumber)}^FS`,
    `^FO40,190^A0N,28,28^FDDepositante: ${sanitizeZpl(order.depositante)}^FS`,
    `^FO40,230^A0N,28,28^FDCanal: ${sanitizeZpl(order.channel)}^FS`,
    `^FO40,270^A0N,28,28^FDLoja: ${sanitizeZpl(order.storeDisplay)}^FS`,
    "^FO40,320^A0N,30,30^FDDESTINATARIO^FS",
    `^FO40,360^A0N,34,34^FD${sanitizeZpl(order.customer)}^FS`,
    `^FO40,405^A0N,28,28^FDDocumento: ${sanitizeZpl(order.customerDocument)}^FS`,
    `^FO40,445^A0N,28,28^FDDestino: ${sanitizeZpl(order.destination)}^FS`,
    "^FO40,500^A0N,30,30^FDLOGISTICA^FS",
    `^FO40,540^A0N,28,28^FDTransportadora: ${sanitizeZpl(order.carrierName)}^FS`,
    `^FO40,580^A0N,28,28^FDServico: ${sanitizeZpl(order.shippingService)}^FS`,
    `^FO40,620^A0N,28,28^FDRastreio: ${sanitizeZpl(order.trackingCode)}^FS`,
    `^FO40,660^A0N,28,28^FDVolumes: ${sanitizeZpl(order.units)} unidade(s)^FS`,
    "^FO40,715^A0N,30,30^FDRESUMO DO PEDIDO^FS",
    `^FO40,755^A0N,28,28^FDItens: ${sanitizeZpl(String(order.itemCount))}^FS`,
    `^FO40,795^A0N,28,28^FDValor total: ${sanitizeZpl(order.total)}^FS`,
    `^FO40,835^A0N,28,28^FDPrevisao de envio: ${sanitizeZpl(order.shipDate)}^FS`,
    "^FO40,890^GB730,2,2^FS",
    `^FO40,920^A0N,24,24^FDGerado por Infinya Log em ${sanitizeZpl(order.syncedAt)}^FS`,
    `^FO40,970^BY3,3,90^BCN,90,Y,N,N^FD${sanitizeBarcode(order.code)}^FS`,
    "^XZ",
  ];

  return `${lines.join("\n")}\n`;
}

function buildShippingLabelPdf(order: ShippingOrderDetail) {
  const contentLines = [
    "INFINYA LOG - ETIQUETA DE TRANSPORTE",
    "",
    `Pedido interno: ${order.code}`,
    `Pedido da plataforma: ${order.externalNumber}`,
    `Depositante: ${order.depositante}`,
    `Canal: ${order.channel}`,
    `Loja: ${order.storeDisplay}`,
    "",
    "DESTINATARIO",
    order.customer,
    `Documento: ${order.customerDocument}`,
    `Destino: ${order.destination}`,
    "",
    "LOGISTICA",
    `Transportadora: ${order.carrierName}`,
    `Servico: ${order.shippingService}`,
    `Rastreio: ${order.trackingCode}`,
    `Volumes: ${order.units} unidade(s)`,
    "",
    "RESUMO DO PEDIDO",
    `Itens: ${order.itemCount}`,
    `Valor total: ${order.total}`,
    `Previsao de envio: ${order.shipDate}`,
    "",
    `Gerado por Infinya Log em ${order.syncedAt}`,
  ];

  const operators: string[] = [];
  let currentY = 760;
  operators.push("BT");
  operators.push("/F1 18 Tf");
  operators.push("40 800 Td");
  operators.push(`(${escapePdfString(contentLines[0])}) Tj`);
  operators.push("ET");

  for (const line of contentLines.slice(1)) {
    operators.push("BT");
    operators.push(`/F1 ${line === line.toUpperCase() && line ? 13 : 11} Tf`);
    operators.push(`40 ${currentY} Td`);
    operators.push(`(${escapePdfString(line)}) Tj`);
    operators.push("ET");
    currentY -= line === "" ? 10 : 22;
  }

  operators.push("0.2 w");
  operators.push("40 785 m 555 785 l S");
  operators.push("40 455 m 555 455 l S");
  operators.push("40 220 515 90 re S");
  operators.push("BT");
  operators.push("/F1 12 Tf");
  operators.push("60 275 Td");
  operators.push(`(Codigo: ${escapePdfString(order.code)}) Tj`);
  operators.push("ET");

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

function sanitizeZpl(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .trim();
}

function sanitizeBarcode(value: string) {
  return value.replace(/[^A-Za-z0-9\-]/g, "").slice(0, 32) || "INFINYALOG";
}
