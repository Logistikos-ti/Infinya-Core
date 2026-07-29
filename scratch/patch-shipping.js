const fs = require('fs');
const path = require('path');
const p = path.join('src', 'lib', 'shipping.ts');
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  `  releasedToRomaneio: boolean;\n  nfe: string;\n  items?: {\n    name: string;`,
  `  releasedToRomaneio: boolean;\n  nfe: string;\n  hasNfe: boolean;\n  hasEtiqueta: boolean;\n  items?: {\n    name: string;`
);

c = c.replace(
  `  const nfe = extractInvoice(payload, (item as any).documentos);`,
  `  const nfe = extractInvoice(payload, (item as any).documentos);\n  const docs = Array.isArray((item as any).documentos) ? (item as any).documentos : [];\n  const hasNfe = docs.some((d: any) => d.tipo === "NF" || (d.mime_type && d.mime_type.includes("xml")));\n  const hasEtiqueta = docs.some((d: any) => d.tipo === "ETIQUETA");`
);

c = c.replace(
  `    releasedWithoutRomaneio,\n    releasedToRomaneio,\n    nfe,\n`,
  `    releasedWithoutRomaneio,\n    releasedToRomaneio,\n    nfe,\n    hasNfe,\n    hasEtiqueta,\n`
);

fs.writeFileSync(p, c);
console.log('Successfully patched shipping.ts');
