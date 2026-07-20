/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Package, TrendingUp, Bell, Layers } from "lucide-react";

export function InventoryKpis({ t, stats }: { t: any; stats: any[] }) {
  // Map the stats from the backend to the UI layout
  const kpis = [
    {
      label: stats[0]?.label || "Saldo total",
      value: stats[0]?.value || "0",
      delta: "", 
      deltaColor: t.textSub,
      iconEl: <Package size={18} />,
      iconBg: "rgba(59,130,246,0.14)",
      iconColor: "#3B82F6",
      border: t.border,
      hoverBorder: t.border,
      cursor: "default",
      onClick: undefined,
    },
    {
      label: stats[1]?.label || "Reservado",
      value: stats[1]?.value || "0",
      delta: "",
      deltaColor: t.textSub,
      iconEl: <TrendingUp size={18} />,
      iconBg: "rgba(245,158,11,0.14)",
      iconColor: "#F59E0B",
      border: t.border,
      hoverBorder: t.border,
      cursor: "default",
      onClick: undefined,
    },
    {
      label: stats[2]?.label || "A vencer (30d)",
      value: stats[2]?.value || "0 lotes",
      delta: stats[2]?.help || "ver",
      deltaColor: "#F59E0B",
      iconEl: <Bell size={18} />,
      iconBg: "rgba(139,92,246,0.14)",
      iconColor: "#8B5CF6",
      border: t.border,
      hoverBorder: "#8B5CF6",
      cursor: "pointer",
      onClick: () => {
        document.getElementById("inventory-alerts")?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      label: stats[3]?.label || "Acuracidade",
      value: stats[3]?.value || "99,2%", 
      delta: stats[3]?.help || "▲ 0,3%",
      deltaColor: "#10B981",
      iconEl: <Layers size={18} />,
      iconBg: "rgba(16,185,129,0.14)",
      iconColor: "#10B981",
      border: t.border,
      hoverBorder: t.border,
      cursor: "default",
      onClick: undefined,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
      {kpis.map((k, idx) => (
        <div
          key={idx}
          style={{
            padding: "20px",
            borderRadius: "16px",
            border: `1px solid ${k.border}`,
            background: t.cardBg,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            cursor: k.cursor,
            transition: "all 0.18s ease",
          }}
          onClick={k.onClick}
          onMouseEnter={(e) => {
            if (k.hoverBorder) e.currentTarget.style.borderColor = k.hoverBorder;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = k.border;
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: t.textSub }}>{k.label}</span>
            <span
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: k.iconBg,
                color: k.iconColor,
              }}
            >
              {k.iconEl}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "30px", fontWeight: 700 }}>
              {k.value}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: k.deltaColor }}>{k.delta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
