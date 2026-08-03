export const hexToRgba = (h: string, a: number) => {
  const cleanHex = h.replace("#", "");
  const n = parseInt(cleanHex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export type CarrierBrandInfo = {
  color: string;
  bg: string;
  init: string;
};

export function getCarrierBrand(rawName: string): CarrierBrandInfo {
  const name = (rawName || "").trim();
  const lower = name.toLowerCase();

  if (lower.includes("shopee")) {
    return { color: "#EE4D2D", bg: hexToRgba("#EE4D2D", 0.16), init: "SH" };
  }
  if (lower.includes("mercado") || lower.includes("meli")) {
    return { color: "#2D3277", bg: hexToRgba("#FFE600", 0.35), init: "ML" };
  }
  if (lower.includes("amazon")) {
    return { color: "#FF9900", bg: hexToRgba("#FF9900", 0.16), init: "AM" };
  }
  if (lower.includes("magalu") || lower.includes("magazine")) {
    return { color: "#0086FF", bg: hexToRgba("#0086FF", 0.16), init: "MG" };
  }
  if (lower.includes("jadlog")) {
    return { color: "#E11D48", bg: hexToRgba("#E11D48", 0.16), init: "JD" };
  }
  if (lower.includes("correio") || lower.includes("sedex") || lower.includes("pac")) {
    return { color: "#2563EB", bg: hexToRgba("#2563EB", 0.16), init: "CR" };
  }
  if (lower.includes("total express") || lower.includes("totalexpress")) {
    return { color: "#7C3AED", bg: hexToRgba("#7C3AED", 0.16), init: "TX" };
  }
  if (lower.includes("loggi")) {
    return { color: "#0284C7", bg: hexToRgba("#0284C7", 0.16), init: "LG" };
  }
  if (lower.includes("braspress")) {
    return { color: "#0891B2", bg: hexToRgba("#0891B2", 0.16), init: "BP" };
  }
  if (lower.includes("manda") || lower.includes("mandae")) {
    return { color: "#16A34A", bg: hexToRgba("#16A34A", 0.16), init: "MD" };
  }
  if (lower.includes("sequoia")) {
    return { color: "#DC2626", bg: hexToRgba("#DC2626", 0.16), init: "SQ" };
  }
  if (lower.includes("azul")) {
    return { color: "#0284C7", bg: hexToRgba("#0284C7", 0.16), init: "AZ" };
  }
  if (lower.includes("latam")) {
    return { color: "#BE123C", bg: hexToRgba("#BE123C", 0.16), init: "LA" };
  }
  if (lower.includes("gollog") || lower.includes("gol")) {
    return { color: "#EA580C", bg: hexToRgba("#EA580C", 0.16), init: "GL" };
  }
  if (lower.includes("kangu")) {
    return { color: "#F97316", bg: hexToRgba("#F97316", 0.16), init: "KG" };
  }
  if (lower.includes("melhor envio")) {
    return { color: "#06B6D4", bg: hexToRgba("#06B6D4", 0.16), init: "ME" };
  }
  if (lower.includes("própria") || lower.includes("propria")) {
    return { color: "#10B981", bg: hexToRgba("#10B981", 0.16), init: "FP" };
  }

  const init = name.length >= 2 ? name.slice(0, 2).toUpperCase() : (name || "TR").toUpperCase();
  return { color: "#64748B", bg: hexToRgba("#64748B", 0.14), init };
}
