"use client";

import { useState, useMemo } from "react";
import { Download, Plus, Layers3, Truck, Clock, CheckCircle2 } from "lucide-react";
import { RomaneioCard } from "./romaneio-card";
import { RomaneioDrawer } from "./romaneio-drawer";
import type { RomaneioRecordListItem, RomaneioSuggestionGroup } from "@/lib/romaneio-records";
import type { RomaneioUI, RomaneioStop } from "./romaneio-types";

type RomaneioDashboardProps = {
  records: RomaneioRecordListItem[];
  suggestions: RomaneioSuggestionGroup[];
};

// ==========================================
// MOCK DATA GENERATION (from original design)
// ==========================================
const hex2 = (h: string, a: number) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function getCarrierBrand(rawName: string) {
  const name = (rawName || "").trim();
  const lower = name.toLowerCase();

  if (lower.includes("shopee")) {
    return { color: "#EE4D2D", bg: hex2("#EE4D2D", 0.16), init: "SH" };
  }
  if (lower.includes("mercado") || lower.includes("meli")) {
    return { color: "#2D3277", bg: hex2("#FFE600", 0.35), init: "ML" };
  }
  if (lower.includes("amazon")) {
    return { color: "#FF9900", bg: hex2("#FF9900", 0.16), init: "AM" };
  }
  if (lower.includes("magalu") || lower.includes("magazine")) {
    return { color: "#0086FF", bg: hex2("#0086FF", 0.16), init: "MG" };
  }
  if (lower.includes("jadlog")) {
    return { color: "#E11D48", bg: hex2("#E11D48", 0.16), init: "JD" };
  }
  if (lower.includes("correio") || lower.includes("sedex") || lower.includes("pac")) {
    return { color: "#2563EB", bg: hex2("#2563EB", 0.16), init: "CR" };
  }
  if (lower.includes("total express") || lower.includes("totalexpress")) {
    return { color: "#7C3AED", bg: hex2("#7C3AED", 0.16), init: "TX" };
  }
  if (lower.includes("loggi")) {
    return { color: "#0284C7", bg: hex2("#0284C7", 0.16), init: "LG" };
  }
  if (lower.includes("braspress")) {
    return { color: "#0891B2", bg: hex2("#0891B2", 0.16), init: "BP" };
  }
  if (lower.includes("manda") || lower.includes("mandae")) {
    return { color: "#16A34A", bg: hex2("#16A34A", 0.16), init: "MD" };
  }
  if (lower.includes("sequoia")) {
    return { color: "#DC2626", bg: hex2("#DC2626", 0.16), init: "SQ" };
  }
  if (lower.includes("azul")) {
    return { color: "#0284C7", bg: hex2("#0284C7", 0.16), init: "AZ" };
  }
  if (lower.includes("latam")) {
    return { color: "#BE123C", bg: hex2("#BE123C", 0.16), init: "LA" };
  }
  if (lower.includes("gollog") || lower.includes("gol")) {
    return { color: "#EA580C", bg: hex2("#EA580C", 0.16), init: "GL" };
  }
  if (lower.includes("kangu")) {
    return { color: "#F97316", bg: hex2("#F97316", 0.16), init: "KG" };
  }
  if (lower.includes("melhor envio")) {
    return { color: "#06B6D4", bg: hex2("#06B6D4", 0.16), init: "ME" };
  }
  if (lower.includes("própria") || lower.includes("propria")) {
    return { color: "#10B981", bg: hex2("#10B981", 0.16), init: "FP" };
  }

  const init = name.length >= 2 ? name.slice(0, 2).toUpperCase() : (name || "TR").toUpperCase();
  return { color: "#64748B", bg: hex2("#64748B", 0.14), init };
}

const statusStyle = (s: string) => {
  if (s === "Aberto")
    return {
      statusBg: hex2("#8B5CF6", 0.16),
      statusColor: "#A78BFA",
      statusDot: "#8B5CF6",
    };
  if (s === "Expedido")
    return {
      statusBg: hex2("#3B82F6", 0.14),
      statusColor: "#3B82F6",
      statusDot: "#3B82F6",
    };
  return {
    statusBg: "rgba(148,163,184,0.06)",
    statusColor: "#8695AD",
    statusDot: "#8695AD",
  };
};

const capColor = (c: number) => (c >= 95 ? "#EF4444" : c >= 80 ? "#F59E0B" : "#10B981");

const mapRecordToUI = (r: RomaneioRecordListItem): RomaneioUI => {
  const brand = getCarrierBrand(r.carrierName);
  const ss = statusStyle(r.status === "ABERTO" ? "Aberto" : r.status === "LIBERADO" ? "Expedido" : "Cancelado");
  const cap = 70; // We don't have cap in DB for now
  const grad = "linear-gradient(92deg,#3B82F6,#8B5CF6)";
  
  const stops: RomaneioStop[] = r.orders.map((o: any, i: number) => ({
    seq: i + 1,
    customer: o.customer,
    code: o.code,
    city: o.destination,
    vol: o.units,
    weight: o.total, // Using total instead of weight for now
  }));
  
  return {
    id: r.id,
    orderIds: r.orders.map((o: any) => o.id),
    transportadoraId: r.transportadoraId,
    transportadoraNome: r.carrierName,
    code: r.code,
    carrier: r.carrierName,
    route: r.destinations.join(" · ") || "N/A",
    orders: r.orderCount,
    volumes: r.totalUnitsRaw,
    weight: r.totalValue, 
    cap,
    driver: r.driverName || "Não definido",
    plate: r.vehiclePlate || "—",
    vehicle: r.vehicleModel || "—",
    departure: new Date(r.createdAt).toLocaleDateString("pt-BR"),
    status: r.status === "ABERTO" ? "Aberto" : r.status === "LIBERADO" ? "Expedido" : "Cancelado",
    carrierColor: brand.color,
    carrierBg: brand.bg,
    carrierInit: brand.init,
    capColor: capColor(cap),
    capFill: cap >= 95 ? "#EF4444" : cap >= 80 ? "linear-gradient(90deg,#F59E0B,#FBBF24)" : grad,
    statusBg: ss.statusBg,
    statusColor: ss.statusColor,
    statusDot: ss.statusDot,
    depColor: r.status === "LIBERADO" ? "#8695AD" : "#8B5CF6",
    specs: [
      { k: "Transportadora", v: r.carrierName },
      { k: "Rota", v: r.destinations.join(" · ") || "N/A" },
      { k: "Motorista", v: r.driverName || "—" },
      { k: "Placa", v: r.vehiclePlate || "—" },
      { k: "Veículo", v: r.vehicleModel || "—" },
      { k: "Criação", v: new Date(r.createdAt).toLocaleString("pt-BR") },
    ],
    stops,
  };
};

const mapSuggestionToUI = (s: RomaneioSuggestionGroup): RomaneioUI => {
  const brand = getCarrierBrand(s.carrierName);
  const ss = {
    statusBg: hex2("#F59E0B", 0.16),
    statusColor: "#F59E0B",
    statusDot: "#F59E0B",
  };
  const cap = 0; 
  const grad = "linear-gradient(92deg,#F59E0B,#FBBF24)";
  
  const stops: RomaneioStop[] = s.orders.map((o, i) => ({
    seq: i + 1,
    customer: o.customer,
    code: o.code,
    city: o.destination,
    vol: o.units,
    weight: o.total,
  }));
  
  return {
    id: null,
    orderIds: s.orders.map(o => o.id),
    transportadoraId: s.transportadoraId,
    transportadoraNome: s.carrierName,
    code: "NOVO",
    carrier: s.carrierName,
    route: s.destinations.join(" · ") || "N/A",
    orders: s.orderCount,
    volumes: s.totalUnitsRaw,
    weight: s.totalValue, 
    cap,
    driver: "Sugestão",
    plate: "—",
    vehicle: "—",
    departure: s.cutoff,
    status: "Sugestão",
    carrierColor: brand.color,
    carrierBg: brand.bg,
    carrierInit: brand.init,
    capColor: capColor(cap),
    capFill: grad,
    statusBg: ss.statusBg,
    statusColor: ss.statusColor,
    statusDot: ss.statusDot,
    depColor: "#F59E0B",
    specs: [
      { k: "Transportadora", v: s.carrierName },
      { k: "Destinos", v: `${s.destinations.length} cidades` },
      { k: "Pedidos", v: `${s.orderCount} pendentes` },
      { k: "Valor Ref", v: s.totalValue },
    ],
    stops,
  };
};

export function RomaneioDashboard({ records = [], suggestions = [] }: RomaneioDashboardProps) {
  const [selectedRomaneio, setSelectedRomaneio] = useState<RomaneioUI | null>(null);
  const [activeFilter, setActiveFilter] = useState("Todos");

  const uiRecords = records.map(mapRecordToUI);
  const uiSuggestions = suggestions.map(mapSuggestionToUI);
  const allRomaneios = [...uiRecords, ...uiSuggestions];
  const filteredRomaneios = allRomaneios.filter((r) => activeFilter === "Todos" || r.status === activeFilter);

  const today = useMemo(() => new Date().toLocaleDateString("pt-BR"), []);
  
  const romaneiosHoje = uiRecords.filter(r => r.departure === today).length;
  const emCarregamento = uiRecords.filter(r => r.status === "Aberto").length;
  const aguardandoSugestoes = uiSuggestions.length;
  const expedidosHoje = uiRecords.filter(r => r.status === "Expedido" && r.departure === today).length;

  const kpis = [
    {
      label: "Criados hoje",
      value: romaneiosHoje.toString(),
      delta: "",
      deltaColor: "#8695AD",
      iconEl: <Layers3 className="w-5 h-5" />,
      iconBg: "rgba(59,130,246,0.14)",
      iconColor: "#3B82F6",
    },
    {
      label: "Em carregamento (Abertos)",
      value: emCarregamento.toString(),
      delta: "",
      deltaColor: "#10B981",
      iconEl: <Truck className="w-5 h-5" />,
      iconBg: "rgba(16,185,129,0.14)",
      iconColor: "#10B981",
    },
    {
      label: "Sugestões (Aguardando)",
      value: aguardandoSugestoes.toString(),
      delta: "",
      deltaColor: "#F59E0B",
      iconEl: <Clock className="w-5 h-5" />,
      iconBg: "rgba(245,158,11,0.14)",
      iconColor: "#F59E0B",
    },
    {
      label: "Expedidos hoje",
      value: expedidosHoje.toString(),
      delta: "",
      deltaColor: "#10B981",
      iconEl: <CheckCircle2 className="w-5 h-5" />,
      iconBg: "rgba(139,92,246,0.14)",
      iconColor: "#8B5CF6",
    },
  ];

  const filterDefs = [
    { label: "Todos", count: allRomaneios.length },
    { label: "Aberto", count: uiRecords.filter(r => r.status === "Aberto").length },
    { label: "Sugestão", count: uiSuggestions.length },
    { label: "Expedido", count: uiRecords.filter(r => r.status === "Expedido").length },
  ];

  return (
    <>
      {/* Title row */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-6 mt-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
            <span className="text-slate-900 dark:text-slate-100 font-semibold">
              Romaneio
            </span>
          </div>
          <h1 className="m-0 font-[family-name:var(--font-space-grotesk)] text-[28px] font-bold text-slate-900 dark:text-slate-100">
            Romaneios de carga
          </h1>
          <p className="m-0 text-[14.5px] text-slate-500 dark:text-slate-400">
            Agrupamento de pedidos por rota, veículo e transportadora para o carregamento.
          </p>
        </div>
        <div className="flex gap-2.5 items-center">
          <button className="h-11 px-4 rounded-[11px] border border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-[#101B30]/70 text-slate-900 dark:text-slate-100 font-[family-name:var(--font-manrope)] text-sm font-bold flex items-center gap-2 hover:border-violet-500 dark:hover:border-violet-400 transition-colors">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button className="h-11 px-5 rounded-[11px] bg-gradient-to-r from-blue-500 to-violet-500 text-white font-[family-name:var(--font-manrope)] text-sm font-extrabold flex items-center gap-2 shadow-[0_8px_22px_rgba(99,102,241,0.32)] hover:-translate-y-[1px] transition-transform">
            <Plus className="w-4 h-4" strokeWidth={3} /> Novo romaneio
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <div
            key={i}
            className="p-5 rounded-[16px] border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#101B30] flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                {k.label}
              </span>
              <span
                className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center"
                style={{ backgroundColor: k.iconBg, color: k.iconColor }}
              >
                {k.iconEl}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-space-grotesk)] text-[30px] font-bold text-slate-900 dark:text-slate-100">
                {k.value}
              </span>
              {k.delta && (
                <span
                  className="text-[13px] font-bold"
                  style={{ color: k.deltaColor }}
                >
                  {k.delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2.5 mb-5 flex-wrap">
        {filterDefs.map((f, i) => {
          const active = activeFilter === f.label;
          return (
            <button
              key={i}
              onClick={() => setActiveFilter(f.label)}
              className={`h-9 px-[15px] rounded-[9px] font-[family-name:var(--font-manrope)] text-[13px] font-bold flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                active
                  ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white border-transparent"
                  : "bg-white/70 dark:bg-[#101B30]/70 backdrop-blur-sm text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              {f.label}
              {f.count != null && (
                <span
                  className={`px-2 py-[1px] rounded-full text-[11px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        <span className="text-[13px] text-slate-500 dark:text-slate-400">
          {filteredRomaneios.length} romaneios
        </span>
      </div>

      {/* Romaneios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-[18px]">
        {filteredRomaneios.map((r, i) => (
          <RomaneioCard key={i} romaneio={r} onClick={() => setSelectedRomaneio(r)} />
        ))}
      </div>

      {selectedRomaneio && (
        <RomaneioDrawer
          romaneio={selectedRomaneio}
          onClose={() => setSelectedRomaneio(null)}
        />
      )}
    </>
  );
}
