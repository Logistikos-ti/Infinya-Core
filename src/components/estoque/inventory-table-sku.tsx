/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { PackageOpen } from "lucide-react";

export function InventoryTableSku({ t, balances, onSelectSku }: { t: any; balances: any[]; onSelectSku: (sku: any) => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(balances.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = balances.slice(startIndex, startIndex + itemsPerPage);

  const columns = ["PRODUTO & SKU", "DEPOSITANTE", "FÍSICO", "RESERVADO", "DISPONÍVEL", "LOCAIS", "VENCIMENTO", "STATUS"];

  return (
    <div style={{ borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, overflow: "hidden", marginBottom: "24px" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {columns.map((c, i) => (
                <th key={i} style={{ padding: "13px 20px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: t.textSub, background: t.headBg, borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentItems.map((r, i) => {
              // Parse saldo to number to show available/reserved if we don't have it explicit
              const total = r.saldo || "0";
              const reserved = r.status === "Reservado" ? total : "0";
              const available = r.status === "Disponível" ? total : "0";
              const availColor = available !== "0" ? "#10B981" : t.textSub;
              const statusBg = r.status === "Disponível" ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)";
              const statusColor = r.status === "Disponível" ? "#10B981" : "#F59E0B";
              let isExpired = false;
              if (r.validade && r.validade !== "-") {
                const [day, month, year] = r.validade.split("/");
                const expDate = new Date(`${year}-${month}-${day}T00:00:00`);
                isExpired = expDate.getTime() < new Date().getTime();
              }
              const expBg = r.validade && r.validade !== "-" ? (isExpired ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)") : "transparent";
              const expColor = r.validade && r.validade !== "-" ? (isExpired ? "#EF4444" : "#F59E0B") : t.textSub;
              const expLabel = r.validade && r.validade !== "-" ? r.validade : "-";
              
              return (
                <tr
                  key={r.id || i}
                  onClick={() => onSelectSku(r)}
                  style={{ borderBottom: `1px solid ${t.border}`, cursor: "pointer", transition: "background 0.15s ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = t.rowHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "13px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
                      <div style={{ width: "42px", height: "42px", flexShrink: 0, borderRadius: "10px", background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.92)", overflow: "hidden" }}>
                        {r.imageUrl ? (
                          <img src={r.imageUrl} alt={r.sku} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <PackageOpen size={20} />
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px", color: t.text }}>
                          {r.productName || r.sku}
                        </span>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "12px", color: t.textSub }}>{r.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "13px 20px", fontSize: "13.5px", color: t.textSub, maxWidth: "150px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.depositante || "-"}</td>
                  <td style={{ padding: "13px 20px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14.5px", fontWeight: 700, color: t.text }}>{total}</td>
                  <td style={{ padding: "13px 20px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", color: t.textSub }}>{reserved}</td>
                  <td style={{ padding: "13px 20px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14.5px", fontWeight: 700, color: availColor }}>{available}</td>
                  <td style={{ padding: "13px 20px", fontSize: "13.5px", color: t.textSub }}>{r.endereco || "1 local"}</td>
                  <td style={{ padding: "13px 20px" }}>
                    {r.validade ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 11px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: "rgba(16,185,129,0.14)", color: "#10B981" }}>{expLabel}</span>
                    ) : (
                      <span style={{ fontSize: "13px", color: t.textFaint }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "13px 20px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "5px 12px", borderRadius: "999px", fontSize: "12.5px", fontWeight: 700, background: statusBg, color: statusColor }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: statusColor }}></span>
                      {r.status || "Disponível"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: `1px solid ${t.border}`, flexWrap: "wrap", gap: "12px" }}>
        <span style={{ fontSize: "13px", color: t.textSub }}>
          Mostrando {balances.length > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + itemsPerPage, balances.length)} de {balances.length} SKUs
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: currentPage === 1 ? t.border : t.textSub, cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: "13px" }}
          >‹</button>
          
          {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
            // Logic to show pages around current page
            let pageNum = idx + 1;
            if (totalPages > 5 && currentPage > 3) {
              pageNum = currentPage - 2 + idx;
              if (pageNum > totalPages) pageNum = totalPages - (4 - idx);
            }
            
            const isActive = pageNum === currentPage;
            return (
              <button 
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                style={{ 
                  width: "34px", 
                  height: "34px", 
                  borderRadius: "8px", 
                  border: isActive ? "none" : `1px solid ${t.border}`, 
                  background: isActive ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : t.inputBg, 
                  color: isActive ? "#fff" : t.text, 
                  cursor: isActive ? "default" : "pointer", 
                  fontSize: "13px", 
                  fontWeight: isActive ? 700 : 500 
                }}
              >
                {pageNum}
              </button>
            );
          })}
          
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
