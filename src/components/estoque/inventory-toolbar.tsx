/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

export function InventoryToolbar({ t, data }: { t: any; data: any }) {
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [cat, setCat] = useState("");

  const hasActiveFilter = q || owner || cat;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            height: "44px",
            flex: 1,
            minWidth: "240px",
            padding: "0 16px",
            borderRadius: "11px",
            border: `1.5px solid ${t.border}`,
            background: t.inputBg,
            transition: "all 0.2s ease",
          }}
        >
          <Search size={16} color={t.textSub} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por produto ou SKU nesta lista..."
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: t.text,
              fontFamily: "'Manrope', sans-serif",
              fontSize: "14px",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "44px",
            padding: "0 14px",
            borderRadius: "11px",
            border: `1.5px solid ${t.border}`,
            background: t.inputBg,
            minWidth: "180px",
          }}
        >
          <span style={{ fontSize: "13px", color: t.textSub, marginRight: "8px" }}>Depositante</span>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: t.text,
              fontFamily: "'Manrope', sans-serif",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              appearance: "none",
            }}
          >
            <option value="">Todos</option>
            {data.depositanteOptions.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
          <span style={{ color: t.textSub, fontSize: "11px", pointerEvents: "none" }}>▾</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "44px",
            padding: "0 14px",
            borderRadius: "11px",
            border: `1.5px solid ${t.border}`,
            background: t.inputBg,
            minWidth: "150px",
          }}
        >
          <span style={{ fontSize: "13px", color: t.textSub, marginRight: "8px" }}>Área</span>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: t.text,
              fontFamily: "'Manrope', sans-serif",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              appearance: "none",
            }}
          >
            <option value="">Todas</option>
            {data.enderecosInventario.map((o: any) => (
              <option key={o.id} value={o.area}>
                {o.area}
              </option>
            ))}
          </select>
          <span style={{ color: t.textSub, fontSize: "11px", pointerEvents: "none" }}>▾</span>
        </div>

        {hasActiveFilter && (
          <button
            onClick={() => {
              setQ("");
              setOwner("");
              setCat("");
            }}
            style={{
              height: "44px",
              padding: "0 16px",
              borderRadius: "11px",
              border: `1px solid ${t.border}`,
              background: "transparent",
              color: t.textSub,
              fontFamily: "'Manrope', sans-serif",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <X size={14} /> Limpar
          </button>
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
