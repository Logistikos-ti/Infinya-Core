"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Manrope, Space_Grotesk } from "next/font/google";
import { Box, ChevronLeft, ChevronRight, Download, Gauge, Lock, MapPin, Percent, Printer, Tag, Trash2, Unlock, X } from "lucide-react";
import { deleteEnderecoAction, toggleEnderecoStatusAction } from "@/app/(dashboard)/configuracoes/enderecos/actions";
import { AddressBarcodePreview } from "@/components/configuracoes/endereco-form";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

type Endereco = {
  id: string;
  codigo: string;
  descricao: string | null;
  area: string;
  rua: string | null;
  modulo: string | null;
  nivel: string | null;
  posicao: string | null;
  capacidade_maxima: number | null;
  unidade_padrao: string | null;
  ativo: boolean;
  created_at: string;
};

type EnderecosDashboardProps = {
  enderecos: Endereco[];
  addressMetrics: Record<string, {
    quantidade: number;
    skus: string[];
    ocupacao: number | null;
  }>;
  addressMovements: Record<string, Array<{
    id: string;
    tipo: string;
    quantidade: number;
    created_at: string;
    observacoes: string | null;
    endereco_origem_id: string | null;
    endereco_destino_id: string | null;
    produto?: { sku?: string | null; nome?: string | null } | Array<{ sku?: string | null; nome?: string | null }> | null;
    criado_por?: { nome?: string | null } | Array<{ nome?: string | null }> | null;
  }>>;
  kpiData: {
    total: number;
    ocupacaoMedia: number;
    vazios: number;
    bloqueados: number;
  };
  children?: React.ReactNode; // Para injetar os formulários ocultos (como Bulk Generator) se necessário
  formSlot?: React.ReactNode; // Para o form de edição/criação
  initialShowForm?: boolean;
};

export function EnderecosDashboard({
  enderecos,
  addressMetrics,
  addressMovements,
  kpiData,
  formSlot,
  children,
  initialShowForm = false,
}: EnderecosDashboardProps) {
  const router = useRouter();
  const [view, setView] = useState<"table" | "map">("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<"TODOS" | "PICKING" | "PULMAO" | "DISPONIVEIS" | "BLOQUEADOS">("TODOS");
  const [showForm, setShowForm] = useState(initialShowForm);
  const [labelOpen, setLabelOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printSelection, setPrintSelection] = useState<Record<string, number>>({});
  const pageSize = 10;

  useEffect(() => {
    if (initialShowForm) {
      setSelectedId(null);
      setShowForm(true);
    }
  }, [initialShowForm]);

  const selected = useMemo(() => enderecos.find((e) => e.id === selectedId) || null, [enderecos, selectedId]);
  const selectedMetric = selected
    ? addressMetrics[selected.id] ?? { quantidade: 0, skus: [], ocupacao: null }
    : null;
  const selectedOccupancy = selectedMetric?.ocupacao ?? 0;
  const selectedArea = selected?.area === "PULMAO" ? "Armazenagem" : selected?.area === "BLOQUEADO" ? "Bloqueado" : selected?.area;
  const selectedType = selectedArea ? `${selectedArea.charAt(0)}${selectedArea.slice(1).toLowerCase()}` : "Não definido";
  const selectedMovements = selected ? addressMovements[selected.id] ?? [] : [];
  const selectedCreatedAt = selected
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(selected.created_at))
    : "-";

  function downloadSelectedLabel() {
    if (!selected) return;
    const svg = document.getElementById(`barcode-label-modal-${selected.id}`)?.querySelector("svg");
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `etiqueta-${selected.codigo}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openPrintDialog() {
    setPrintSelection(Object.fromEntries(filtered.map((address) => [address.id, 1])));
    setPrintOpen(true);
  }

  function printSelectedLabels() {
    const selectedAddresses = filtered.filter((address) => (printSelection[address.id] ?? 0) > 0);
    if (!selectedAddresses.length) return;

    const labels = selectedAddresses.flatMap((address) => {
      const quantity = Math.max(1, Number(printSelection[address.id] ?? 1));
      const svg = document.getElementById(`barcode-print-${address.id}`)?.querySelector("svg");
      const barcode = svg ? new XMLSerializer().serializeToString(svg) : "";
      return Array.from({ length: quantity }, () => `
        <section class="label">
          <img class="logo" src="/branding/infinoos-icon-wms.svg" alt="Infinoos WMS" />
          <div class="brand">INFINOOS WMS</div>
          <div class="address">${address.codigo}</div>
          ${address.descricao ? `<div class="description">${address.descricao}</div>` : ""}
          <div class="barcode">${barcode}</div>
          <div class="code">${address.codigo}</div>
        </section>
      `);
    }).join("");

    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>Etiquetas de endereços</title><style>
      @page { size: 100mm 150mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, sans-serif; }
      .label { position: relative; width: 100mm; height: 150mm; page-break-after: always; padding: 12mm 8mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .logo { position: absolute; top: 5mm; left: 7mm; width: 16mm; height: 16mm; object-fit: contain; filter: grayscale(1); }
      .brand { font-size: 14pt; font-weight: 700; letter-spacing: .08em; margin-bottom: 9mm; }
      .address { font-size: 30pt; font-weight: 800; line-height: 1.1; word-break: break-word; }
      .description { margin-top: 4mm; font-size: 12pt; }
      .barcode { width: 84mm; margin-top: 11mm; }
      .barcode svg { display: block; width: 84mm; height: 34mm; }
      .code { margin-top: 3mm; font-size: 11pt; letter-spacing: .08em; }
    </style></head><body>${labels}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  // KPIs
  const kpis = useMemo(() => {
    return [
      { label: "Total de endereços", value: kpiData.total, detail: "base atual", icon: <MapPin className="w-5 h-5" />, iconBg: "rgba(59,130,246,0.12)", iconColor: "#3B82F6" },
      { label: "Ocupação média", value: `${kpiData.ocupacaoMedia}%`, detail: "da capacidade", icon: <Gauge className="w-5 h-5" />, iconBg: "rgba(16,185,129,0.12)", iconColor: "#10B981" },
      { label: "Endereços vazios", value: kpiData.vazios, detail: "sem saldo", icon: <Box className="w-5 h-5" />, iconBg: "rgba(139,92,246,0.12)", iconColor: "#8B5CF6" },
      { label: "Bloqueados", value: kpiData.bloqueados, detail: "fora de operação", icon: <Percent className="w-5 h-5" />, iconBg: "rgba(244,63,94,0.12)", iconColor: "#F43F5E" },
    ];
  }, [kpiData]);

  const filtered = useMemo(() => enderecos.filter((address) => {
    const metric = addressMetrics[address.id] ?? { quantidade: 0, skus: [], ocupacao: null };
    const blocked = !address.ativo || address.area === "BLOQUEADO";
    if (activeFilter === "PICKING") return address.area === "PICKING";
    if (activeFilter === "PULMAO") return address.area === "PULMAO";
    if (activeFilter === "DISPONIVEIS") return !blocked;
    if (activeFilter === "BLOQUEADOS") return blocked;
    return true;
  }), [activeFilter, addressMetrics, enderecos]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage],
  );

  // Mapa Data
  const mapData = useMemo(() => {
    const normalized = filtered
      .filter((item) => item.rua && item.modulo && item.nivel && item.posicao)
      .map((item) => ({
        ...item,
        rua: item.rua || "SEM-RUA",
        modulo: item.modulo || "SEM-MODULO",
        nivel: item.nivel || "SEM-NIVEL",
        posicao: item.posicao || "SEM-POSICAO",
      }));

    const ruas = [...new Set(normalized.map((item) => item.rua))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    
    return ruas.map(rua => {
      const ruaItems = normalized.filter(i => i.rua === rua);
      // Aqui simplificamos a visão: cada posição vira uma barra no "aisle"
      const cells = ruaItems.sort((a,b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })).map(item => {
        // Simulamos ocupação aleatória para visualização se não tiver dados de estoque reais
        const occPct = item.ativo && item.area !== "BLOQUEADO" ? Math.floor(Math.random() * 100) : 0;
        
        let fill = "var(--e-emptyCell)";
        let ring = "transparent";
        let h = "0%";
        let pulse = "none";
        let glow = "none";

        if (!item.ativo || item.area === "BLOQUEADO") {
          fill = "#EF4444";
          h = "100%";
        } else if (occPct > 90) {
          fill = "#F59E0B";
          h = `${occPct}%`;
        } else if (occPct > 0) {
          fill = "linear-gradient(to top, #3B82F6, #8B5CF6)";
          h = `${occPct}%`;
        } else {
          fill = "transparent";
          ring = "var(--e-border)";
        }

        if (selectedId === item.id) {
          ring = "#8B5CF6";
          glow = "0 0 0 4px rgba(139,92,246,0.25)";
          pulse = "cellPulse 2s infinite";
        }

        return { ...item, fill, ring, h, pulse, selGlow: glow, occPct };
      });

      return { label: `Rua ${rua}`, meta: `${cells.length} posições`, cells };
    });
  }, [filtered, selectedId]);

  const addressTableRows = useMemo(() => enderecos.map((address) => {
    const metric = addressMetrics[address.id] ?? { quantidade: 0, skus: [], ocupacao: null };
    const blocked = !address.ativo || address.area === "BLOQUEADO";
    const empty = !blocked && metric.quantidade <= 0;
    const full = !blocked && !empty && metric.ocupacao !== null && metric.ocupacao >= 100;
    const status = blocked ? "Bloqueado" : empty ? "Vazio" : full ? "Cheio" : "Ativo";
    const statusClass = status === "Bloqueado"
      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
      : status === "Cheio"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : status === "Vazio"
          ? "bg-slate-500/10 text-slate-600 dark:text-slate-300"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    const statusDot = status === "Bloqueado" ? "bg-rose-500" : status === "Cheio" ? "bg-amber-500" : status === "Vazio" ? "bg-slate-400" : "bg-emerald-500";
    const area = address.area === "PULMAO" ? "Armazenagem" : address.area === "BLOQUEADO" ? "Bloqueado" : address.area;
    const sku = metric.skus.length > 1 ? `${metric.skus[0]} +${metric.skus.length - 1}` : metric.skus[0] ?? "—";
    const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(metric.quantidade);
    return { ...address, metric, status, statusClass, statusDot, area, sku, quantity };
  }), [enderecos, addressMetrics]);

  return (
    <div className={`e-theme ${manrope.variable} ${space.variable} font-manrope relative flex w-full flex-col bg-transparent text-[var(--e-text)] transition-colors duration-300`}>
      <style>{`
        .e-theme {
          font-family: var(--font-manrope), Arial, Helvetica, sans-serif;
          --e-appBg: #F5F7FB;
          --e-cardBg: #FFFFFF;
          --e-headBg: #F8FAFC;
          --e-inputBg: #F8FAFC;
          --e-tagBg: rgba(100,116,139,0.10);
          --e-border: rgba(100,116,139,0.16);
          --e-rowHover: rgba(100,116,139,0.04);
          --e-barTrack: rgba(100,116,139,0.14);
          --e-text: #0F172A;
          --e-textSub: #64748B;
          --e-drawerBg: #FFFFFF;
          --e-mapGrid: rgba(71,85,105,0.07);
          --e-scan: rgba(99,102,241,0.08);
          --e-aisleBg: rgba(100,116,139,0.04);
          --e-emptyCell: rgba(100,116,139,0.08);
          --e-mapBg: radial-gradient(120% 100% at 50% 0%, #EEF2FB 0%, #F4F6FB 60%, #F7F9FD 100%);
        }
        .e-theme .font-manrope { font-family: var(--font-manrope), Arial, Helvetica, sans-serif; }
        .e-theme .font-space { font-family: var(--font-space), Arial, Helvetica, sans-serif; }
        .dark .e-theme {
          --e-appBg: transparent; /* usa o fundo do dashboard */
          --e-cardBg: #101B30;
          --e-headBg: #0E1728;
          --e-inputBg: #101B30;
          --e-tagBg: rgba(148,163,184,0.12);
          --e-border: rgba(148,163,184,0.14);
          --e-rowHover: rgba(148,163,184,0.05);
          --e-barTrack: rgba(148,163,184,0.16);
          --e-text: #F1F5F9;
          --e-textSub: #8695AD;
          --e-drawerBg: #0C1526;
          --e-mapGrid: rgba(148,163,184,0.06);
          --e-scan: rgba(96,165,250,0.10);
          --e-aisleBg: rgba(148,163,184,0.04);
          --e-emptyCell: rgba(148,163,184,0.07);
          --e-mapBg: radial-gradient(120% 100% at 50% 0%, #0E1B33 0%, #0A1424 55%, #080F1D 100%);
        }
        @keyframes scanY { 0% { transform: translateY(-30%); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(560%); opacity: 0; } }
        @keyframes fillGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes cellPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.0); } 50% { box-shadow: 0 0 14px 2px rgba(139,92,246,0.55); } }
        @keyframes drawerIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes overlayFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gridPan { from { background-position: 0 0, 0 0; } to { background-position: 42px 42px, 42px 42px; } }
        @keyframes floatUp { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-360px); opacity: 0; } }
      `}</style>

      <div className="flex-1 px-0 pb-8 pt-3">
        {/* title row */}
        <div className="flex items-end justify-between gap-5 flex-wrap mb-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[13px] text-[var(--e-textSub)]">
              <span>Armazém</span>
              <span aria-hidden="true">›</span>
              <span className="font-semibold text-[var(--e-text)]">Endereços</span>
            </div>
            <h1 className="m-0 font-space text-[28px] font-bold">Endereçamento</h1>
            <p className="m-0 text-[14.5px] text-[var(--e-textSub)]">Gestão de posições, ocupação e status dos endereços do armazém.</p>
          </div>
          <div className="flex gap-2.5 items-center">
            {/* view switch */}
            <div className="flex p-1 gap-1 rounded-xl border border-[var(--e-border)] bg-[var(--e-inputBg)]">
              <button
                onClick={() => setView("table")}
                className={`h-9 px-4 rounded-lg font-manrope text-[13.5px] font-bold cursor-pointer flex items-center gap-2 transition-all ${view === "table" ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm" : "bg-transparent text-[var(--e-textSub)]"}`}
              >
                ☰ Tabela
              </button>
              <button
                onClick={() => setView("map")}
                className={`h-9 px-4 rounded-lg font-manrope text-[13.5px] font-bold cursor-pointer flex items-center gap-2 transition-all ${view === "map" ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm" : "bg-transparent text-[var(--e-textSub)]"}`}
              >
                ▦ Mapa
              </button>
            </div>
            <button
              type="button"
              onClick={openPrintDialog}
              className="h-[44px] px-4 rounded-xl border border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-text)] font-manrope text-sm font-extrabold cursor-pointer flex items-center gap-2 transition-all hover:-translate-y-[1px] hover:border-violet-400 hover:text-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
            <button
              onClick={() => { setSelectedId(null); setShowForm(true); }}
              className="h-[44px] px-5 border-none rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-manrope text-sm font-extrabold cursor-pointer shadow-[0_8px_22px_rgba(99,102,241,0.32)] flex items-center gap-2 hover:-translate-y-[1px] transition-transform"
            >
              + Novo endereço
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((k, i) => (
            <div key={i} className="p-5 rounded-2xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[var(--e-textSub)]">{k.label}</span>
                <span className="w-[34px] h-[34px] rounded-lg flex items-center justify-center" style={{ background: k.iconBg, color: k.iconColor }}>{k.icon}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-space text-[30px] font-bold">{k.value}</span>
                <span className="text-[13px] font-semibold text-[var(--e-textSub)]">{k.detail}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden">
          {[
            ["TODOS", "Todos"],
            ["PICKING", "Picking"],
            ["PULMAO", "Pulmão"],
            ["DISPONIVEIS", "Disponíveis"],
            ["BLOQUEADOS", "Bloqueados"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveFilter(value as typeof activeFilter)}
              className={`h-10 rounded-xl border px-4 text-[13px] font-bold transition-all ${activeFilter === value ? "border-transparent bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm" : "border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-textSub)] hover:border-violet-400 hover:text-violet-500"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "table" && (
          <div className="rounded-2xl border border-[var(--e-border)] bg-[var(--e-cardBg)] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--e-border)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  ["TODOS", "Todos"],
                  ["PICKING", "Picking"],
                  ["PULMAO", "PulmÃ£o"],
                  ["DISPONIVEIS", "DisponÃ­veis"],
                  ["BLOQUEADOS", "Bloqueados"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveFilter(value as typeof activeFilter)}
                    className={`h-9 rounded-xl border px-4 text-[13px] font-bold transition-all ${activeFilter === value ? "border-transparent bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm" : "border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-text)] hover:border-violet-400 hover:-translate-y-0.5"}`}
                  >
                    {value === "PULMAO" ? "Pulm\u00e3o" : value === "DISPONIVEIS" ? "Dispon\u00edveis" : label}
                  </button>
                ))}
              </div>
              <span className="text-[13px] text-[var(--e-textSub)]">{filtered.length} endereços encontrados</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead>
                  <tr className="text-left">
                    {["Endereço", "Rua / Setor", "Tipo", "SKU", "Ocupação", "Qtd.", "Status"].map((column) => (
                      <th key={column} className="border-b border-[var(--e-border)] bg-[var(--e-headBg)] px-5 py-3 text-[12px] font-bold uppercase tracking-wider text-[var(--e-textSub)] whitespace-nowrap">{column}</th>
                    ))}
                    <th className="border-b border-[var(--e-border)] bg-[var(--e-headBg)] px-5 py-3 text-right text-[12px] font-bold uppercase tracking-wider text-[var(--e-textSub)]">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((address) => {
                    const row = addressTableRows.find((item) => item.id === address.id);
                    if (!row) return null;
                    return (
                      <tr key={row.id} onClick={() => setSelectedId(row.id)} className="cursor-pointer border-b border-[var(--e-border)] transition-colors hover:bg-[var(--e-rowHover)]">
                        <td className="px-5 py-4"><span className="font-space text-[14.5px] font-bold text-[var(--e-text)]">{row.codigo}</span></td>
                        <td className="px-5 py-4 text-[14px] text-[var(--e-textSub)]">{[row.rua, row.modulo].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="px-5 py-4"><span className="rounded-full bg-[var(--e-tagBg)] px-3 py-1 text-[12px] font-bold text-[var(--e-textSub)]">{row.area}</span></td>
                        <td className="px-5 py-4 font-space text-[13.5px] font-bold text-[var(--e-text)]">{row.sku}</td>
                        <td className="min-w-[170px] px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 min-w-[80px] flex-1 overflow-hidden rounded-full bg-[var(--e-barTrack)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${row.metric.ocupacao ?? 0}%` }} /></div>
                            <span className="text-[13px] font-bold text-[var(--e-textSub)]">{row.metric.ocupacao === null ? "—" : `${row.metric.ocupacao}%`}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[14px] text-[var(--e-textSub)]">{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(row.metric.quantidade)}{row.unidade_padrao ? ` ${row.unidade_padrao.toLowerCase()}` : ""}</td>
                        <td className="px-5 py-4"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-bold ${row.statusClass}`}><span className={`h-2 w-2 rounded-full ${row.statusDot}`} />{row.status}</span></td>
                        <td className="px-5 py-4 text-right"><span className="text-lg font-bold leading-none text-[var(--e-textSub)] hover:text-violet-500">›</span></td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-sm text-[var(--e-textSub)]">Nenhum endereço encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--e-border)] px-4 py-3.5"><span className="text-[13px] text-[var(--e-textSub)]">Mostrando {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} de {filtered.length} endereços</span><div className="flex items-center gap-1.5"><button type="button" aria-label="Página anterior" disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-textSub)] transition hover:border-violet-400 hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <button key={page} type="button" aria-current={page === safePage ? "page" : undefined} onClick={() => setCurrentPage(page)} className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-[13px] font-bold transition ${page === safePage ? "border-transparent bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm" : "border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-textSub)] hover:border-violet-400 hover:text-violet-500"}`}>{page}</button>)}<button type="button" aria-label="Próxima página" disabled={safePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-textSub)] transition hover:border-violet-400 hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>}
          </div>
        )}

        {/* TABLE VIEW */}
        {false && view === "table" && (
          <div className="rounded-2xl border border-[var(--e-border)] bg-[var(--e-cardBg)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--e-border)]">
              <span className="text-[13px] text-[var(--e-textSub)]">{filtered.length} endereços encontrados</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[1080px]">
                <thead>
                  <tr className="text-left">
                    {["Endereço", "Área", "Tipo", "Status"].map((c, i) => (
                      <th key={i} className="py-3 px-5 text-[12px] font-bold tracking-wider uppercase text-[var(--e-textSub)] bg-[var(--e-headBg)] border-b border-[var(--e-border)] whitespace-nowrap">{c}</th>
                    ))}
                    <th className="py-3 px-5 text-[12px] font-bold tracking-wider uppercase text-[var(--e-textSub)] bg-[var(--e-headBg)] border-b border-[var(--e-border)] whitespace-nowrap text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => (
                    <tr key={r.id} onClick={() => setSelectedId(r.id)} className="border-b border-[var(--e-border)] cursor-pointer transition-colors hover:bg-[var(--e-rowHover)]">
                      <td className="py-4 px-5"><span className="font-space font-bold text-[14.5px] text-[var(--e-text)]">{r.codigo}</span></td>
                      <td className="py-4 px-5 text-[14px] text-[var(--e-textSub)]">{r.area}</td>
                      <td className="py-4 px-5"><span className="px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--e-tagBg)] text-[var(--e-textSub)]">{r.unidade_padrao || "Indefinido"}</span></td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-bold ${r.ativo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                          <span className={`w-2 h-2 rounded-full ${r.ativo ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {r.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right"><span className="font-bold text-[var(--e-textSub)] hover:text-violet-500 text-lg leading-none">›</span></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[var(--e-textSub)] text-sm">Nenhum endereço encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--e-border)] px-4 py-3.5">
                <span className="text-[13px] text-[var(--e-textSub)]">
                  Mostrando {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filtered.length)} de {filtered.length} endereços
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Página anterior"
                    disabled={safePage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-textSub)] transition hover:border-violet-400 hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      aria-current={page === safePage ? "page" : undefined}
                      onClick={() => setCurrentPage(page)}
                      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-[13px] font-bold transition ${page === safePage ? "border-transparent bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm" : "border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-textSub)] hover:border-violet-400 hover:text-violet-500"}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Próxima página"
                    disabled={safePage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-textSub)] transition hover:border-violet-400 hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MAP VIEW */}
        {view === "map" && (
          <div className="relative rounded-2xl border border-[var(--e-border)] overflow-hidden transition-colors" style={{ background: "var(--e-mapBg)" }}>
            <div className="absolute -inset-10 pointer-events-none" style={{ backgroundImage: "linear-gradient(var(--e-mapGrid) 1px, transparent 1px), linear-gradient(90deg, var(--e-mapGrid) 1px, transparent 1px)", backgroundSize: "42px 42px", animation: "gridPan 8s linear infinite", maskImage: "radial-gradient(120% 100% at 50% 30%, #000 40%, transparent 92%)", WebkitMaskImage: "radial-gradient(120% 100% at 50% 30%, #000 40%, transparent 92%)" }} />
            <div className="absolute left-0 right-0 top-0 h-[90px] pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, var(--e-scan), transparent)", animation: "scanY 6s ease-in-out infinite" }} />
            
            <div className="relative flex items-center justify-between gap-4 p-5 md:px-6 border-b border-[var(--e-border)] flex-wrap">
              <div className="flex flex-col gap-1">
                <span className="font-space text-[17px] font-bold">Mapa de ocupação</span>
                <span className="text-[13px] text-[var(--e-textSub)]">Cada barra é uma posição. Altura e cor representam a ocupação.</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-[12.5px] text-[var(--e-textSub)]"><span className="w-3 h-3 rounded-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />Ocupado</div>
                <div className="flex items-center gap-2 text-[12.5px] text-[var(--e-textSub)]"><span className="w-3 h-3 rounded-[3px] bg-amber-500" />Cheio</div>
                <div className="flex items-center gap-2 text-[12.5px] text-[var(--e-textSub)]"><span className="w-3 h-3 rounded-[3px] bg-red-500" />Bloqueado</div>
                <div className="flex items-center gap-2 text-[12.5px] text-[var(--e-textSub)]"><span className="w-3 h-3 rounded-[3px] border border-[var(--e-border)] bg-[var(--e-emptyCell)]" />Vazio</div>
              </div>
            </div>

            <div className="relative p-6 flex flex-col gap-5 overflow-x-auto">
              {mapData.map((a, i) => (
                <div key={i} className="flex items-stretch gap-4 min-w-[600px]">
                  <div className="w-[74px] shrink-0 flex flex-col justify-center gap-1">
                    <span className="font-space text-[15px] font-bold">{a.label}</span>
                    <span className="text-[11.5px] text-[var(--e-textSub)]">{a.meta}</span>
                  </div>
                  <div className="flex-1 flex items-end gap-1.5 h-[92px] p-2.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-aisleBg)]">
                    {a.cells.map((c, ci) => (
                      <div key={ci} onClick={() => setSelectedId(c.id)} title={c.codigo} className="flex-1 h-full min-w-[14px] rounded-md relative overflow-hidden cursor-pointer hover:-translate-y-1 transition-all" style={{ background: "var(--e-emptyCell)", border: `1px solid ${c.ring}`, boxShadow: c.selGlow, animation: c.pulse }}>
                        <div className="absolute left-0 right-0 bottom-0 origin-bottom" style={{ height: c.h, background: c.fill, animation: "fillGrow 0.7s cubic-bezier(.3,1,.4,1)" }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {mapData.length === 0 && (
                <div className="py-12 text-center text-[var(--e-textSub)] text-sm border-2 border-dashed border-[var(--e-border)] rounded-2xl">
                  Nenhuma rua cadastrada com posições válidas.
                </div>
              )}
            </div>
            <div className="absolute left-[18%] bottom-[20px] w-[3px] h-[3px] rounded-full bg-blue-400 shadow-[0_0_8px_#60A5FA] pointer-events-none" style={{ animation: "floatUp 7s linear infinite" }} />
            <div className="absolute left-[52%] bottom-[20px] w-[3px] h-[3px] rounded-full bg-violet-400 shadow-[0_0_8px_#A78BFA] pointer-events-none" style={{ animation: "floatUp 9s linear infinite 2s" }} />
          </div>
        )}

        {/* EXTRA FORMS INJECTED VIA CHILDREN (Bulk generator, etc) */}
        {children && (
          <div className="mt-8">
            {children}
          </div>
        )}
      </div>

      {printOpen ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm" onClick={() => setPrintOpen(false)}>
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold tracking-[0.14em] text-slate-500 dark:text-zinc-400">IMPRESSÃO TÉRMICA</p>
                <h2 className="mt-1 font-space text-xl font-bold text-slate-950 dark:text-white">Escolha as etiquetas</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Cada etiqueta será impressa em 100 mm x 150 mm.</p>
              </div>
              <button type="button" aria-label="Fechar impressão" onClick={() => setPrintOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-violet-500/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 max-h-[52vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
              {filtered.map((address) => {
                const quantity = printSelection[address.id] ?? 0;
                return (
                  <div key={address.id} className="flex items-center gap-4 border-b border-slate-100 p-3 last:border-b-0 dark:border-zinc-800">
                    <input type="checkbox" checked={quantity > 0} onChange={(event) => setPrintSelection((current) => ({ ...current, [address.id]: event.target.checked ? 1 : 0 }))} className="h-4 w-4 accent-violet-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-space text-sm font-bold text-slate-900 dark:text-white">{address.codigo}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-zinc-400">{address.descricao || "Endereço operacional"}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">Quantidade
                      <input type="number" min={0} max={99} value={quantity} onChange={(event) => setPrintSelection((current) => ({ ...current, [address.id]: Math.max(0, Math.min(99, Number(event.target.value) || 0)) }))} className="h-9 w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
                    </label>
                    <div id={`barcode-print-${address.id}`} className="pointer-events-none absolute -left-[99999px] opacity-0"><AddressBarcodePreview value={address.codigo} /></div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setPrintOpen(false)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-violet-500/10">Cancelar</button>
              <button type="button" onClick={printSelectedLabels} disabled={!Object.values(printSelection).some((quantity) => quantity > 0)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-bold text-white shadow-[0_8px_22px_rgba(99,102,241,0.28)] transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"><Printer className="h-4 w-4" />Imprimir etiquetas</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* DRAWER AND MODAL FORMS */}
      {(selected || showForm) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setSelectedId(null); setShowForm(false); }} style={{ animation: "overlayFade 0.25s ease" }} />
          
          <div className="relative w-[440px] max-w-[92vw] h-full flex flex-col overflow-hidden bg-[var(--e-drawerBg)] border-l border-[var(--e-border)] shadow-2xl" style={{ animation: "drawerIn 0.32s cubic-bezier(.3,1,.4,1)" }}>
            
            {showForm && !selected ? (
              // Modo de Criação/Edição usando o Form Slot existente
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold font-space text-[var(--e-text)]">
                    {initialShowForm ? "Editar Endereço" : "Adicionar Endereço"}
                  </h2>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--e-border)] text-[var(--e-textSub)] hover:text-red-500">✕</button>
                </div>
                {formSlot}
              </div>
            ) : selected && (
              // Modo Drawer Detalhes
              <>
                <div className="relative p-6 pb-5 border-b border-[var(--e-border)] overflow-hidden">
                  <div className="absolute w-[260px] h-[260px] -right-[80px] -top-[120px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.20), transparent 70%)" }} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <span className="text-[12px] font-bold tracking-[0.12em] text-[var(--e-textSub)]">ENDEREÇO</span>
                      <span className="font-space text-[28px] font-bold leading-none">{selected.codigo}</span>
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-bold mt-1 ${selected.ativo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                        <span className={`w-2 h-2 rounded-full ${selected.ativo ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {selected.ativo ? "Operacional" : "Inativo"}
                      </span>
                    </div>
                    <button onClick={() => setSelectedId(null)} className="w-9 h-9 flex-shrink-0 rounded-lg border border-[var(--e-border)] bg-[var(--e-inputBg)] text-[var(--e-textSub)] flex items-center justify-center hover:text-violet-500 transition-colors">✕</button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="flex items-center gap-5 p-5 rounded-2xl border border-[var(--e-border)] bg-[var(--e-cardBg)] mb-5">
                    <div className="relative w-[100px] h-[100px] shrink-0">
                      <svg width="100" height="100" viewBox="0 0 116 116" className="-rotate-90">
                        <circle cx="58" cy="58" r="50" fill="none" stroke="var(--e-barTrack)" strokeWidth="12" />
                        <circle cx="58" cy="58" r="50" fill="none" stroke="url(#ringGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray="314" strokeDashoffset={314 - (314 * selectedOccupancy) / 100} className="transition-all duration-700" />
                        <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-space text-[22px] font-bold">{selectedOccupancy}%</span>
                        <span className="text-[10px] text-[var(--e-textSub)]">ocupação</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 flex-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] text-[var(--e-textSub)]">Área</span>
                        <span className="font-space text-[16px] font-bold">{selectedArea}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] text-[var(--e-textSub)]">Capacidade Máxima</span>
                        <span className="text-[15px] font-bold">{selected.capacidade_maxima ? `${selected.capacidade_maxima} un` : "Sem limite"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mb-5">
                    <span className="font-space text-[14px] font-bold">Etiqueta do endereço</span>
                    <div className="relative">
                      <img src="/branding/infinoos-icon-wms.svg" alt="Infinoos WMS" className="pointer-events-none absolute left-5 top-2 z-10 h-8 w-8 object-contain grayscale" />
                      <AddressBarcodePreview value={selected.codigo} containerId={`barcode-label-${selected.id}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Tipo</span>
                      <span className="text-[14.5px] font-bold">{selectedType}</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Rua / Setor</span>
                      <span className="text-[14.5px] font-bold">{selected.rua || "-"}</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Prédio</span>
                      <span className="text-[14.5px] font-bold">{selected.modulo || "Não informado"}</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Nível</span>
                      <span className="text-[14.5px] font-bold">{selected.nivel || "Não informado"}</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Peso máx.</span>
                      <span className="text-[14.5px] font-bold">Não informado</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Última contagem</span>
                      <span className="text-[14.5px] font-bold">Sem registro</span>
                    </div>
                  </div>

                  <div className="mb-6 flex flex-col gap-4">
                    <span className="font-space text-[14px] font-bold">Capacidade</span>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-[13px]"><span className="text-[var(--e-textSub)]">Volume</span><span className="font-bold">{selectedMetric?.ocupacao === null ? "Sem limite" : `${selectedOccupancy}%`}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--e-barTrack)]"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-700" style={{ width: `${selectedOccupancy}%` }} /></div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-[13px]"><span className="text-[var(--e-textSub)]">Peso</span><span className="font-bold text-[var(--e-textSub)]">Não informado</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--e-barTrack)]"><div className="h-full w-0 rounded-full bg-gradient-to-r from-blue-500 to-violet-500" /></div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <span className="font-space text-[14px] font-bold">Movimentações recentes</span>
                    {selectedMovements.length > 0 ? (
                      <div className="flex flex-col">
                        {selectedMovements.map((movement, index) => {
                          const movementProduct = Array.isArray(movement.produto) ? movement.produto[0] : movement.produto;
                          const movementUser = Array.isArray(movement.criado_por) ? movement.criado_por[0] : movement.criado_por;
                          const movementLabels: Record<string, string> = {
                            ENTRADA: "Entrada de mercadoria",
                            SAIDA: "Saída de estoque",
                            TRANSFERENCIA: "Transferência de estoque",
                            AJUSTE_POSITIVO: "Ajuste positivo",
                            AJUSTE_NEGATIVO: "Ajuste negativo",
                            BLOQUEIO: "Endereço bloqueado",
                            DESBLOQUEIO: "Endereço desbloqueado",
                          };
                          const movementColors: Record<string, string> = {
                            ENTRADA: "bg-emerald-500",
                            SAIDA: "bg-blue-500",
                            TRANSFERENCIA: "bg-violet-500",
                            AJUSTE_POSITIVO: "bg-emerald-500",
                            AJUSTE_NEGATIVO: "bg-amber-500",
                            BLOQUEIO: "bg-rose-500",
                            DESBLOQUEIO: "bg-slate-500",
                          };
                          const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(movement.created_at));
                          const direction = movement.endereco_destino_id === selected.id ? "Entrada no endereço" : "Saída do endereço";
                          return (
                            <div key={movement.id} className="flex gap-3">
                              <div className="flex w-3 shrink-0 flex-col items-center">
                                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${movementColors[movement.tipo] ?? "bg-slate-500"}`} />
                                {index < selectedMovements.length - 1 ? <span className="w-0.5 flex-1 bg-[var(--e-border)]" /> : null}
                              </div>
                              <div className="flex flex-col gap-1 pb-4">
                                <span className="text-[13.5px] font-bold">{movementLabels[movement.tipo] ?? movement.tipo}</span>
                                <span className="text-[12.5px] text-[var(--e-textSub)]">{when} · {movementUser?.nome || "Sistema"} · {direction}</span>
                                <span className="text-[12px] text-[var(--e-textSub)]">{movementProduct?.sku || movementProduct?.nome || "Produto não informado"} · {movement.quantidade} un{movement.observacoes ? ` · ${movement.observacoes}` : ""}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] p-4 text-[13px] text-[var(--e-textSub)]">
                        Endereço criado em {selectedCreatedAt}. Ainda não há movimentações registradas para este endereço.
                      </div>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div className="shrink-0 p-4 border-t border-[var(--e-border)] grid grid-cols-[minmax(0,1fr)_46px_46px_minmax(0,1.2fr)] gap-2.5 bg-[var(--e-drawerBg)]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setShowForm(true);
                      router.push(`/configuracoes/enderecos?editar=${selected.id}`);
                    }}
                    className="flex-1 h-[46px] rounded-xl border border-[var(--e-border)] bg-[var(--e-inputBg)] font-manrope text-[14px] font-bold hover:border-violet-500 transition-colors"
                  >
                    Editar
                  </button>
                  <form action={deleteEnderecoAction} className="w-full" onSubmit={(event) => {
                    if (!window.confirm(`Excluir o endereço ${selected.codigo}?`)) event.preventDefault();
                  }}>
                    <input type="hidden" name="id" value={selected.id} />
                    <button
                      type="submit"
                      aria-label="Excluir endereço"
                      title="Excluir endereço"
                      className="flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50 font-manrope text-[14px] font-bold text-rose-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-100 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                  <form action={toggleEnderecoStatusAction} className="w-full" onSubmit={(event) => {
                    const action = selected.ativo ? "bloquear" : "desbloquear";
                    if (!window.confirm(`${action.charAt(0).toUpperCase()}${action.slice(1)} o endereço ${selected.codigo}?`)) event.preventDefault();
                  }}>
                    <input type="hidden" name="id" value={selected.id} />
                    <input type="hidden" name="nextActive" value={selected.ativo ? "false" : "true"} />
                    <button
                      type="submit"
                      aria-label={selected.ativo ? "Bloquear endereço" : "Desbloquear endereço"}
                      title={selected.ativo ? "Bloquear endereço" : "Desbloquear endereço"}
                      className={`flex h-[46px] w-[46px] items-center justify-center rounded-xl border font-manrope text-[14px] font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 ${selected.ativo ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-400 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"}`}
                    >
                      {selected.ativo ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </button>
                  </form>
                  <button type="button" onClick={() => setLabelOpen(true)} className="w-full h-[46px] rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-manrope text-[14px] font-extrabold shadow-[0_8px_22px_rgba(99,102,241,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(99,102,241,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"><span className="inline-flex items-center justify-center gap-2"><Tag className="h-4 w-4" />Etiqueta</span></button>
                </div>
                {labelOpen ? (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm" onClick={() => setLabelOpen(false)}>
                    <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-200 [&>div:first-child>button]:transition-all [&>div:first-child>button:hover]:-translate-y-0.5 [&>div:first-child>button:hover]:border-violet-300 [&>div:first-child>button:hover]:bg-violet-50 dark:border-zinc-800 dark:bg-zinc-950" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-bold tracking-[0.14em] text-slate-500 dark:text-zinc-400">ETIQUETA DO ENDEREÇO</p>
                          <h3 className="mt-1 font-space text-xl font-bold text-slate-950 dark:text-white">{selected.codigo}</h3>
                        </div>
                        <button type="button" onClick={() => setLabelOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 dark:border-zinc-700 dark:text-zinc-300">✕</button>
                      </div>
                      <div className="mt-5 [&_svg]:h-[150px]">
                        <AddressBarcodePreview value={selected.codigo} containerId={`barcode-label-modal-${selected.id}`} />
                      </div>
                      <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={() => setLabelOpen(false)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-violet-500/60 dark:hover:bg-violet-500/10">Fechar</button>
                        <button type="button" onClick={downloadSelectedLabel} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-bold text-white shadow-[0_8px_22px_rgba(99,102,241,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(99,102,241,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><Download className="h-4 w-4" />Baixar etiqueta</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
