const fs = require('fs');
let t = fs.readFileSync('src/components/expedicao/expedicao-client.tsx', 'utf8');

const replacements = {
  "Ãª": "ê",
  "Ã£": "ã",
  "Ã§": "ç",
  "Ã¡": "á",
  "Ã³": "ó",
  "Ã©": "é",
  "Ã": "í", // Note: Ã by itself might be a problem if followed by other things, but usually í is Ã­ 
  "Ã­": "í",
  "Ãµ": "õ",
  "Ã§Ã£o": "ção",
  "ÃŠ": "Ê",
  "Ã‡": "Ç",
  "Ãƒ": "Ã", // actually Ãƒ is Ã
  "Ã“": "Ó",
  "Ã‰": "É",
  "Ã ": "à",
  "Ã¢": "â",
  "Ã´": "ô"
};

for (const [bad, good] of Object.entries(replacements)) {
  t = t.split(bad).join(good);
}

// Fix carriers
const oldCarrier = 'const getCarrierStyle = (name: string) => {';
const endTag = 'const filteredDataOrders';
const startIndex = t.indexOf(oldCarrier);
const endIndex = t.indexOf(endTag);

if (startIndex > -1 && endIndex > -1) {
  const newCarrierStyle = `const getCarrierStyle = (name: string) => {
    const n = (name || "").toUpperCase();
    if (n.includes("MERCADO LIVRE") || n.includes("MERCADOLIVRE") || n.includes("MELI") || n.includes("MERCADO ENVIOS") || n.includes("MERCADOENVIOS")) return { color: "#CA8A04", bg: "rgba(253,224,71,0.25)", init: "ME" };
    if (n.includes("SHOPEE")) return { color: "#EA580C", bg: "rgba(249,115,22,0.15)", init: "SH" };
    if (n.includes("AMAZON")) return { color: "#EA580C", bg: "rgba(249,115,22,0.15)", init: "AM" };
    if (n.includes("B2W") || n.includes("AMERICANAS")) return { color: "#E11D48", bg: "rgba(225,29,72,0.15)", init: "B2" };
    if (n.includes("MAGALU") || n.includes("MAGAZINE LUIZA")) return { color: "#2563EB", bg: "rgba(37,99,235,0.15)", init: "MG" };
    if (n.includes("ALIEXPRESS") || n.includes("ALI EXPRESS")) return { color: "#E11D48", bg: "rgba(225,29,72,0.15)", init: "AL" };
    if (n.includes("SHEIN")) return { color: "#000000", bg: "rgba(0,0,0,0.1)", init: "SH" };
    if (n.includes("JADLOG")) return { color: "#475569", bg: "rgba(100,116,139,0.15)", init: "JA" };
    if (n.includes("SITE") || n.includes("ECOMMERCE") || n.includes("LOJA")) return { color: "#059669", bg: "rgba(16,185,129,0.15)", init: "LO" };
    const init = (name || "N/A").slice(0, 2).toUpperCase();
    return { color: "#64748B", bg: "rgba(148,163,184,0.15)", init };
  };

  `;
  t = t.substring(0, startIndex) + newCarrierStyle + t.substring(endIndex);
}

fs.writeFileSync('src/components/expedicao/expedicao-client.tsx', t, 'utf8');
console.log("File fixed successfully!");
