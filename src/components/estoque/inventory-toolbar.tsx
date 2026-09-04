/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Search, X } from "lucide-react";

function formatAreaLabel(area: string) {
  return area
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

const FAIXA_PILLS = [
  { key: "all", label: "Todos" },
  { key: "ideal", label: "Dentro da faixa" },
  { key: "baixo", label: "Abaixo do mínimo" },
  { key: "critico", label: "Ruptura crítica" },
];

export function InventoryToolbar({
  t,
  data,
  q,
  setQ,
  owner,
  setOwner,
  cat,
  setCat,
  faixaSel,
  setFaixaSel,
  faixaCounts,
}: {
  t: any;
  data: any;
  q: string;
  setQ: (v: string) => void;
  owner: string;
  setOwner: (v: string) => void;
  cat: string;
  setCat: (v: string) => void;
  faixaSel: string;
  setFaixaSel: (v: string) => void;
  faixaCounts: { all: number; ideal: number; baixo: number; critico: number };
}) {
  const hasActiveFilters = Boolean(q || owner || cat);
  const depositanteOptions = data.depositanteOptions || [];
  const areaOptions = Array.from(new Set((data.enderecosInventario || []).map((e: any) => e.area).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col gap-3">
      {/* faixa pills — pílula com contador em chip próprio (padrão Infinoos Help) */}
      <div className="flex items-center justify-center gap-2.5 flex-wrap">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-full border p-1" style={{ borderColor: t.border, background: t.cardBg }}>
          {FAIXA_PILLS.map((p) => {
            const isActive = faixaSel === p.key;
            const count = (faixaCounts as any)[p.key] ?? 0;
            return (
              <button
                key={p.key}
                onClick={() => setFaixaSel(p.key)}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border-none py-1.5 pl-3.5 pr-2.5 text-[12.5px] font-semibold cursor-pointer transition"
                style={isActive ? { background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff" } : { background: "transparent", color: t.textSub }}
              >
                <span>{p.label}</span>
                <span
                  className="grid h-[19px] min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold leading-none"
                  style={isActive ? { background: "rgba(255,255,255,0.24)", color: "#fff" } : { background: t.inputBg, color: t.textSub }}
                >
                  {count}
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
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar SKU, produto..."
            className="flex-1 border-none outline-none bg-transparent text-[14px]"
            style={{ color: t.text }}
          />
        </div>
        {depositanteOptions.length > 1 && (
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="h-[42px] px-3 rounded-[11px] border text-[13.5px] font-semibold cursor-pointer"
            style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
          >
            <option value="">Todos depositantes</option>
            {depositanteOptions.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        )}
        {areaOptions.length > 0 && (
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="h-[42px] px-3 rounded-[11px] border text-[13.5px] font-semibold cursor-pointer"
            style={{ borderColor: t.border, background: t.cardBg, color: t.text }}
          >
            <option value="">Todas áreas</option>
            {areaOptions.map((a) => (
              <option key={a} value={a}>
                {formatAreaLabel(a)}
              </option>
            ))}
          </select>
        )}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setQ("");
              setOwner("");
              setCat("");
            }}
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
    </div>
  );
}
