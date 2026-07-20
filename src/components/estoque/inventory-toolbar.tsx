/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Search, X } from "lucide-react";
import { FancySelectInput } from "@/components/ui/fancy-select-input";

export function InventoryToolbar({
  t,
  data,
  q,
  setQ,
  owner,
  setOwner,
  cat,
  setCat,
  statusFilter,
  setStatusFilter,
  countComSaldo,
  countAVencer,
  countBloqueado,
}: {
  t: any;
  data: any;
  q: string;
  setQ: (v: string) => void;
  owner: string;
  setOwner: (v: string) => void;
  cat: string;
  setCat: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  countComSaldo: number;
  countAVencer: number;
  countBloqueado: number;
}) {
  const hasActiveFilter = q || owner || cat;

  const depositanteOptions = [
    { value: "", label: "Todos" },
    ...(data.depositanteOptions || []).map((o: any) => ({
      value: o.id,
      label: o.nome,
    })),
  ];

  const areaOptions = [
    { value: "", label: "Todas" },
    ...(data.enderecosInventario || []).map((o: any) => ({
      value: o.area,
      label: o.area,
    })),
  ];

  const statusOptions = [
    { id: "todos", label: "Todos os status" },
    ...(countComSaldo > 0 ? [{ id: "com_saldo", label: "Com saldo", count: countComSaldo, color: "#3B82F6", bg: "rgba(59,130,246,0.14)" }] : []),
    ...(countAVencer > 0 ? [{ id: "a_vencer", label: "A vencer", count: countAVencer, color: "#F59E0B", bg: "rgba(245,158,11,0.14)" }] : []),
    ...(countBloqueado > 0 ? [{ id: "bloqueado", label: "Bloqueado", count: countBloqueado, color: "#EF4444", bg: "rgba(239,68,68,0.14)" }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        
        <label className="space-y-1.5 flex-1 min-w-[220px]">
          <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Busca rápida
          </span>
          <div className="flex h-[52px] items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 dark:bg-slate-950/50 px-3 transition-colors focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 dark:border-slate-800">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar nesta lista..."
              className="w-full border-0 bg-transparent text-[14px] font-medium outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
          </div>
        </label>

        <div className="flex-1 min-w-[200px]">
          <FancySelectInput
            label="Depositante"
            name="owner"
            value={owner}
            onChange={setOwner}
            options={depositanteOptions}
          />
        </div>

        <div className="flex-1 min-w-[180px]">
          <FancySelectInput
            label="Área"
            name="area"
            value={cat}
            onChange={setCat}
            options={areaOptions}
          />
        </div>

        {hasActiveFilter && (
          <div className="flex items-end gap-2 pb-[1px]">
            <button
              onClick={() => {
                setQ("");
                setOwner("");
                setCat("");
              }}
              style={{
                height: "52px",
                padding: "0 16px",
                borderRadius: "16px",
                border: `1px solid ${t.border}`,
                background: "transparent",
                color: t.textSub,
                fontFamily: "'Manrope', sans-serif",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = t.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = t.textSub)}
            >
              <X size={16} /> Limpar
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {statusOptions.map((opt) => {
          const isActive = statusFilter === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setStatusFilter(opt.id)}
              style={{
                height: "36px",
                padding: "0 15px",
                borderRadius: "9px",
                fontFamily: "'Manrope', sans-serif",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                border: isActive ? "none" : `1px solid ${t.border}`,
                background: isActive ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : "transparent",
                color: isActive ? "#fff" : t.textSub,
                transition: "all 0.18s ease",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {opt.label}
              {"count" in opt && opt.count !== undefined && (
                <span
                  style={{
                    padding: "1px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    background: isActive ? "rgba(255,255,255,0.2)" : opt.bg,
                    color: isActive ? "#fff" : opt.color,
                  }}
                >
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
