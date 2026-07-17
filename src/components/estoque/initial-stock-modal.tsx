"use client";

import { useEffect, useState } from "react";
import { X, Download, Layers } from "lucide-react";

export function InitialStockModal({ t, onClose }: { t: any; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div 
        onClick={onClose} 
        style={{ position: "absolute", inset: 0, background: "rgba(11,17,32,0.65)", backdropFilter: "blur(4px)", animation: "overlayFade 0.25s ease" }}
      ></div>
      
      <div style={{ position: "relative", width: "100%", maxWidth: "560px", background: t.cardBg, borderRadius: "20px", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", overflow: "hidden", display: "flex", flexDirection: "column", animation: "modalScale 0.3s cubic-bezier(.175,.885,.32,1.1)" }}>
        
        {/* Header */}
        <div style={{ padding: "24px 28px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "flex-start", gap: "16px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(59,130,246,0.12)", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Download size={22} strokeWidth={2.5} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, paddingTop: "2px" }}>
            <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700, color: t.text }}>Lançar estoque inicial</h2>
            <p style={{ margin: 0, fontSize: "14px", color: t.textSub }}>Carga inicial de saldo para produtos recém-cadastrados.</p>
          </div>
          <button onClick={onClose} style={{ width: "36px", height: "36px", borderRadius: "10px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.textSub, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.textSub; }} onMouseLeave={(e) => { e.currentTarget.style.color = t.textSub; e.currentTarget.style.borderColor = t.border; }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "13.5px", fontWeight: 700, color: t.textSub }}>Produto / SKU <span style={{ color: "#EF4444" }}>*</span></label>
            <input 
              type="text" 
              placeholder="Buscar SKU sem saldo lançado..." 
              style={{ width: "100%", height: "48px", padding: "0 16px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.appBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14.5px", outline: "none", transition: "border-color 0.2s ease" }}
              onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
              onBlur={(e) => e.target.style.borderColor = t.border}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13.5px", fontWeight: 700, color: t.textSub }}>Quantidade <span style={{ color: "#EF4444" }}>*</span></label>
              <input 
                type="number" 
                placeholder="0" 
                style={{ width: "100%", height: "48px", padding: "0 16px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.appBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14.5px", outline: "none", transition: "border-color 0.2s ease" }}
                onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
                onBlur={(e) => e.target.style.borderColor = t.border}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13.5px", fontWeight: 700, color: t.textSub }}>Endereço destino <span style={{ color: "#EF4444" }}>*</span></label>
              <input 
                type="text" 
                placeholder="Ex: A-01-03-02" 
                style={{ width: "100%", height: "48px", padding: "0 16px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.appBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14.5px", outline: "none", transition: "border-color 0.2s ease" }}
                onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
                onBlur={(e) => e.target.style.borderColor = t.border}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13.5px", fontWeight: 700, color: t.textSub }}>Lote</label>
              <input 
                type="text" 
                placeholder="Opcional (se controlado)" 
                style={{ width: "100%", height: "48px", padding: "0 16px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.appBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14.5px", outline: "none", transition: "border-color 0.2s ease" }}
                onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
                onBlur={(e) => e.target.style.borderColor = t.border}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13.5px", fontWeight: 700, color: t.textSub }}>Validade</label>
              <input 
                type="text" 
                placeholder="dd/mm/aa" 
                style={{ width: "100%", height: "48px", padding: "0 16px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.appBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14.5px", outline: "none", transition: "border-color 0.2s ease" }}
                onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
                onBlur={(e) => e.target.style.borderColor = t.border}
              />
            </div>
          </div>

          <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.appBg }}>
            <div style={{ width: "36px", height: "36px", flexShrink: 0, borderRadius: "10px", background: "rgba(139,92,246,0.15)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={18} />
            </div>
            <span style={{ fontSize: "13.5px", lineHeight: 1.5, color: t.textSub }}>
              O lançamento inicial gera um movimento de entrada auditável e não altera o custo médio já apurado.
            </span>
          </div>
          
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 28px", borderTop: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", background: t.headBg }}>
          <button 
            onClick={onClose}
            style={{ height: "44px", padding: "0 24px", borderRadius: "12px", border: `1px solid ${t.border}`, background: t.cardBg, color: t.text, fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.rowHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = t.cardBg; }}
          >
            Cancelar
          </button>
          <button 
            style={{ height: "44px", padding: "0 24px", borderRadius: "12px", border: "none", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontFamily: "'Manrope', sans-serif", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 22px rgba(99,102,241,0.32)", transition: "all 0.2s ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(99,102,241,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(99,102,241,0.32)"; }}
          >
            Lançar entrada
          </button>
        </div>

      </div>
    </div>
  );
}
