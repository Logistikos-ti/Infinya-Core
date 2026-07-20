/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { PackageOpen, X } from "lucide-react";
import { useEffect, useState } from "react";

export function InventoryDetailDrawer({ t, sku, movements = [], onClose }: { t: any; sku: any; movements?: any[]; onClose: () => void }) {
  const [barWidth, setBarWidth] = useState("0%");
  
  const total = sku.saldo || "0";
  const reserved = sku.status === "Reservado" ? total : "0";
  const available = sku.status === "Disponível" ? total : "0";
  const availColor = available !== "0" ? "#10B981" : t.textSub;

  const skuMovements = movements.filter((m) => m.sku === sku.sku).slice(0, 5);

  const min = sku.minQuantity || 10;
  const max = 500; // Mock max
  const numericTotal = Number(total.replace(/\./g, '').replace(',', '.'));
  const pct = Math.min(100, Math.round((numericTotal / max) * 100));

  useEffect(() => {
    const timer = setTimeout(() => {
      setBarWidth(`${pct}%`);
    }, 50);
    return () => clearTimeout(timer);
  }, [pct]);

  const formatType = (type: string) => {
    if (type.includes("ENTRADA")) return "Entrada de estoque";
    if (type.includes("SAIDA")) return "Saída de estoque";
    if (type.includes("RESERVA")) return "Reserva de estoque";
    if (type.includes("AJUSTE") || type.includes("INVENTARIO")) return "Ajuste de inventário";
    return type;
  };

  const getColors = (type: string) => {
    if (type.includes("ENTRADA")) return { dot: "#10B981", halo: "rgba(16,185,129,0.2)", qtyColor: "#10B981", sign: "+" };
    if (type.includes("SAIDA")) return { dot: "#EF4444", halo: "rgba(239,68,68,0.2)", qtyColor: "#EF4444", sign: "-" };
    if (type.includes("RESERVA")) return { dot: "#F59E0B", halo: "rgba(245,158,11,0.2)", qtyColor: "#F59E0B", sign: "-" };
    return { dot: t.textSub, halo: "transparent", qtyColor: "#10B981", sign: "+" };
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div 
        onClick={onClose} 
        style={{ position: "absolute", inset: 0, background: "rgba(6,10,20,0.55)", backdropFilter: "blur(3px)", animation: "overlayFade 0.25s ease" }}
      ></div>
      <div style={{ position: "relative", width: "460px", maxWidth: "92vw", height: "100%", background: t.drawerBg, borderLeft: `1px solid ${t.border}`, boxShadow: "-24px 0 60px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column", animation: "drawerIn 0.32s cubic-bezier(.3,1,.4,1)", overflow: "hidden" }}>

        <div style={{ position: "relative", height: "150px", flexShrink: 0, background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.14, backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 12px)" }}></div>
          <span style={{ position: "relative", color: "rgba(255,255,255,0.95)", display: "flex" }}>
            <PackageOpen size={48} />
          </span>
          <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", width: "36px", height: "36px", borderRadius: "10px", border: "none", background: "rgba(0,0,0,0.32)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}>
            <X size={18} />
          </button>
          <span style={{ position: "absolute", bottom: "14px", left: "20px", padding: "4px 11px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 700, background: "rgba(0,0,0,0.3)", color: "#fff", backdropFilter: "blur(4px)" }}>
            {sku.depositante || "Depositante"}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "20px" }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "21px", fontWeight: 700, lineHeight: 1.2, textWrap: "pretty", color: t.text }}>
              {sku.productName || sku.sku}
            </span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: t.textSub }}>{sku.sku}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <div style={{ padding: "16px", borderRadius: "14px", border: `1px solid ${t.border}`, background: t.cardBg, display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11.5px", color: t.textSub }}>Físico</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700, color: t.text }}>{total}</span>
            </div>
            <div style={{ padding: "16px", borderRadius: "14px", border: `1px solid ${t.border}`, background: t.cardBg, display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11.5px", color: t.textSub }}>Reservado</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700, color: "#F59E0B" }}>{reserved}</span>
            </div>
            <div style={{ padding: "16px", borderRadius: "14px", border: `1px solid ${t.border}`, background: t.cardBg, display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11.5px", color: t.textSub }}>Disponível</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700, color: availColor }}>{available}</span>
            </div>
          </div>

          <div style={{ marginBottom: "22px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
              <span style={{ color: t.textSub }}>Nível de estoque</span>
              <span style={{ fontWeight: 700, color: t.text }}>mín {min} · máx {max}</span>
            </div>
            <div style={{ position: "relative", height: "10px", borderRadius: "999px", background: t.barTrack, overflow: "hidden" }}>
              <div style={{ height: "100%", width: barWidth, borderRadius: "999px", background: "linear-gradient(90deg, #3B82F6, #8B5CF6)", transformOrigin: "left", transition: "width 0.8s ease-out" }}></div>
            </div>
          </div>

          <div style={{ marginBottom: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: t.text }}>Distribuição por endereço</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.cardBg }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13.5px", fontWeight: 700, flexBasis: "auto", maxWidth: "140px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: t.text }} title={sku.endereco || "N/A"}>{sku.endereco || "N/A"}</span>
                <div style={{ flex: 1, height: "6px", borderRadius: "999px", background: t.barTrack, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: barWidth, borderRadius: "999px", background: "linear-gradient(90deg,#3B82F6,#8B5CF6)", transition: "width 0.8s ease-out" }}></div>
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, width: "60px", textAlign: "right", color: t.text }}>{total}</span>
              </div>
            </div>
          </div>
          
          {sku.validade && (
            <div style={{ marginBottom: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: t.text }}>Lotes ativos (FEFO)</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.cardBg }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: "#10B981" }}></span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 700, color: t.text }}>{sku.lote || "N/A"}</span>
                    <span style={{ fontSize: "11.5px", color: t.textSub }}>Vence {sku.validade}</span>
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#10B981" }}>{total}</span>
                </div>
              </div>
            </div>
          )}

          {skuMovements.length > 0 && (
            <div style={{ marginBottom: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: t.text }}>Últimas movimentações</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {skuMovements.map((m, i) => {
                  const colors = getColors(m.type);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.cardBg }}>
                      <div style={{ width: "32px", height: "32px", flexShrink: 0, borderRadius: "50%", background: colors.halo, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: colors.dot }}></span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 700, color: t.text }}>{formatType(m.type)}</span>
                        <span style={{ fontSize: "11.5px", color: t.textSub }}>{new Date(m.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13.5px", fontWeight: 700, color: colors.qtyColor }}>{colors.sign}{m.quantity}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
