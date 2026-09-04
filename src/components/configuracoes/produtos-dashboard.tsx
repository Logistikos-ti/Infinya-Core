"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Manrope, Space_Grotesk } from "next/font/google";
import { Package, Search, X } from "lucide-react";
import { useTheme } from "next-themes";
import React from "react";
import { fetchProdutoDrawerDetails } from "@/app/(dashboard)/configuracoes/produtos/actions";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

const manrope = Manrope({ subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

const UNIDADE_LABEL: Record<string, string> = {
  UNIDADE: "un",
  CAIXA: "cx",
  PACK: "pack",
  PALLET: "plt",
};

type Produto = {
  id: string;
  codigo_interno: string | null;
  codigo_externo: string | null;
  sku: string | null;
  nome: string;
  categoria: string | null;
  tamanho?: string | null;
  metodo_retirada: string;
  unidade_estocagem: string;
  ativo: boolean;
  created_at: string;
  depositante_id: string;
  depositante_nome: string | null;
  estoque?: number;
  estoque_minimo?: number;
  estoque_maximo?: number;
  peso_kg?: number | null;
  altura_cm?: number | null;
  largura_cm?: number | null;
  comprimento_cm?: number | null;
  imagem_principal_url?: string | null;
  endereco_primario?: string | null;
  endereco_count?: number;
};

type ProdutosDashboardProps = {
  produtos: Produto[];
  totalProducts: number;
  globalTotal?: number;
  globalAtivos?: number;
  globalInativos?: number;
  globalBaixos?: number;
  globalRupturas?: number;
  formSlot?: React.ReactNode;
  paginationSlot?: React.ReactNode;
  categoryOptions?: string[];
  tamanhoOptions?: string[];
  depositantes?: { id: string; nome: string }[];
};

export function ProdutosDashboard({
  produtos,
  totalProducts,
  globalTotal = 0,
  globalAtivos = 0,
  globalInativos = 0,
  globalBaixos = 0,
  globalRupturas = 0,
  formSlot,
  paginationSlot,
  categoryOptions = [],
  tamanhoOptions = [],
  depositantes = [],
}: ProdutosDashboardProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<"tabela" | "galeria">("tabela");
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [selectedData, setSelectedData] = useState<any>(null);

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

  const catDefs: Record<string, string> = {
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
  const getCatColor = (cat: string) => catDefs[cat] || "#64748b";
  const statusColor = (ativo: boolean) => (ativo ? "#10B981" : "#94A3B8");
  const faixaColor = (faixa: string) => (faixa === "ruptura" ? "#EF4444" : faixa === "baixo" ? "#F59E0B" : t.text);
  const faixaFill = (faixa: string) =>
    faixa === "ruptura" ? "#EF4444" : faixa === "baixo" ? "linear-gradient(90deg,#F59E0B,#FBBF24)" : "linear-gradient(90deg,#3B82F6,#8B5CF6)";

  const hex2 = (h: string, a: number) => {
    if (!h.startsWith("#")) h = "#64748b";
    const n = parseInt(h.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const enrichedProdutos = useMemo(() => {
    return produtos.map((p) => {
      const stock = p.estoque ?? 0;
      const min = p.estoque_minimo ?? 0;
      const max = p.estoque_maximo ?? 1;
      const faixa = stock <= 0 ? "ruptura" : min > 0 && stock < min ? "baixo" : "ok";
      const pct = max > 0 ? Math.min(100, Math.max(0, (stock / max) * 100)) : 0;
      const minPct = max > 0 ? Math.min(100, Math.max(0, (min / max) * 100)) : 0;
      const unidade = UNIDADE_LABEL[p.unidade_estocagem] || "un";
      const enderecoLabel = p.endereco_primario
        ? (p.endereco_count ?? 0) > 1
          ? `${p.endereco_primario} +${(p.endereco_count ?? 1) - 1}`
          : p.endereco_primario
        : "—";

      return {
        ...p,
        stock,
        min,
        max,
        faixa,
        pct,
        minPct,
        unidade,
        category: p.categoria || "Geral",
        ean: p.codigo_externo || "—",
        skuStr: p.sku || p.codigo_interno || "—",
        dim:
          p.altura_cm && p.largura_cm && p.comprimento_cm
            ? `${p.largura_cm} × ${p.altura_cm} × ${p.comprimento_cm} cm`
            : "—",
        weight: p.peso_kg ? `${p.peso_kg} kg` : "—",
        enderecoLabel,
      };
    });
  }, [produtos]);

  const kpis = [
    { label: "Total de SKUs", value: globalTotal, color: t.text },
    { label: "Ativos", value: globalAtivos, color: "#10B981" },
    { label: "Abaixo do mínimo", value: globalBaixos, color: globalBaixos > 0 ? "#F59E0B" : t.text },
    { label: "Ruptura crítica", value: globalRupturas, color: globalRupturas > 0 ? "#EF4444" : t.text },
  ];

  const statusPills = [
    { key: "todos", label: "Todos", count: globalTotal },
    { key: "baixo", label: "Abaixo do mínimo", count: globalBaixos },
    { key: "ruptura", label: "Ruptura crítica", count: globalRupturas },
    { key: "inativos", label: "Inativos", count: globalInativos },
  ];

  const getFilteredHref = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.set("page", "1");
    return `${pathname}?${params.toString()}`;
  };
  const navigate = (updates: Record<string, string>) => router.push(getFilteredHref(updates));

  const currentStatus = searchParams.get("status") || "todos";
  const currentCategoria = searchParams.get("categoria") || "";
  const currentDepositante = searchParams.get("depositante") || "";
  const currentTamanho = searchParams.get("tamanho") || "";
  const currentPerPage = Number.parseInt(searchParams.get("perPage") || "10", 10);
  const perPageOptions = view === "galeria" ? [12, 60] : [10, 50];

  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  useEffect(() => {
    const current = searchParams.get("q") || "";
    if (searchInput === current) return;
    const timer = setTimeout(() => navigate({ q: searchInput }), 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasActiveFilters = Boolean(searchInput || currentCategoria || currentDepositante || currentTamanho || currentStatus !== "todos");
  const clearAllFilters = () => {
    setSearchInput("");
    navigate({ q: "", categoria: "", depositante: "", tamanho: "", status: "" });
  };

  useEffect(() => {
    if (!selectedProduto) {
      setSelectedData(null);
      return;
    }
    const p = enrichedProdutos.find((ep) => ep.id === selectedProduto.id);
    if (!p) return;
    const color = getCatColor(p.category);

    setSelectedData({
      ...p,
      thumbBg: `linear-gradient(140deg, ${color} 0%, ${hex2(color, 0.55)} 55%, ${hex2(color, 0.85)} 100%)`,
      statusColorHex: statusColor(p.ativo),
      lotes: [] as { lote: string; qtd: number; validade: string }[],
      lotesLoading: true,
    });

    fetchProdutoDrawerDetails(p.id).then(({ lotes, produto }) => {
      setSelectedData((prev: any) => {
        if (!prev || prev.id !== p.id) return prev;
        const dim =
          produto?.altura_cm && produto?.largura_cm && produto?.comprimento_cm
            ? `${produto.largura_cm} × ${produto.altura_cm} × ${produto.comprimento_cm} cm`
            : prev.dim;
        const weight = produto?.peso_kg ? `${produto.peso_kg} kg` : prev.weight;
        return { ...prev, lotes, lotesLoading: false, dim, weight };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduto?.id]);

  const specs = selectedData
    ? [
        { label: "SKU", value: selectedData.skuStr, mono: true },
        { label: "EAN", value: selectedData.ean, mono: true },
        { label: "Depositante", value: selectedData.depositante_nome || "—", mono: false },
        ...(selectedData.tamanho ? [{ label: "Tamanho", value: selectedData.tamanho, mono: false }] : []),
        { label: "Endereço", value: selectedData.enderecoLabel, mono: true },
        { label: "Peso unitário", value: selectedData.weight, mono: false },
        { label: "Dimensões", value: selectedData.dim, mono: false },
        { label: "Método de saída", value: selectedData.metodo_retirada, mono: false },
      ]
    : [];

  const FaixaBar = ({ pct, minPct, fill, w, h }: { pct: number; minPct: number; fill: string; w: number | string; h: number }) => (
    <div className="relative overflow-hidden rounded-full" style={{ width: w, height: h, background: t.barTrack }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill, transition: "width .3s ease" }} />
      <div className="absolute top-0 bottom-0" style={{ left: `${minPct}%`, width: 2, background: "#F59E0B" }} />
    </div>
  );

  return (
    <div className={`${manrope.className} flex h-full flex-col animate-in fade-in duration-500`}>
      <style>{`
        @keyframes drawerIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes overlayFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .drawer-anim { animation: drawerIn 0.32s cubic-bezier(.3,1,.4,1); }
        .overlay-anim { animation: overlayFade 0.25s ease; }
        .card-anim { animation: cardIn 0.4s ease both; }
      `}</style>

      {/* Cabeçalho (padrão rebranding: título + sino + tema) */}
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <span className={`${spaceGrotesk.className} rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100`}>
          Produtos
        </span>
        <div className="flex-1" />
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-24 pt-1.5 sm:px-8 lg:pb-12"
        style={{ scrollbarGutter: "stable" }}
      >
        {/* subtitle + view toggle + novo produto */}
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <p className="m-0 text-[14.5px]" style={{ color: t.textSub }}>
            Catálogo de SKUs de todos os depositantes.
          </p>
          <div className="flex gap-2.5 items-center">
            <div className="flex p-1 gap-0.5 rounded-[11px] border" style={{ borderColor: t.border, background: t.cardBg }}>
              {(["tabela", "galeria"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="h-[34px] px-4 rounded-lg border-none text-[13px] font-bold cursor-pointer transition-all duration-200"
                  style={{
                    background: view === v ? "linear-gradient(92deg,#3B82F6,#8B5CF6)" : "transparent",
                    color: view === v ? "#fff" : t.textSub,
                  }}
                >
                  {v === "tabela" ? "Tabela" : "Galeria"}
                </button>
              ))}
            </div>
            {formSlot}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="flex flex-col gap-3 rounded-2xl border p-5" style={{ borderColor: t.border, background: t.cardBg }}>
              <span className="text-[13px] font-semibold" style={{ color: t.textSub }}>
                {k.label}
              </span>
              <span className={`${spaceGrotesk.className} text-[30px] font-bold`} style={{ color: k.color }}>
                {k.value}
              </span>
            </div>
          ))}
        </div>

        {/* status pills — pílula com contador em chip próprio (padrão Infinoos Help) */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <div
            className="inline-flex flex-wrap items-center gap-1 rounded-full border p-1"
            style={{ borderColor: t.border, background: t.cardBg }}
          >
            {statusPills.map((p) => {
              const isActive = currentStatus === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => navigate({ status: p.key })}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full border-none py-1.5 pl-3.5 pr-2.5 text-[12.5px] font-semibold cursor-pointer transition"
                  style={isActive ? { background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff" } : { background: "transparent", color: t.textSub }}
                >
                  <span>{p.label}</span>
                  <span
                    className="grid h-[19px] min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold leading-none"
                    style={isActive ? { background: "rgba(255,255,255,0.24)", color: "#fff" } : { background: t.inputBg, color: t.textSub }}
                  >
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* filter row */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 h-[42px] flex-1 min-w-[200px] px-4 rounded-[11px] border" style={{ borderColor: t.border, background: t.cardBg }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: t.textSub }} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar SKU, EAN, produto..."
              className="flex-1 border-none outline-none bg-transparent text-[14px]"
              style={{ color: t.text }}
            />
          </div>
          <select
            value={currentCategoria}
            onChange={(e) => navigate({ categoria: e.target.value, tamanho: "" })}
            className="h-[42px] px-3 rounded-[11px] border text-[13.5px] font-semibold cursor-pointer"
            style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
          >
            <option value="">Todas categorias</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {depositantes.length > 1 && (
            <select
              value={currentDepositante}
              onChange={(e) => navigate({ depositante: e.target.value })}
              className="h-[42px] px-3 rounded-[11px] border text-[13.5px] font-semibold cursor-pointer"
              style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
            >
              <option value="">Todos depositantes</option>
              {depositantes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          )}
          <select
            value={String(currentPerPage)}
            onChange={(e) => navigate({ perPage: e.target.value })}
            className="h-[42px] px-3 rounded-[11px] border text-[13.5px] font-semibold cursor-pointer"
            style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </select>
          {currentCategoria === "Vestuário" && (
            <select
              value={currentTamanho}
              onChange={(e) => navigate({ tamanho: e.target.value })}
              className="h-[42px] px-3 rounded-[11px] border text-[13.5px] font-semibold cursor-pointer"
              style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
            >
              <option value="">Todos tamanhos</option>
              {tamanhoOptions.map((tm) => (
                <option key={tm} value={tm}>
                  {tm}
                </option>
              ))}
            </select>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              aria-label="Limpar filtros"
              title="Limpar filtros"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] border cursor-pointer transition-colors"
              style={{ borderColor: t.border, background: t.cardBg, color: t.textSub }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#EF4444";
                e.currentTarget.style.color = "#EF4444";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.color = t.textSub;
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* GALLERY VIEW */}
        {view === "galeria" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {enrichedProdutos.length ? (
                enrichedProdutos.map((p, i) => {
                  const color = getCatColor(p.category);
                  const thumbBg = `linear-gradient(140deg, ${color} 0%, ${hex2(color, 0.55)} 55%, ${hex2(color, 0.85)} 100%)`;
                  const sC = statusColor(p.ativo);

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProduto(p)}
                      className="card-anim rounded-[18px] border overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                      style={{
                        borderColor: selectedProduto?.id === p.id ? "rgba(139,92,246,.5)" : t.border,
                        background: t.cardBg,
                        animationDelay: `${i * 0.03}s`,
                      }}
                    >
                      <div className="relative h-[150px] flex items-center justify-center overflow-hidden" style={{ background: thumbBg }}>
                        <div
                          className="absolute inset-0 opacity-15"
                          style={{ backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 11px)" }}
                        />
                        {p.imagem_principal_url ? (
                          <img src={p.imagem_principal_url} alt={p.nome} className="relative z-10 w-full h-full object-cover" />
                        ) : (
                          <Package className="relative z-10 h-11 w-11 text-white/90" />
                        )}
                        <span
                          className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white backdrop-blur-sm z-20"
                          style={{ background: sC }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[15px] font-bold leading-snug line-clamp-2 h-[38px]" style={{ color: t.text }}>
                            {p.nome}
                          </span>
                          <span className={`${MONO} text-[12.5px]`} style={{ color: t.textSub }}>
                            {p.skuStr}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-[12.5px]">
                            <span style={{ color: t.textSub }}>Estoque</span>
                            <span className={`font-bold ${MONO}`} style={{ color: faixaColor(p.faixa) }}>
                              {p.stock === 0 ? `0 ${p.unidade}` : `${p.stock.toLocaleString("pt-BR")} ${p.unidade}`}
                            </span>
                          </div>
                          <FaixaBar pct={p.pct} minPct={p.minPct} fill={faixaFill(p.faixa)} w="100%" h={6} />
                        </div>
                        <div className="flex items-center justify-between pt-1.5 mt-1 border-t text-[11.5px]" style={{ borderColor: t.border, color: t.textSub }}>
                          <span>MIN {p.min}</span>
                          <span>MAX {p.max}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full p-12 text-center" style={{ color: t.textSub }}>
                  Nenhum produto encontrado.
                </div>
              )}
            </div>
            {paginationSlot && (
              <div className="mt-2 p-4 rounded-2xl border" style={{ borderColor: t.border, background: t.cardBg }}>
                {paginationSlot}
              </div>
            )}
          </>
        )}

        {/* TABLE VIEW */}
        {view === "tabela" && (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: t.border, background: t.cardBg }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] table-fixed border-collapse text-[13px]">
                <thead>
                  <tr>
                    {[
                      { label: "Produto", width: "26%" },
                      { label: "Categoria", width: "13%" },
                      { label: "Depositante", width: "16%" },
                      { label: "Estoque", width: "9%" },
                      { label: "Faixa", width: "10%" },
                      { label: "Endereço", width: "14%" },
                      { label: "Status", width: "9%" },
                      { label: "", width: "3%" },
                    ].map((c, i) => (
                      <th
                        key={i}
                        style={{ color: t.textSub, background: t.headBg, borderColor: t.border, width: c.width }}
                        className={`px-4 py-2.5 text-xs font-bold tracking-wider uppercase whitespace-nowrap border-b ${i === 3 ? "text-center" : "text-left"}`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enrichedProdutos.length ? (
                    enrichedProdutos.map((p) => {
                      const color = getCatColor(p.category);
                      const sC = statusColor(p.ativo);
                      const isSelected = selectedProduto?.id === p.id;

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedProduto(p)}
                          className="border-t cursor-pointer transition-colors"
                          style={{ borderColor: t.border, background: isSelected ? "rgba(139,92,246,.08)" : "transparent" }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = t.rowHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isSelected ? "rgba(139,92,246,.08)" : "transparent";
                          }}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-[34px] h-[34px] shrink-0 rounded-[9px] flex items-center justify-center overflow-hidden"
                                style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)` }}
                              >
                                {p.imagem_principal_url ? (
                                  <img src={p.imagem_principal_url} alt={p.nome} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="h-4 w-4" style={{ color }} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13.5px] font-semibold truncate max-w-[220px]" style={{ color: t.text }}>
                                  {p.nome}
                                </div>
                                <div className={`${MONO} text-[11px] mt-0.5`} style={{ color: t.textSub }}>
                                  {p.skuStr}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px]" style={{ color: t.textSub }}>
                            {p.tamanho ? `${p.category} · Tam. ${p.tamanho}` : p.category}
                          </td>
                          <td className="px-4 py-2.5 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px]" style={{ color: t.textSub }}>
                            {p.depositante_nome || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`${MONO} text-[14px] font-extrabold`} style={{ color: faixaColor(p.faixa) }}>
                              {p.stock.toLocaleString("pt-BR")}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <FaixaBar pct={p.pct} minPct={p.minPct} fill={faixaFill(p.faixa)} w={70} h={8} />
                          </td>
                          <td className={`px-4 py-2.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] ${MONO}`} style={{ color: t.textSub }}>
                            {p.enderecoLabel}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold whitespace-nowrap"
                              style={{ background: `${sC}1a`, color: sC }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: sC }} />
                              {p.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="font-bold text-lg" style={{ color: t.textSub }}>
                              ›
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center" style={{ color: t.textSub }}>
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  )}
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
      </div>

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
            <div className="flex items-start gap-3.5 p-[22px_24px_16px] border-b" style={{ borderColor: t.border }}>
              <div
                className="w-14 h-14 shrink-0 rounded-[14px] flex items-center justify-center overflow-hidden"
                style={{ background: selectedData.thumbBg }}
              >
                {selectedData.imagem_principal_url ? (
                  <img src={selectedData.imagem_principal_url} alt={selectedData.nome} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-[26px] w-[26px] text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold"
                  style={{ background: `${selectedData.statusColorHex}1a`, color: selectedData.statusColorHex }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedData.statusColorHex }} />
                  {selectedData.ativo ? "Ativo" : "Inativo"}
                </span>
                <div className={`${spaceGrotesk.className} text-[16px] font-bold mt-1.5`} style={{ color: t.text }}>
                  {selectedData.nome}
                </div>
                <div className={`${MONO} text-[12px] mt-0.5`} style={{ color: t.textSub }}>
                  {selectedData.skuStr} · {selectedData.category}
                </div>
              </div>
              <button
                onClick={() => setSelectedProduto(null)}
                className="w-[30px] h-[30px] rounded-lg border flex items-center justify-center shrink-0 text-lg"
                style={{ borderColor: t.border, color: t.textSub, background: "transparent" }}
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5" style={{ color: t.textSub }}>
                  <span>Estoque atual</span>
                  <span className="font-bold" style={{ color: t.text }}>
                    MIN {selectedData.min} · MAX {selectedData.max}
                  </span>
                </div>
                <FaixaBar pct={selectedData.pct} minPct={selectedData.minPct} fill={faixaFill(selectedData.faixa)} w="100%" h={10} />
                <div className={`${spaceGrotesk.className} text-[26px] font-extrabold mt-2`} style={{ color: faixaColor(selectedData.faixa) }}>
                  {selectedData.stock.toLocaleString("pt-BR")} {selectedData.unidade}
                </div>
              </div>

              {specs.map((s, i) => (
                <div key={i} className="flex justify-between gap-3 py-2.5 border-b text-[13.5px]" style={{ borderColor: t.border }}>
                  <span style={{ color: t.textSub }}>{s.label}</span>
                  <span className={`font-semibold text-right ${s.mono ? MONO : ""}`} style={{ color: t.text }}>
                    {s.value}
                  </span>
                </div>
              ))}

              <div className="mt-5">
                <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase mb-2.5" style={{ color: "#8B5CF6" }}>
                  Lotes ({selectedData.lotes.length})
                </div>
                {selectedData.lotesLoading ? (
                  <div className="text-[12.5px] py-2" style={{ color: t.textSub }}>
                    Carregando lotes...
                  </div>
                ) : selectedData.lotes.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedData.lotes.map((l: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-[10px] border" style={{ borderColor: t.border, background: t.inputBg }}>
                        <div className="flex-1 min-w-0">
                          <div className={`${MONO} text-[13px] font-bold`} style={{ color: t.text }}>
                            {l.lote}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: t.textSub }}>
                            {l.qtd} {selectedData.unidade}
                          </div>
                        </div>
                        <span className={`${MONO} text-[11.5px]`} style={{ color: t.textSub }}>
                          val. {l.validade}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[12.5px] italic" style={{ color: t.textSub }}>
                    Sem lote registrado.
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 p-4 border-t" style={{ borderColor: t.border, background: t.drawerBg }}>
              <Link
                href={`/configuracoes/produtos/${selectedData.id}/editar?returnPath=${encodeURIComponent(
                  pathname + (searchParams.toString() ? "?" + searchParams.toString() : ""),
                )}`}
                prefetch={false}
                className="flex items-center justify-center h-11 rounded-[10px] border-none text-[14px] font-extrabold"
                style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff", textDecoration: "none" }}
              >
                Editar produto
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
