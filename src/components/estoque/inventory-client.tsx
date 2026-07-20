/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { InventoryKpis } from "./inventory-kpis";
import { InventoryToolbar } from "./inventory-toolbar";
import { InventoryTableSku } from "./inventory-table-sku";
import { InventoryTableLot } from "./inventory-table-lot";
import { InventoryAlerts } from "./inventory-alerts";
import { InventoryDetailDrawer } from "./inventory-detail-drawer";
import { InitialStockModal } from "./initial-stock-modal";

export function InventoryClient({ data }: { data: any }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [isBySku, setIsBySku] = useState(true);
  const [selectedSku, setSelectedSku] = useState<any>(null);
  const [showInitial, setShowInitial] = useState(false);
  
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [cat, setCat] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  // Base themes to match the exact HTML visual prototype
  const t = {
    appBg: isDark ? "#0B1120" : "#F8FAFC",
    border: isDark ? "rgba(255,255,255,0.1)" : "#E2E8F0",
    text: isDark ? "#F8FAFC" : "#0F172A",
    textSub: isDark ? "#94A3B8" : "#64748B",
    cardBg: isDark ? "#0F172A" : "#FFFFFF",
    inputBg: isDark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
    headBg: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC",
    rowHover: isDark ? "rgba(255,255,255,0.03)" : "#F1F5F9",
    barTrack: isDark ? "rgba(255,255,255,0.05)" : "#E2E8F0",
    drawerBg: isDark ? "rgba(15,23,42,0.98)" : "#FFFFFF",
    softBg: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9",
    textFaint: isDark ? "#475569" : "#CBD5E1",
  };

  const countComSaldo = (data.stockBalances || []).filter((b: any) => b.rawQuantidade > 0).length;
  const countBloqueado = (data.stockBalances || []).filter((b: any) => b.status === "Bloqueado").length;
  const countEstoqueBaixo = (data.stockBalances || []).filter((b: any) => b.rawQuantidade > 0 && b.rawQuantidade <= (b.minQuantity || 0)).length;
  const countAVencer = (data.stockBalances || []).filter((b: any) => {
    if (b.validade === "-") return false;
    const [day, month, year] = b.validade.split("/");
    const expiryDate = new Date(`${year}-${month}-${day}T00:00:00`);
    const diffTime = expiryDate.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  }).length;

  const filteredBalances = (data.stockBalances || []).filter((b: any) => {
    if (owner && b.depositanteId !== owner) return false;
    if (cat && b.area !== cat) return false;
    if (q) {
      const search = q.toLowerCase();
      if (!b.sku?.toLowerCase().includes(search) && !b.productName?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (statusFilter === "com_saldo" && b.rawQuantidade <= 0) return false;
    if (statusFilter === "estoque_baixo" && (b.rawQuantidade <= 0 || b.rawQuantidade > (b.minQuantity || 0))) return false;
    if (statusFilter === "bloqueado" && b.status !== "Bloqueado") return false;
    if (statusFilter === "a_vencer") {
      if (b.validade === "-") return false;
      const [day, month, year] = b.validade.split("/");
      const expiryDate = new Date(`${year}-${month}-${day}T00:00:00`);
      const diffTime = expiryDate.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 30) return false;
    }
    return true;
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px 40px 32px", display: "flex", flexDirection: "column" }}>
      {/* title row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "20px", flexWrap: "wrap", marginBottom: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: t.textSub }}>
            <span>WMS</span>
            <span>›</span>
            <span style={{ color: t.text, fontWeight: 600 }}>Estoque</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: 700 }}>Posição de estoque</h1>
          <p style={{ margin: 0, fontSize: "14.5px", color: t.textSub }}>Saldo por SKU e lote, reservas, disponibilidade e validade.</p>
        </div>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", padding: "4px", gap: "4px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.inputBg }}>
            <button 
              onClick={() => setIsBySku(true)}
              style={{ height: "36px", padding: "0 16px", border: "none", borderRadius: "9px", fontFamily: "'Manrope', sans-serif", fontSize: "13.5px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", background: isBySku ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : "transparent", color: isBySku ? "#fff" : t.textSub, transition: "all 0.2s ease" }}
            >
              ☰ Por SKU
            </button>
            <button 
              onClick={() => setIsBySku(false)}
              style={{ height: "36px", padding: "0 16px", border: "none", borderRadius: "9px", fontFamily: "'Manrope', sans-serif", fontSize: "13.5px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", background: !isBySku ? "linear-gradient(92deg, #3B82F6, #8B5CF6)" : "transparent", color: !isBySku ? "#fff" : t.textSub, transition: "all 0.2s ease" }}
            >
              ⬚ Por Lote
            </button>
          </div>
          
          <button 
            onClick={() => setShowInitial(true)}
            style={{ height: "44px", padding: "0 18px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s ease" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
          >
            <span style={{ color: "#3B82F6", display: "flex" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            </span>
            Estoque inicial
          </button>
          
          <button style={{ height: "44px", padding: "0 20px", border: "none", borderRadius: "11px", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 22px rgba(99,102,241,0.32)", display: "flex", alignItems: "center", gap: "8px" }}>
            ⇄ Ajuste de estoque
          </button>
        </div>
      </div>

      <InventoryKpis t={t} stats={data.stockStatsCards} />
      <InventoryToolbar 
        t={t} 
        data={data} 
        q={q} 
        setQ={setQ} 
        owner={owner} 
        setOwner={setOwner} 
        cat={cat} 
        setCat={setCat} 
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        countComSaldo={countComSaldo}
        countEstoqueBaixo={countEstoqueBaixo}
        countAVencer={countAVencer}
        countBloqueado={countBloqueado}
      />

      {isBySku ? (
        <InventoryTableSku t={t} balances={filteredBalances} onSelectSku={setSelectedSku} />
      ) : (
        <InventoryTableLot t={t} balances={filteredBalances} />
      )}

      <InventoryAlerts t={t} alerts={data.stockExpiryAlerts} />

      {selectedSku && (
        <InventoryDetailDrawer
          t={t}
          sku={selectedSku}
          onClose={() => setSelectedSku(null)}
        />
      )}

      {showInitial && (
        <InitialStockModal 
          t={t} 
          onClose={() => setShowInitial(false)} 
          produtos={data.produtosInventario || []} 
          enderecos={data.enderecosInventario || []} 
        />
      )}
    </div>
  );
}
