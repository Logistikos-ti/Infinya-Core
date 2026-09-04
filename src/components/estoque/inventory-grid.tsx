/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Package } from "lucide-react";

export type GroupedProduct = {
  productId: string;
  sku: string;
  productName: string;
  categoria: string;
  tamanho: string | null;
  depositanteId: string;
  depositante: string;
  ean: string;
  metodoRetirada: string;
  ativo: boolean;
  imageUrl: string | null;
  qtd: number;
  reservado: number;
  disponivel: number;
  min: number;
  max: number;
  pesoKg: number | null;
  alturaCm: number | null;
  larguraCm: number | null;
  comprimentoCm: number | null;
  bloqueado: boolean;
  enderecos: { code: string; qty: number }[];
  lotes: { lote: string; qtd: number; validade: string }[];
  faixa: "critico" | "baixo" | "ideal";
};

const CAT_DEFS: Record<string, string> = {
  "Seco / Ambiente": "#3B82F6",
  "Refrigerado": "#06B6D4",
  "Congelado": "#6366F1",
  "Frágil": "#EC4899",
  "Perigoso (DG)": "#EF4444",
  "Alto Valor": "#F59E0B",
  "Volumoso": "#10B981",
  "Vestuário": "#8B5CF6",
  "Geral": "#64748b",
};

function getCatColor(cat: string) {
  return CAT_DEFS[cat] || "#64748b";
}

function hex2(h: string, a: number) {
  if (!h.startsWith("#")) h = "#64748b";
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const FAIXA_COLOR: Record<string, string> = { critico: "#EF4444", baixo: "#F59E0B", ideal: "#10B981" };
const FAIXA_LABEL: Record<string, string> = { critico: "Ruptura crítica", baixo: "Abaixo do mínimo", ideal: "Dentro da faixa ideal" };

export function InventoryGrid({ t, products, onSelectProduct }: { t: any; products: GroupedProduct[]; onSelectProduct: (p: GroupedProduct) => void }) {
  if (!products.length) {
    return (
      <div className="rounded-2xl border p-12 text-center" style={{ borderColor: t.border, background: t.cardBg, color: t.textSub }}>
        Nenhum produto encontrado.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {products.map((p, i) => {
        const color = getCatColor(p.categoria);
        const faixaColor = FAIXA_COLOR[p.faixa];
        const pct = p.max > 0 ? Math.min(100, Math.round((p.qtd / p.max) * 100)) : 0;
        const minPct = p.max > 0 ? Math.min(100, (p.min / p.max) * 100) : 0;

        return (
          <div
            key={p.productId}
            onClick={() => onSelectProduct(p)}
            className="card-anim flex flex-col gap-2.5 rounded-2xl border p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
            style={{ borderColor: t.border, background: t.cardBg, animationDelay: `${Math.min(i, 12) * 0.03}s` }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.hoverBorder)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[13px] overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)` }}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.productName} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5" style={{ color }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                  style={{ color: faixaColor, background: `${faixaColor}1a` }}
                >
                  {FAIXA_LABEL[p.faixa]}
                </span>
                <div className="mt-1.5 truncate text-[13.5px] font-bold" style={{ color: t.text }}>
                  {p.productName}
                </div>
                <div className={`mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px]`} style={{ color: t.textSub }}>
                  {p.sku} · {p.depositante}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                ["Estoque", p.qtd, t.text],
                ["Reservado", p.reservado, "#F59E0B"],
                ["Disponível", p.disponivel, "#10B981"],
              ].map(([label, value, valColor], bi) => (
                <div key={bi} className="rounded-[9px] py-1.5 text-center" style={{ background: t.inputBg }}>
                  <div className={`font-[family-name:var(--font-jetbrains-mono)] text-[16px] font-extrabold`} style={{ color: valColor as string }}>
                    {(value as number).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: t.textSub }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div className="relative h-2">
              <div className="h-2 overflow-hidden rounded" style={{ background: t.inputBg }}>
                <div className="h-full" style={{ width: `${pct}%`, background: p.faixa === "ideal" ? "linear-gradient(90deg,#3B82F6,#8B5CF6)" : faixaColor }} />
              </div>
              {p.max > 0 && (
                <div
                  className="absolute rounded shadow"
                  style={{ left: `calc(${minPct}% - 1.5px)`, top: -3, bottom: -3, width: 3, background: "#F59E0B", boxShadow: `0 0 0 2px ${t.inputBg}` }}
                />
              )}
            </div>
            <div className="flex justify-between text-[11px]" style={{ color: t.textSub }}>
              <span>MIN {p.min}</span>
              <span>MAX {p.max}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
