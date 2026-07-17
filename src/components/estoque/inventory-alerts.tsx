/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ShieldAlert } from "lucide-react";

export function InventoryAlerts({ t, alerts }: { t: any; alerts: any[] }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div style={{ marginTop: "24px", borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, overflow: "hidden", scrollMarginTop: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
        <span style={{ width: "34px", height: "34px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245,158,11,0.14)", color: "#F59E0B" }}>
          <ShieldAlert size={18} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "15.5px", fontWeight: 700, color: t.text }}>Alertas de vencimento</span>
          <span style={{ fontSize: "12.5px", color: t.textSub }}>Lotes com validade próxima ou vencidos — priorize a saída (FEFO).</span>
        </div>
        <div style={{ flex: 1 }}></div>
        <span style={{ fontSize: "13px", color: t.textSub }}>{alerts.length} lotes</span>
      </div>
      <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {alerts.map((e, i) => {
          // Parse how many days left
          const diffTime = new Date(e.validade).getTime() - new Date().getTime();
          const daysNum = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isExpired = daysNum < 0;
          const displayDays = Math.abs(daysNum);
          
          const eBorder = isExpired ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)";
          const rowBg = isExpired ? "rgba(239,68,68,0.03)" : "rgba(245,158,11,0.03)";
          const badgeBg = isExpired ? "#EF4444" : "#F59E0B";
          const badgeColor = "#fff";
          const tagBg = isExpired ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)";
          const tagColor = isExpired ? "#EF4444" : "#F59E0B";
          const tagLabel = isExpired ? "Vencido" : "Crítico";

          return (
            <div key={e.id || i} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "13px 16px", borderRadius: "12px", border: `1px solid ${eBorder}`, background: rowBg }}>
              <span style={{ width: "44px", height: "44px", flexShrink: 0, borderRadius: "11px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: badgeBg, color: badgeColor }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "15px", fontWeight: 700, lineHeight: 1 }}>{displayDays}</span>
                <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.05em" }}>DIAS</span>
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: "14px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: t.text }}>{e.productName || e.sku}</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "12px", color: t.textSub }}>{e.sku} · Lote {e.lote} · {e.endereco}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: t.text }}>{e.saldo || "0"}</span>
                <span style={{ fontSize: "11.5px", color: t.textSub }}>vence {new Date(e.validade).toLocaleDateString()}</span>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: tagBg, color: tagColor }}>
                {tagLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
