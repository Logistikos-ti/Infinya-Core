/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { PackageOpen, X, ArrowRightLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { StockTransferQuickModal } from "./stock-transfer-quick-modal";
import { StockAdjustmentModal } from "./stock-adjustment-modal";
import { StockInventoryModal } from "./stock-inventory-modal";

export function InventoryDetailDrawer({ t, sku, allBalances = [], allAddresses = [], movements = [], onClose }: { t: any; sku: any; allBalances?: any[]; allAddresses?: any[]; movements?: any[]; onClose: () => void }) {
  const [barWidth, setBarWidth] = useState("0%");
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  
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
          {sku.imageUrl ? (
            <img src={sku.imageUrl} alt={sku.sku} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ position: "relative", color: "rgba(255,255,255,0.95)", display: "flex" }}>
              <PackageOpen size={48} />
            </span>
          )}
          <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", width: "36px", height: "36px", borderRadius: "10px", border: "none", background: "rgba(0,0,0,0.32)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}>
            <X size={18} />
          </button>
          <span style={{ position: "absolute", bottom: "14px", left: "20px", padding: "4px 11px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 700, background: "rgba(0,0,0,0.3)", color: "#fff", backdropFilter: "blur(4px)" }}>
            {sku.depositante || "Depositante"}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "21px", fontWeight: 700, lineHeight: 1.2, textWrap: "pretty", color: t.text }}>
                {sku.productName || sku.sku}
              </span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: t.textSub }}>{sku.sku}</span>
            </div>
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
              {skuBalances
                .filter(b => b.rawQuantidade > 0)
                .reduce((acc, curr) => {
                  const existing = acc.find((e: any) => e.endereco === curr.endereco);
                  if (existing) {
                    existing.rawQuantidade += curr.rawQuantidade;
                  } else {
                    acc.push({ ...curr });
                  }
                  return acc;
                }, [])
                .map((b: any, i: number) => {
                  const percentage = totalNum > 0 ? (b.rawQuantidade / totalNum) * 100 : 0;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.cardBg }}>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13.5px", fontWeight: 700, flexBasis: "auto", maxWidth: "140px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: t.text }} title={b.endereco || "N/A"}>{b.endereco || "N/A"}</span>
                      <div style={{ flex: 1, height: "6px", borderRadius: "999px", background: t.barTrack, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${percentage}%`, borderRadius: "999px", background: "linear-gradient(90deg,#3B82F6,#8B5CF6)", transition: "width 0.8s ease-out" }}></div>
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 700, width: "60px", textAlign: "right", color: t.text }}>{b.rawQuantidade.toLocaleString("pt-BR")}</span>
                    </div>
                  );
                })
              }
            </div>
          </div>
          
          {skuBalances.some((b) => b.validade && b.validade !== "-") && (
            <div style={{ marginBottom: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: t.text }}>Lotes ativos (FEFO)</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {skuBalances
                  .filter((b) => b.rawQuantidade > 0)
                  .sort((a, b) => {
                    const aDate = a.validade === "-" ? 9999999999999 : new Date(a.validade.split("/").reverse().join("-")).getTime();
                    const bDate = b.validade === "-" ? 9999999999999 : new Date(b.validade.split("/").reverse().join("-")).getTime();
                    return aDate - bDate;
                  })
                  .map((b) => (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderRadius: "11px", border: `1px solid ${t.border}`, background: t.cardBg }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: "#10B981" }}></span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 700, color: t.text }}>
                          {b.lote || "N/A"} <span style={{ color: t.textSub, fontWeight: 500, fontSize: "11.5px" }}>({b.endereco})</span>
                        </span>
                        <span style={{ fontSize: "11.5px", color: t.textSub }}>Vence {b.validade}</span>
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#10B981" }}>{b.saldo}</span>
                    </div>
                  ))}
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

        {/* Footer Actions */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${t.border}`, background: t.drawerBg, display: "flex", gap: "12px", zIndex: 10 }}>
          <button onClick={() => setShowAdjustment(true)} style={{ flex: 1, height: "46px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s ease" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3B82F6")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}>
            <ArrowRightLeft size={16} /> Ajustar
          </button>
          <button onClick={() => setShowTransfer(true)} style={{ flex: 1, height: "46px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "all 0.2s ease" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3B82F6")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}>
            <ArrowRight size={16} /> Transferir
          </button>
          <button onClick={() => setShowInventory(true)} style={{ flex: 1, height: "46px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }}>
            <RotateCcw size={16} /> Inventariar
          </button>
        </div>
      </div>

      {showTransfer && (
        <StockTransferQuickModal
          sku={sku}
          allBalances={allBalances}
          allAddresses={allAddresses}
          t={t}
          onClose={() => setShowTransfer(false)}
          onSuccess={() => {
            setShowTransfer(false);
            window.location.reload(); // Quick fix to refresh balances, ideal approach is to mutate parent state
          }}
        />
      )}

      {showAdjustment && (
        <StockAdjustmentModal
          sku={sku}
          allBalances={allBalances}
          t={t}
          onClose={() => setShowAdjustment(false)}
          onSuccess={() => {
            setShowAdjustment(false);
            window.location.reload();
          }}
        />
      )}

      {showInventory && (
        <StockInventoryModal
          sku={sku}
          allBalances={allBalances}
          t={t}
          onClose={() => setShowInventory(false)}
          onSuccess={() => {
            setShowInventory(false);
          }}
        />
      )}
    </div>
  );
}
