/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

export function InventoryKpis({ t, stats }: { t: any; stats: any[] }) {
  const emRupturaValue = Number(stats[3]?.value ?? 0);

  const kpis = [
    { label: stats[0]?.label || "Em estoque", value: stats[0]?.value || "0", color: t.text },
    { label: stats[1]?.label || "Reservado", value: stats[1]?.value || "0", color: "#F59E0B" },
    { label: stats[2]?.label || "Disponível", value: stats[2]?.value || "0", color: "#10B981" },
    { label: stats[3]?.label || "Em ruptura", value: stats[3]?.value || "0", color: emRupturaValue > 0 ? "#EF4444" : t.text },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "20px" }}>
      {kpis.map((k, idx) => (
        <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "20px", borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: t.textSub }}>{k.label}</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "30px", fontWeight: 700, color: k.color }}>{k.value}</span>
        </div>
      ))}
    </div>
  );
}
