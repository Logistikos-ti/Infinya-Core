"use client";

import { useState } from "react";
import { Download, Plus, Layers3, Truck, Clock, CheckCircle2 } from "lucide-react";
import { RomaneioCard } from "./romaneio-card";
import { RomaneioDrawer } from "./romaneio-drawer";
import type { RomaneioUI } from "./romaneio-types";

// ==========================================
// MOCK DATA GENERATION (from original design)
// ==========================================
const hex2 = (h: string, a: number) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const carriers: Record<string, string> = {
  Jadlog: "#E11D48",
  Correios: "#2563EB",
  "Total Express": "#7C3AED",
  Loggi: "#F59E0B",
  Braspress: "#0891B2",
  "Frota Própria": "#10B981",
};

const statusStyle = (s: string) => {
  if (s === "Em montagem")
    return {
      statusBg: hex2("#8B5CF6", 0.16),
      statusColor: "#A78BFA",
      statusDot: "#8B5CF6",
    };
  if (s === "Aguardando")
    return {
      statusBg: hex2("#F59E0B", 0.16),
      statusColor: "#F59E0B",
      statusDot: "#F59E0B",
    };
  if (s === "Carregando")
    return {
      statusBg: hex2("#10B981", 0.14),
      statusColor: "#10B981",
      statusDot: "#10B981",
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

const cities = [
  "São Paulo · SP",
  "Guarulhos · SP",
  "Osasco · SP",
  "Campinas · SP",
  "Santos · SP",
  "Barueri · SP",
  "São Bernardo · SP",
];
const names = [
  "Marina Costa",
  "Bruno Almeida",
  "Carla Menezes",
  "Diego Ferreira",
  "Patrícia Lima",
  "Renato Souza",
  "Fernanda Dias",
  "Loja Beta Ltda",
];

const rawData = [
  { code: "ROM-3120", carrier: "Frota Própria", route: "Rota SP Capital - Zona Sul", orders: 12, volumes: 38, weight: "412 kg", cap: 72, driver: "Anderson Melo", plate: "FQR-2H18", vehicle: "VUC 3/4", departure: "Sai 14:30", status: "Carregando" },
  { code: "ROM-3121", carrier: "Jadlog", route: "Coleta ML - Interior", orders: 24, volumes: 61, weight: "188 kg", cap: 88, driver: "Coleta agendada", plate: "JAD-9021", vehicle: "Fiorino", departure: "Coleta 15h", status: "Aguardando" },
  { code: "ROM-3122", carrier: "Frota Própria", route: "Rota SP Capital - Zona Oeste", orders: 8, volumes: 22, weight: "96 kg", cap: 45, driver: "Márcio Reis", plate: "GTA-4C55", vehicle: "VUC", departure: "Sai 16:00", status: "Em montagem" },
  { code: "ROM-3123", carrier: "Total Express", route: "Grande SP - ABC", orders: 31, volumes: 74, weight: "523 kg", cap: 96, driver: "Coleta agendada", plate: "TEX-1188", vehicle: "Truck", departure: "Coleta 17h", status: "Aguardando" },
  { code: "ROM-3118", carrier: "Loggi", route: "Same Day - Capital", orders: 18, volumes: 40, weight: "84 kg", cap: 60, driver: "Fábio Nunes", plate: "LOG-7742", vehicle: "Moto/Van", departure: "Saiu 11:20", status: "Expedido" },
  { code: "ROM-3124", carrier: "Braspress", route: "Transferência - MG", orders: 15, volumes: 52, weight: "640 kg", cap: 82, driver: "Em separação", plate: "—", vehicle: "Truck", departure: "Prev. 18h", status: "Em montagem" },
];

const buildMockRomaneios = (): RomaneioUI[] => {
  const grad = "linear-gradient(92deg,#3B82F6,#8B5CF6)";
  return rawData.map((r) => {
    const cc = carriers[r.carrier] || "#64748B";
    const ss = statusStyle(r.status);
    const cap = capColor(r.cap);
    const nStops = Math.min(6, Math.max(3, Math.round(r.orders / 4)));
    const stops = [];
    for (let i = 0; i < nStops; i++) {
      stops.push({
        seq: i + 1,
        customer: names[i % names.length],
        code: "#EC-" + (48219 + i),
        city: cities[i % cities.length],
        vol: 2 + (i % 4) + " vol",
        weight: 4 + i * 3 + " kg",
      });
    }
    const depColor =
      r.status === "Expedido"
        ? "#8695AD" // textSub
        : r.status === "Carregando"
        ? "#10B981"
        : "inherit";
    return {
      ...r,
      ...ss,
      carrierColor: cc,
      carrierBg: hex2(cc, 0.15),
      carrierInit: r.carrier.slice(0, 2).toUpperCase(),
      capColor: cap,
      capFill: r.cap >= 95 ? "#EF4444" : r.cap >= 80 ? "linear-gradient(90deg,#F59E0B,#FBBF24)" : grad,
      depColor,
      specs: [
        { k: "Transportadora", v: r.carrier },
        { k: "Rota", v: r.route },
        { k: "Motorista", v: r.driver },
        { k: "Placa", v: r.plate },
        { k: "Veículo", v: r.vehicle },
        { k: "Saída prevista", v: r.departure },
      ],
      stops,
    };
  });
};

const mockRomaneios = buildMockRomaneios();

export function RomaneioDashboard() {
  const [selectedRomaneio, setSelectedRomaneio] = useState<RomaneioUI | null>(null);

  const kpis = [
    {
      label: "Romaneios hoje",
      value: "18",
      delta: "",
      deltaColor: "#8695AD",
      iconEl: <Layers3 className="w-5 h-5" />,
      iconBg: "rgba(59,130,246,0.14)",
      iconColor: "#3B82F6",
    },
    {
      label: "Em carregamento",
      value: "4",
      delta: "",
      deltaColor: "#10B981",
      iconEl: <Truck className="w-5 h-5" />,
      iconBg: "rgba(16,185,129,0.14)",
      iconColor: "#10B981",
    },
    {
      label: "Aguardando",
      value: "7",
      delta: "",
      deltaColor: "#F59E0B",
      iconEl: <Clock className="w-5 h-5" />,
      iconBg: "rgba(245,158,11,0.14)",
      iconColor: "#F59E0B",
    },
    {
      label: "Expedidos hoje",
      value: "31",
      delta: "▲ 8%",
      deltaColor: "#10B981",
      iconEl: <CheckCircle2 className="w-5 h-5" />,
      iconBg: "rgba(139,92,246,0.14)",
      iconColor: "#8B5CF6",
    },
  ];

  const filterDefs = [
    { label: "Todos", active: true },
    { label: "Em montagem", count: 3 },
    { label: "Aguardando", count: 7 },
    { label: "Carregando", count: 4 },
    { label: "Expedidos", count: 4 },
  ];

  return (
    <>
      {/* Title row */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-6 mt-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
            <span>Expedição</span>
            <span>›</span>
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
            className="p-5 rounded-[16px] border border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-[#101B30]/70 backdrop-blur-sm flex flex-col gap-3"
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
          const active = f.active;
          return (
            <button
              key={i}
              className={`h-9 px-[15px] rounded-[9px] font-[family-name:var(--font-manrope)] text-[13px] font-bold flex items-center gap-2 transition-all duration-200 ${
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
          {mockRomaneios.length} romaneios
        </span>
      </div>

      {/* Romaneios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-[18px]">
        {mockRomaneios.map((r, i) => (
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
