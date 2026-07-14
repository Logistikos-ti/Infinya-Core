"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Manrope, Space_Grotesk } from "next/font/google";
import { TrendingUp, AlertTriangle, Tag, Package, LayoutGrid, List, PencilLine, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import React from "react";
import { deleteProdutoAction, toggleProdutoStatusAction } from "@/app/(dashboard)/configuracoes/produtos/actions";

const manrope = Manrope({ subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

type Produto = {
  id: string;
  codigo_interno: string | null;
  codigo_externo: string | null;
  sku: string | null;
  nome: string;
  categoria: string | null;
  metodo_retirada: string;
  unidade_estocagem: string;
  exige_lote: boolean;
  exige_validade: boolean;
  ativo: boolean;
  created_at: string;
  depositante_id: string;
  depositante_nome: string | null;
  estoque?: number;
  estoque_minimo?: number;
  estoque_maximo?: number;
  preco?: number;
  curva_abc?: string;
  dimensoes?: string;
  peso?: string;
  fornecedor?: string;
  imagem_principal_url?: string | null;
};

type ProdutosDashboardProps = {
  produtos: Produto[];
  totalProducts: number;
  formSlot?: React.ReactNode;
  paginationSlot?: React.ReactNode;
  filtersSlot?: React.ReactNode;
  importSlot?: React.ReactNode;
};

export function ProdutosDashboard({
  produtos,
  totalProducts,
  formSlot,
  paginationSlot,
  filtersSlot,
  importSlot,
}: ProdutosDashboardProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const [view, setView] = useState<"gallery" | "table">("gallery");
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);

  // Theme variables
  const t = dark
    ? {
        cardBg: "#101B30",
        headBg: "#0E1728",
        inputBg: "#101B30",
        border: "rgba(148,163,184,0.14)",
        rowHover: "rgba(148,163,184,0.05)",
        barTrack: "rgba(148,163,184,0.16)",
        text: "#F1F5F9",
        textSub: "#8695AD",
        drawerBg: "#0C1526",
        hoverBorder: "rgba(139,92,246,0.4)",
      }
    : {
        cardBg: "#FFFFFF",
        headBg: "#F8FAFC",
        inputBg: "#F8FAFC",
        border: "rgba(100,116,139,0.16)",
        rowHover: "rgba(100,116,139,0.04)",
        barTrack: "rgba(100,116,139,0.14)",
        text: "#0F172A",
        textSub: "#64748B",
        drawerBg: "#FFFFFF",
        hoverBorder: "rgba(139,92,246,0.4)",
      };

  // Enriched Data
  const enrichedProdutos = useMemo(() => {
    return produtos.map((p, idx) => {
      // Mock data for missing fields for design purposes
      const stock = p.estoque ?? (p.ativo ? ((idx % 5 === 0) ? 0 : 10 + ((idx * 43) % 800)) : 0);
      const min = p.estoque_minimo ?? 50;
      const max = p.estoque_maximo ?? 1000;
      let status = "Ativo";
      if (!p.ativo) status = "Inativo";
      else if (stock === 0) status = "Ruptura";
      else if (stock < min) status = "Estoque baixo";

      const pct = Math.min(100, Math.max(0, Math.round((stock / max) * 100)));
      
      const category = p.categoria || "Geral";
      const abc = p.curva_abc || (stock > 300 ? "A" : stock > 100 ? "B" : "C");

      return {
        ...p,
        stock,
        min,
        max,
        status,
        pct,
        category,
        abc,
        priceStr: p.preco ? `R$ ${p.preco.toFixed(2).replace('.', ',')}` : "R$ --,--",
        ean: p.codigo_externo || "--",
        dim: p.dimensoes || "--",
        weight: p.peso || "--",
        supplier: p.fornecedor || p.depositante_nome || "--",
        skuStr: p.sku || p.codigo_interno || "--",
      };
    });
  }, [produtos]);

  const catDefs: Record<string, string> = {
    Eletrônicos: "#3B82F6",
    "Casa & Cozinha": "#10B981",
    Moda: "#EC4899",
    Beleza: "#A855F7",
    Esporte: "#F59E0B",
    Geral: "#64748b",
  };

  const getCatColor = (cat: string) => catDefs[cat] || "#64748b";

  const kpis = useMemo(() => {
    const rupturas = enrichedProdutos.filter(p => p.status === "Ruptura").length;
    const baixos = enrichedProdutos.filter(p => p.status === "Estoque baixo").length;
    return [
      { label: "SKUs ativos", value: totalProducts, delta: "", deltaColor: "#10B981", iconEl: <Package className="w-5 h-5" />, iconBg: "rgba(59,130,246,0.14)", iconColor: "#3B82F6" },
      { label: "Cobertura média", value: "38 dias", delta: "", deltaColor: t.textSub, iconEl: <TrendingUp className="w-5 h-5" />, iconBg: "rgba(139,92,246,0.14)", iconColor: "#8B5CF6" },
      { label: "Estoque baixo", value: baixos, delta: "", deltaColor: "#F59E0B", iconEl: <AlertTriangle className="w-5 h-5" />, iconBg: "rgba(245,158,11,0.14)", iconColor: "#F59E0B" },
      { label: "Em ruptura", value: rupturas, delta: "", deltaColor: "#10B981", iconEl: <Tag className="w-5 h-5" />, iconBg: "rgba(239,68,68,0.14)", iconColor: "#EF4444" },
    ];
  }, [enrichedProdutos, totalProducts, t.textSub]);

  const uniqueCats = useMemo(() => {
    const set = new Set(enrichedProdutos.map(p => p.category));
    return ["Todas", ...Array.from(set)];
  }, [enrichedProdutos]);

  const [activeCat, setActiveCat] = useState("Todas");

  const filteredProdutos = useMemo(() => {
    if (activeCat === "Todas") return enrichedProdutos;
    return enrichedProdutos.filter(p => p.category === activeCat);
  }, [activeCat, enrichedProdutos]);

  const hex2 = (h: string, a: number) => {
    if (!h.startsWith("#")) h = "#64748b";
    const n = parseInt(h.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const statusStyle = (s: string) => {
    if (s === "Ativo") return { bg: "rgba(16,185,129,0.14)", color: "#10B981", dot: "#10B981", chipBg: "rgba(16,185,129,0.9)" };
    if (s === "Estoque baixo") return { bg: "rgba(245,158,11,0.16)", color: "#F59E0B", dot: "#F59E0B", chipBg: "rgba(245,158,11,0.92)" };
    if (s === "Ruptura") return { bg: "rgba(239,68,68,0.14)", color: "#EF4444", dot: "#EF4444", chipBg: "rgba(239,68,68,0.92)" };
    if (s === "Inativo") return { bg: "rgba(100,116,139,0.14)", color: "#64748b", dot: "#64748b", chipBg: "rgba(100,116,139,0.9)" };
    return { bg: "rgba(148,163,184,0.16)", color: t.textSub, dot: t.textSub, chipBg: "rgba(100,116,139,0.9)" };
  };

  const abcStyle = (a: string) => {
    if (a === "A") return { bg: "rgba(16,185,129,0.16)", color: "#10B981" };
    if (a === "B") return { bg: "rgba(59,130,246,0.16)", color: "#3B82F6" };
    return { bg: "rgba(148,163,184,0.18)", color: t.textSub };
  };

  const stockFillFor = (status: string) => {
    if (status === "Ruptura") return "#EF4444";
    if (status === "Estoque baixo") return "linear-gradient(90deg,#F59E0B,#FBBF24)";
    return "linear-gradient(90deg,#3B82F6,#8B5CF6)";
  };

  const selectedData = useMemo(() => {
    if (!selectedProduto) return null;
    const p = enrichedProdutos.find(ep => ep.id === selectedProduto.id);
    if (!p) return null;
    const color = getCatColor(p.category);
    const ss = statusStyle(p.status);
    const ab = abcStyle(p.abc);
    return {
      ...p,
      thumbBg: `linear-gradient(140deg, ${color} 0%, ${hex2(color, 0.55)} 55%, ${hex2(color, 0.85)} 100%)`,
      catChipBg: hex2(color, 0.15),
      catColor: color,
      abcBg: ab.bg,
      abcColor: ab.color,
      statusChipBg: ss.chipBg,
      statusColor: ss.color,
      stockW: `${p.pct}%`,
      stockFill: stockFillFor(p.status),
      stockColor: p.status === "Ruptura" ? "#EF4444" : p.status === "Estoque baixo" ? "#F59E0B" : t.text,
      stockLabel: p.stock === 0 ? "0 un" : `${p.stock.toLocaleString("pt-BR")} un`,
      locs: [
        { code: "A-01-03-02", qty: `${Math.floor(p.stock * 0.6)} un` },
        { code: "B-04-02-01", qty: `${Math.floor(p.stock * 0.4)} un` }
      ],
      moves: [
        { title: p.status === "Ruptura" ? "Saída — pedido separado" : "Entrada de recebimento", sub: "Hoje · 10:24 · NF 48.210", dot: "#10B981", halo: "rgba(16,185,129,0.2)" },
        { title: "Separação (picking)", sub: "Hoje · 08:12 · Coletor #03", dot: "#3B82F6", halo: "rgba(59,130,246,0.2)" },
        { title: "Cadastro atualizado", sub: "10/07 · 09:05 · Sistema", dot: t.textSub, halo: "transparent" }
      ],
      specs: [
        { k: "EAN", v: p.ean },
        { k: "Fornecedor", v: p.supplier },
        { k: "Dimensões", v: p.dim },
        { k: "Peso", v: p.weight },
      ]
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduto, enrichedProdutos, getCatColor, t.text, t.textSub]);

  return (
    <div className={`${manrope.className} space-y-6 animate-in fade-in duration-500`}>
      <style>{`
        @keyframes drawerIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes overlayFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .drawer-anim { animation: drawerIn 0.32s cubic-bezier(.3,1,.4,1); }
        .overlay-anim { animation: overlayFade 0.25s ease; }
        .card-anim { animation: cardIn 0.4s ease both; }
      `}</style>

      {/* Header and Toggles */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[13px]" style={{ color: t.textSub }}>
            <span>Estoque</span><span>›</span><span style={{ color: t.text, fontWeight: 600 }}>Produtos</span>
          </div>
          <h1 className={`${spaceGrotesk.className} text-[28px] font-bold m-0 leading-tight`}>
            Catálogo de produtos
          </h1>
          <p className="m-0 text-[14.5px]" style={{ color: t.textSub }}>
            SKUs cadastrados, níveis de estoque, curva ABC e status de disponibilidade.
          </p>
        </div>
        <div className="flex gap-2.5 items-center">
          <div className="flex p-1 gap-1 rounded-xl border" style={{ borderColor: t.border, background: t.inputBg }}>
            <button
              onClick={() => setView("gallery")}
              className="h-9 px-4 rounded-lg text-[13.5px] font-bold cursor-pointer flex items-center gap-1.5 transition-all duration-200 border-none"
              style={{
                background: view === "gallery" ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent",
                color: view === "gallery" ? "#fff" : t.textSub,
              }}
            >
              <LayoutGrid className="w-4 h-4" /> Galeria
            </button>
            <button
              onClick={() => setView("table")}
              className="h-9 px-4 rounded-lg text-[13.5px] font-bold cursor-pointer flex items-center gap-1.5 transition-all duration-200 border-none"
              style={{
                background: view === "table" ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent",
                color: view === "table" ? "#fff" : t.textSub,
              }}
            >
              <List className="w-4 h-4" /> Tabela
            </button>
          </div>
          {formSlot}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <div key={i} className="p-5 rounded-2xl border flex flex-col gap-3" style={{ borderColor: t.border, background: t.cardBg }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold" style={{ color: t.textSub }}>{k.label}</span>
              <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.iconBg, color: k.iconColor }}>
                {k.iconEl}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`${spaceGrotesk.className} text-3xl font-bold`}>{k.value}</span>
              <span className="text-[13px] font-bold" style={{ color: k.deltaColor }}>{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1.3fr] gap-6 mb-6">
        {importSlot}
      </div>

      {/* category chips */}
      <div className="flex items-center gap-2.5 mb-5 flex-wrap">
        {uniqueCats.map((cat, i) => {
          const active = activeCat === cat;
          const color = cat === "Todas" ? t.textSub : getCatColor(cat);
          return (
            <button
              key={i}
              onClick={() => setActiveCat(cat)}
              className="h-9 px-4 rounded-xl text-[13px] font-bold cursor-pointer flex items-center gap-2 transition-all duration-200"
              style={{
                border: `1px solid ${active ? "transparent" : t.border}`,
                background: active ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : t.inputBg,
                color: active ? "#fff" : t.text,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: active ? "#8B5CF6" : color }}
              />
              {cat}
            </button>
          );
        })}
      </div>

      {filtersSlot && <div className="mb-6">{filtersSlot}</div>}

      {/* GALLERY VIEW */}
      {view === "gallery" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProdutos.map((p, i) => {
              const color = getCatColor(p.category);
              const thumbBg = `linear-gradient(140deg, ${color} 0%, ${hex2(color, 0.55)} 55%, ${hex2(color, 0.85)} 100%)`;
              const ss = statusStyle(p.status);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduto(p)}
                  className="card-anim rounded-[18px] border overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                  style={{
                    borderColor: t.border,
                    background: t.cardBg,
                    animationDelay: `${i * 0.05}s`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.hoverBorder)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
                >
                  <div className="relative h-[150px] flex items-center justify-center overflow-hidden" style={{ background: thumbBg }}>
                    <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 11px)" }} />
                    {p.imagem_principal_url ? (
                      <img src={p.imagem_principal_url} alt={p.nome} className="relative z-10 w-full h-full object-cover" />
                    ) : (
                      <span className="relative z-10 text-white/90">
                        <Package className="w-11 h-11" />
                      </span>
                    )}
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wider bg-black/30 text-white backdrop-blur-sm z-20">
                      {p.abc}
                    </span>
                    <span
                      className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white backdrop-blur-sm z-20"
                      style={{ background: ss.chipBg }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {p.status}
                    </span>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[15px] font-bold leading-snug line-clamp-2 h-[38px]">{p.nome}</span>
                      <span className={`${spaceGrotesk.className} text-[12.5px]`} style={{ color: t.textSub }}>{p.skuStr}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[12.5px]">
                        <span style={{ color: t.textSub }}>Estoque</span>
                        <span className="font-bold" style={{ color: p.status === "Ruptura" ? "#EF4444" : p.status === "Estoque baixo" ? "#F59E0B" : t.text }}>
                          {p.stock === 0 ? "0 un" : `${p.stock.toLocaleString("pt-BR")} un`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: t.barTrack }}>
                        <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: stockFillFor(p.status) }} />
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between pt-1.5 mt-1 border-t" style={{ borderColor: t.border }}>
                      <span className={`${spaceGrotesk.className} text-lg font-bold`}>{p.priceStr}</span>
                      <span className="text-xs" style={{ color: t.textSub }}>{p.stock > 0 ? "1 endereço" : "Sem estoque"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {paginationSlot && (
            <div className="mt-6 p-4 rounded-2xl border" style={{ borderColor: t.border, background: t.cardBg }}>
              {paginationSlot}
            </div>
          )}
        </>
      )}

      {/* TABLE VIEW */}
      {view === "table" && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: t.border, background: t.cardBg }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse">
              <thead>
                <tr className="text-left">
                  {["Produto", "Categoria", "Estoque", "ABC", "Preço", "Status", ""].map((c, i) => (
                    <th key={i} className="px-5 py-3 text-xs font-bold tracking-wider uppercase whitespace-nowrap border-b" style={{ color: t.textSub, background: t.headBg, borderColor: t.border }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProdutos.map((p) => {
                  const color = getCatColor(p.category);
                  const thumbBg = `linear-gradient(140deg, ${color} 0%, ${hex2(color, 0.55)} 55%, ${hex2(color, 0.85)} 100%)`;
                  const ss = statusStyle(p.status);
                  const ab = abcStyle(p.abc);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProduto(p)}
                      className="border-b cursor-pointer transition-colors"
                      style={{ borderColor: t.border }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = t.rowHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white/90 overflow-hidden relative" style={{ background: thumbBg }}>
                            {p.imagem_principal_url ? (
                              <img src={p.imagem_principal_url} alt={p.nome} className="w-full h-full object-cover relative z-10" />
                            ) : (
                              <Package className="w-5 h-5 relative z-10" />
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[260px]">{p.nome}</span>
                            <span className={`${spaceGrotesk.className} text-xs`} style={{ color: t.textSub }}>{p.skuStr}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: hex2(color, 0.15), color }}>
                          {p.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 min-w-[160px]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: t.barTrack }}>
                            <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: stockFillFor(p.status) }} />
                          </div>
                          <span className="text-[13px] font-bold w-14 text-right" style={{ color: p.status === "Ruptura" ? "#EF4444" : p.status === "Estoque baixo" ? "#F59E0B" : t.text }}>
                            {p.stock === 0 ? "0 un" : `${p.stock.toLocaleString("pt-BR")} un`}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-xs font-extrabold" style={{ background: ab.bg, color: ab.color }}>
                          {p.abc}
                        </span>
                      </td>
                      <td className={`px-5 py-3 ${spaceGrotesk.className} text-[14.5px] font-bold`}>
                        {p.priceStr}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-bold" style={{ background: ss.bg, color: ss.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ss.dot }} />
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-bold text-lg" style={{ color: t.textSub }}>›</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {paginationSlot && (
            <div className="p-4 border-t" style={{ borderColor: t.border }}>
              {paginationSlot}
            </div>
          )}
        </div>
      )}

      {/* DETAIL DRAWER */}
      {selectedData && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            onClick={() => setSelectedProduto(null)}
            className="absolute inset-0 overlay-anim"
            style={{ background: "rgba(6,10,20,0.55)", backdropFilter: "blur(3px)" }}
          />
          <div
            className="relative w-[460px] max-w-[92vw] h-full flex flex-col drawer-anim overflow-hidden shadow-[-24px_0_60px_rgba(0,0,0,0.35)]"
            style={{ background: t.drawerBg, borderLeft: `1px solid ${t.border}` }}
          >
            {/* hero thumb */}
            <div className="relative h-[180px] shrink-0 flex items-center justify-center overflow-hidden" style={{ background: selectedData.thumbBg }}>
              <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 12px)" }} />
              
              {selectedData.imagem_principal_url ? (
                <img src={selectedData.imagem_principal_url} alt={selectedData.nome} className="relative z-10 w-full h-full object-cover" />
              ) : (
                <span className="relative z-10 text-white/95">
                  <Package className="w-16 h-16" />
                </span>
              )}

              <button
                onClick={() => setSelectedProduto(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-xl border-none bg-black/30 text-white text-lg cursor-pointer backdrop-blur-sm flex items-center justify-center z-20"
              >
                ✕
              </button>
              <span className="absolute bottom-4 left-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-bold text-white backdrop-blur-sm z-20" style={{ background: selectedData.statusChipBg }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {selectedData.status}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col gap-1.5 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: selectedData.catChipBg, color: selectedData.catColor }}>
                    {selectedData.category}
                  </span>
                  <span className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-xs font-extrabold" style={{ background: selectedData.abcBg, color: selectedData.abcColor }}>
                    {selectedData.abc}
                  </span>
                </div>
                <span className={`${spaceGrotesk.className} text-[22px] font-bold leading-tight text-wrap`}>
                  {selectedData.nome}
                </span>
                <span className={`${spaceGrotesk.className} text-[13px]`} style={{ color: t.textSub }}>
                  {selectedData.skuStr} · EAN {selectedData.ean}
                </span>
              </div>

              {/* price + stock summary */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-4 rounded-[14px] border flex flex-col gap-1" style={{ borderColor: t.border, background: t.cardBg }}>
                  <span className="text-xs" style={{ color: t.textSub }}>Preço de venda</span>
                  <span className={`${spaceGrotesk.className} text-[22px] font-bold`}>{selectedData.priceStr}</span>
                </div>
                <div className="p-4 rounded-[14px] border flex flex-col gap-1" style={{ borderColor: t.border, background: t.cardBg }}>
                  <span className="text-xs" style={{ color: t.textSub }}>Estoque total</span>
                  <span className={`${spaceGrotesk.className} text-[22px] font-bold`} style={{ color: selectedData.stockColor }}>
                    {selectedData.stockLabel}
                  </span>
                </div>
              </div>

              {/* stock level bar */}
              <div className="mb-6 flex flex-col gap-2">
                <div className="flex justify-between text-[12.5px]">
                  <span style={{ color: t.textSub }}>Nível de estoque</span>
                  <span className="font-bold">mín {selectedData.min} · máx {selectedData.max}</span>
                </div>
                <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: t.barTrack }}>
                  <div className="h-full rounded-full" style={{ width: selectedData.stockW, background: selectedData.stockFill }} />
                </div>
              </div>

              {/* specs */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {selectedData.specs.map((s: {k: string, v: string}, i: number) => (
                  <div key={i} className="p-3.5 rounded-xl border flex flex-col gap-1" style={{ borderColor: t.border, background: t.cardBg }}>
                    <span className="text-[11.5px]" style={{ color: t.textSub }}>{s.k}</span>
                    <span className="text-[14.5px] font-bold">{s.v}</span>
                  </div>
                ))}
              </div>

              {/* stock by location */}
              {selectedData.stock > 0 && (
                <div className="mb-6 flex flex-col gap-3">
                  <span className={`${spaceGrotesk.className} text-sm font-bold`}>Estoque por endereço</span>
                  <div className="flex flex-col gap-2">
                    {selectedData.locs.map((l: {code: string, qty: string}, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: t.border, background: t.cardBg }}>
                        <span className={`${spaceGrotesk.className} text-[13.5px] font-bold`}>{l.code}</span>
                        <span className="text-[13px]" style={{ color: t.textSub }}>{l.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* movements */}
              <div className="flex flex-col gap-3.5">
                <span className={`${spaceGrotesk.className} text-sm font-bold`}>Movimentações recentes</span>
                <div className="flex flex-col gap-0.5">
                  {selectedData.moves.map((m: {title: string, sub: string, dot: string, halo: string}, i: number) => (
                    <div key={i} className="flex gap-3.5">
                      <div className="flex flex-col items-center w-3">
                        <span className="w-2.5 h-2.5 rounded-full mt-1" style={{ background: m.dot, boxShadow: `0 0 0 3px ${m.halo}` }} />
                        <span className="flex-1 w-[2px]" style={{ background: t.border }} />
                      </div>
                      <div className="flex flex-col gap-0.5 pb-4">
                        <span className="text-[13.5px] font-bold">{m.title}</span>
                        <span className="text-[12.5px]" style={{ color: t.textSub }}>{m.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 p-4 pt-4 border-t flex flex-wrap gap-2.5" style={{ borderColor: t.border, background: t.drawerBg }}>
              <Link
                href={`/configuracoes/produtos/${selectedData.id}/editar`}
                className="flex-1 h-11 flex items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-[14px] font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                style={{ textDecoration: 'none' }}
              >
                <PencilLine className="h-4 w-4 mr-2" />
                Editar
              </Link>
              <form action={toggleProdutoStatusAction} className="flex-1">
                <input type="hidden" name="id" value={selectedData.id} />
                <input type="hidden" name="nextActive" value={selectedData.ativo ? "false" : "true"} />
                <button
                  type="submit"
                  className="w-full h-11 flex items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-[14px] font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  {selectedData.ativo ? "Desativar" : "Ativar"}
                </button>
              </form>
              <form action={deleteProdutoAction} className="flex-1">
                <input type="hidden" name="id" value={selectedData.id} />
                <button
                  type="submit"
                  className="w-full h-11 flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-[14px] font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
