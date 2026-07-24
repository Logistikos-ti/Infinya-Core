"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Manrope, Space_Grotesk } from "next/font/google";
import { Box, ChevronLeft, ChevronRight, Gauge, MapPin, Percent, Trash2 } from "lucide-react";
import { deleteEnderecoAction } from "@/app/(dashboard)/configuracoes/enderecos/actions";

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
  kpiData,
  formSlot,
  children,
  initialShowForm = false,
}: EnderecosDashboardProps) {
  const router = useRouter();
  const [view, setView] = useState<"table" | "map">("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(initialShowForm);
  const pageSize = 10;

  useEffect(() => {
    if (initialShowForm) {
      setSelectedId(null);
      setShowForm(true);
    }
  }, [initialShowForm]);

  const selected = useMemo(() => enderecos.find((e) => e.id === selectedId) || null, [enderecos, selectedId]);

  // KPIs
  const kpis = useMemo(() => {
    return [
      { label: "Total de endereços", value: kpiData.total, detail: "base atual", icon: <MapPin className="w-5 h-5" />, iconBg: "rgba(59,130,246,0.12)", iconColor: "#3B82F6" },
      { label: "Ocupação média", value: `${kpiData.ocupacaoMedia}%`, detail: "da capacidade", icon: <Gauge className="w-5 h-5" />, iconBg: "rgba(16,185,129,0.12)", iconColor: "#10B981" },
      { label: "Endereços vazios", value: kpiData.vazios, detail: "sem saldo", icon: <Box className="w-5 h-5" />, iconBg: "rgba(139,92,246,0.12)", iconColor: "#8B5CF6" },
      { label: "Bloqueados", value: kpiData.bloqueados, detail: "fora de operação", icon: <Percent className="w-5 h-5" />, iconBg: "rgba(244,63,94,0.12)", iconColor: "#F43F5E" },
    ];
  }, [kpiData]);

  const filtered = enderecos;

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

      <div className="flex-1 px-0 pb-8 pt-7">
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

        {/* TABLE VIEW */}
        {view === "table" && (
          <div className="rounded-2xl border border-[var(--e-border)] bg-[var(--e-cardBg)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--e-border)]">
              <span className="text-[13px] text-[var(--e-textSub)]">{filtered.length} endereços encontrados</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[880px]">
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
                  {/* Occupancy dummy */}
                  <div className="flex items-center gap-5 p-5 rounded-2xl border border-[var(--e-border)] bg-[var(--e-cardBg)] mb-5">
                    <div className="relative w-[100px] h-[100px] shrink-0">
                      <svg width="100" height="100" viewBox="0 0 116 116" className="-rotate-90">
                        <circle cx="58" cy="58" r="50" fill="none" stroke="var(--e-barTrack)" strokeWidth="12" />
                        <circle cx="58" cy="58" r="50" fill="none" stroke="url(#ringGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray="314" strokeDashoffset={selected.ativo ? "80" : "314"} className="transition-all duration-1000" />
                        <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-space text-[22px] font-bold">{selected.ativo ? "75%" : "0%"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 flex-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] text-[var(--e-textSub)]">Área</span>
                        <span className="font-space text-[16px] font-bold">{selected.area}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] text-[var(--e-textSub)]">Capacidade Máxima</span>
                        <span className="text-[15px] font-bold">{selected.capacidade_maxima || "Sem limite"}</span>
                      </div>
                    </div>
                  </div>
                  {/* Specs */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Rua</span>
                      <span className="text-[14.5px] font-bold">{selected.rua || "-"}</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Módulo</span>
                      <span className="text-[14.5px] font-bold">{selected.modulo || "-"}</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Nível</span>
                      <span className="text-[14.5px] font-bold">{selected.nivel || "-"}</span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-[var(--e-border)] bg-[var(--e-cardBg)] flex flex-col gap-1.5">
                      <span className="text-[11.5px] text-[var(--e-textSub)]">Posição</span>
                      <span className="text-[14.5px] font-bold">{selected.posicao || "-"}</span>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="shrink-0 p-4 border-t border-[var(--e-border)] flex gap-2.5 bg-[var(--e-drawerBg)]">
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
                  <form action={deleteEnderecoAction} className="flex-1" onSubmit={(event) => {
                    if (!window.confirm(`Excluir o endereço ${selected.codigo}?`)) event.preventDefault();
                  }}>
                    <input type="hidden" name="id" value={selected.id} />
                    <button
                      type="submit"
                      className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 font-manrope text-[14px] font-bold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </form>
                  <button className="flex-[1.2] h-[46px] rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-manrope text-[14px] font-extrabold shadow-[0_8px_22px_rgba(99,102,241,0.32)]">⎙ Imprimir Etiqueta</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
