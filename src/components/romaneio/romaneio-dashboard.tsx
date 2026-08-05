"use client";

import { useState, useMemo } from "react";
import { Download, Plus, Layers3, Truck, CheckCircle2, PackageX } from "lucide-react";
import { RomaneioCard } from "./romaneio-card";
import { RomaneioDrawer } from "./romaneio-drawer";
import type { RomaneioRecordListItem, RomaneioSuggestionGroup } from "@/lib/romaneio-records";
import type { RomaneioUI, RomaneioStop } from "./romaneio-types";
import { getCarrierBrand, hexToRgba as hex2 } from "@/lib/carrier-branding";
import { formatDatePtBr, formatDateTimePtBr } from "@/lib/utils";

type RomaneioDashboardProps = {
  records: RomaneioRecordListItem[];
  suggestions?: RomaneioSuggestionGroup[];
};

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
  const cap = 70;
  const grad = "linear-gradient(92deg,#3B82F6,#8B5CF6)";
  
  const stops: RomaneioStop[] = r.orders.map((o: any, i: number) => ({
    seq: i + 1,
    customer: o.customer,
    code: o.code,
    city: o.destination,
    invoiceNumber: o.invoiceNumber || "Sem NF",
    vol: o.units,
    weight: o.total,
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
    departure: formatDatePtBr(r.createdAt),
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
      { k: "Criação", v: formatDateTimePtBr(r.createdAt) },
    ],
    stops,
  };
};

export function RomaneioDashboard({ records = [] }: RomaneioDashboardProps) {
  const [selectedRomaneio, setSelectedRomaneio] = useState<RomaneioUI | null>(null);
  const [activeFilter, setActiveFilter] = useState("Todos");

  const allRomaneios = useMemo(() => records.map(mapRecordToUI), [records]);
  const filteredRomaneios = allRomaneios.filter((r) => activeFilter === "Todos" || r.status === activeFilter);

  const today = useMemo(() => new Date().toLocaleDateString("pt-BR"), []);
  
  const romaneiosHoje = allRomaneios.filter(r => r.departure === today).length;
  const emCarregamento = allRomaneios.filter(r => r.status === "Aberto").length;
  const expedidosHoje = allRomaneios.filter(r => r.status === "Expedido" && r.departure === today).length;
  const totalExpedidos = allRomaneios.filter(r => r.status === "Expedido").length;

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
      label: "Expedidos hoje",
      value: expedidosHoje.toString(),
      delta: "",
      deltaColor: "#10B981",
      iconEl: <CheckCircle2 className="w-5 h-5" />,
      iconBg: "rgba(139,92,246,0.14)",
      iconColor: "#8B5CF6",
    },
    {
      label: "Total Expedidos",
      value: totalExpedidos.toString(),
      delta: "",
      deltaColor: "#8695AD",
      iconEl: <Layers3 className="w-5 h-5" />,
      iconBg: "rgba(148,163,184,0.14)",
      iconColor: "#94A3B8",
    },
  ];

  const filterDefs = [
    { label: "Todos", count: allRomaneios.length },
    { label: "Aberto", count: allRomaneios.filter(r => r.status === "Aberto").length },
    { label: "Expedido", count: allRomaneios.filter(r => r.status === "Expedido").length },
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

      {/* Romaneios Grid or Empty State */}
      {filteredRomaneios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-[18px]">
          {filteredRomaneios.map((r, i) => (
            <RomaneioCard key={i} romaneio={r} onClick={() => setSelectedRomaneio(r)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 dark:border-slate-800/80 bg-white/40 dark:bg-[#101B30]/40 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
            <PackageX className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Nenhum romaneio encontrado
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Os romaneios serão criados automaticamente conforme as DANFEs forem conferidas no fluxo de expedição.
          </p>
        </div>
      )}

      {selectedRomaneio && (
        <RomaneioDrawer
          romaneio={selectedRomaneio}
          onClose={() => setSelectedRomaneio(null)}
        />
      )}
    </>
  );
}
