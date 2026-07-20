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
}: {
  t: any;
  data: any;
  q: string;
  setQ: (v: string) => void;
  owner: string;
  setOwner: (v: string) => void;
  cat: string;
  setCat: (v: string) => void;
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        
        <label className="space-y-1.5 flex-[0.8] min-w-[180px]">
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

        <div className="flex-[1.2] min-w-[220px]">
          <FancySelectInput
            label="Depositante"
            name="owner"
            value={owner}
            onChange={setOwner}
            options={depositanteOptions}
          />
        </div>

        <div className="flex-[1.2] min-w-[200px]">
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
        {/* Chips for active filters if any, or static status filters */}
        <button style={{ height: "36px", padding: "0 15px", borderRadius: "9px", fontFamily: "'Manrope', sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, transition: "all 0.18s ease", display: "flex", alignItems: "center", gap: "8px" }}>
          Todos os status
        </button>
        <button style={{ height: "36px", padding: "0 15px", borderRadius: "9px", fontFamily: "'Manrope', sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, transition: "all 0.18s ease", display: "flex", alignItems: "center", gap: "8px" }}>
          Com saldo <span style={{ padding: "1px 8px", borderRadius: "999px", fontSize: "11px", background: "rgba(59,130,246,0.14)", color: "#3B82F6" }}>{data.stockBalances.length}</span>
        </button>
      </div>
    </div>
  );
}
