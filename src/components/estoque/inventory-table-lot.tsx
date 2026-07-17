/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";

export function InventoryTableLot({ t, balances }: { t: any; balances: any[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(balances.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = balances.slice(startIndex, startIndex + itemsPerPage);

  const lotColumns = ["LOTE", "PRODUTO & SKU", "QTD", "LOCAL", "FABRICAÇÃO", "VENCIMENTO", "VIDA ÚTIL (%)"];

  return (
    <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, overflow: "hidden", marginBottom: "24px" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "940px" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {lotColumns.map((c, i) => (
                <th key={i} style={{ padding: "13px 20px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: t.textSub, background: t.headBg, borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentItems.map((l, i) => {
              const expColor = l.validade ? (new Date(l.validade) < new Date() ? "#EF4444" : "#F59E0B") : t.text;
              const expiry = l.validade ? new Date(l.validade).toLocaleDateString() : "—";
              const manuf = "—"; // Not provided by default backend yet
              const lifeW = l.validade ? "60%" : "100%"; // Mock calc for now
              const lifeFill = l.validade ? (new Date(l.validade) < new Date() ? "#EF4444" : "linear-gradient(90deg, #F59E0B, #10B981)") : "#10B981";
              const days = l.validade ? "60d" : "—";

              return (
                <tr key={l.id || i} style={{ borderBottom: `1px solid ${t.border}`, transition: "background 0.15s ease" }} onMouseEnter={(e) => (e.currentTarget.style.background = t.rowHover)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "14px", color: t.text }}>{l.lote || "N/A"}</span>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px", color: t.text }}>{l.productName || l.sku}</span>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "11.5px", color: t.textSub }}>{l.sku}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 20px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: t.text }}>{l.saldo || "0"}</td>
                  <td style={{ padding: "14px 20px", fontSize: "13.5px", color: t.textSub }}>{l.endereco}</td>
                  <td style={{ padding: "14px 20px", fontSize: "13.5px", color: t.text }}>{manuf}</td>
                  <td style={{ padding: "14px 20px", fontSize: "13.5px", fontWeight: 700, color: expColor }}>{expiry}</td>
                  <td style={{ padding: "14px 20px", minWidth: "150px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ flex: 1, height: "6px", borderRadius: "999px", background: t.barTrack, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: lifeW, borderRadius: "999px", background: lifeFill, transformOrigin: "left" }}></div>
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 700, width: "46px", textAlign: "right", color: expColor }}>{days}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: `1px solid ${t.border}`, flexWrap: "wrap", gap: "12px" }}>
        <span style={{ fontSize: "13px", color: t.textSub }}>
          Mostrando {balances.length > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + itemsPerPage, balances.length)} de {balances.length} lotes
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: currentPage === 1 ? t.border : t.textSub, cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: "13px" }}
          >‹</button>
          
          <button style={{ width: "34px", height: "34px", borderRadius: "8px", border: "none", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", cursor: "default", fontSize: "13px", fontWeight: 700 }}>
            {currentPage}
          </button>
          
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: currentPage === totalPages ? t.border : t.textSub, cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: "13px" }}
          >›</button>
        </div>
      </div>
    </div>
  );
}
