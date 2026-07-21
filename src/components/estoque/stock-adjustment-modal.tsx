"use client";

import { useState } from "react";
import { X, ArrowRightLeft, Loader2 } from "lucide-react";
import { FancySelectInput } from "@/components/ui/fancy-select-input";

type StockAdjustmentModalProps = {
  sku: any;
  allBalances: any[];
  onClose: () => void;
  onSuccess: () => void;
  t: any;
};

export function StockAdjustmentModal({ sku, allBalances, onClose, onSuccess, t }: StockAdjustmentModalProps) {
  const [sourceStockId, setSourceStockId] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isNewLot, setIsNewLot] = useState(false);
  const [newLotAddress, setNewLotAddress] = useState("");
  const [newLotCode, setNewLotCode] = useState("");
  const [newLotValidade, setNewLotValidade] = useState("");

  const skuIdToFind = sku.productId || sku.sku;
  const skuBalances = allBalances.filter((b) => (b.productId || b.sku) === skuIdToFind);
  const selectedBalance = skuBalances.find((b) => b.id === sourceStockId);
  const currentQty = selectedBalance ? selectedBalance.rawQuantidade : 0;
  
  const quantityDiff = (selectedBalance || isNewLot) && newQuantity !== "" ? Number(newQuantity) - currentQty : 0;
  const isPositive = quantityDiff > 0;
  const isNegative = quantityDiff < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceStockId || newQuantity === "" || !reason) return;
    
    if (quantityDiff === 0) {
      setError("A nova quantidade não pode ser igual à quantidade atual.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      let endpoint = "/api/estoque/ajuste";
      let bodyData: any = {
        stockId: sourceStockId,
        quantityDiff,
        reason,
        depositanteId: selectedBalance?.depositanteId || sku.depositanteId || skuBalances[0]?.depositanteId,
      };

      if (isNewLot) {
        if (!newLotAddress.trim()) {
          setError("O código do endereço é obrigatório para um novo lote.");
          setIsSubmitting(false);
          return;
        }
        endpoint = "/api/estoque";
        bodyData = {
          depositanteId: sku.depositanteId || skuBalances[0]?.depositanteId,
          enderecoCodigo: newLotAddress.trim(),
          produtoCodigo: sku.sku,
          quantidade: quantityDiff,
          lote: newLotCode.trim(),
          validadeEm: newLotValidade.trim(),
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Erro ao realizar ajuste");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}></div>
      <div style={{ position: "relative", width: "420px", background: t.cardBg, borderRadius: "16px", border: `1px solid ${t.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: t.headBg }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(59,130,246,0.15)", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowRightLeft size={16} />
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: t.text }}>Ajuste de Estoque</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.textSub, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {error && (
            <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: "13px", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: t.textSub }}>Produto (SKU)</label>
            <div style={{ padding: "12px", borderRadius: "8px", background: t.softBg, border: `1px solid ${t.border}`, fontSize: "14px", color: t.text, fontWeight: 500 }}>
              {sku.sku} - {sku.productName}
            </div>
          </div>

          <FancySelectInput
            label="Endereço / Lote a ajustar"
            name="sourceStockId"
            value={sourceStockId}
            onChange={(val) => {
              setSourceStockId(val);
              setIsNewLot(val === "NEW_LOT");
              setNewQuantity("");
              setNewLotAddress("");
              setNewLotCode("");
              setNewLotValidade("");
            }}
            options={[
              { value: "", label: "Selecione o endereço..." },
              { value: "NEW_LOT", label: "+ Cadastrar novo endereço/lote" },
              ...skuBalances.map((b) => ({
                value: b.id,
                label: `${b.enderecoNome || "Sem endereço"} ${b.lote ? `(Lote: ${b.lote})` : ""} - Atual: ${b.rawQuantidade} un`,
              }))
            ]}
          />

          {isNewLot && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", padding: "16px", background: "rgba(59,130,246,0.05)", borderRadius: "12px", border: `1px dashed #3B82F6` }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: t.textSub }}>Endereço (Código) *</label>
                <input required type="text" value={newLotAddress} onChange={(e) => setNewLotAddress(e.target.value)} placeholder="Ex: A1-01" style={{ padding: "10px", borderRadius: "6px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "13px", outline: "none" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: t.textSub }}>Lote</label>
                <input type="text" value={newLotCode} onChange={(e) => setNewLotCode(e.target.value)} placeholder="Ex: L123" style={{ padding: "10px", borderRadius: "6px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "13px", outline: "none" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: t.textSub }}>Validade (DD/MM/AA)</label>
                <input type="text" value={newLotValidade} onChange={(e) => setNewLotValidade(e.target.value)} placeholder="Ex: 31/12/26" style={{ padding: "10px", borderRadius: "6px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "13px", outline: "none" }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: t.textSub }}>Quantidade Atual</label>
              <div style={{ padding: "12px", borderRadius: "8px", background: t.softBg, border: `1px solid ${t.border}`, fontSize: "14px", color: t.text, fontWeight: 700 }}>
                {sourceStockId ? `${currentQty} un` : "-"}
              </div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: t.textSub }}>Nova Quantidade</label>
              <input
                required
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Ex: 15"
                disabled={!sourceStockId}
                style={{ padding: "12px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "14px", outline: "none", borderColor: isPositive ? "#10B981" : isNegative ? "#EF4444" : t.border }}
              />
            </div>
          </div>

          {quantityDiff !== 0 && (
            <div style={{ fontSize: "13px", fontWeight: 600, color: isPositive ? "#10B981" : "#EF4444", display: "flex", alignItems: "center", gap: "4px" }}>
              {isPositive ? `+ ${Math.abs(quantityDiff)} unidades (Ajuste Positivo)` : `- ${Math.abs(quantityDiff)} unidades (Ajuste Negativo)`}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: t.textSub }}>Motivo do ajuste</label>
            <input
              required
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Contagem física revelou avaria"
              style={{ padding: "12px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "14px", outline: "none" }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !sourceStockId || newQuantity === "" || quantityDiff === 0 || !reason}
            style={{ marginTop: "10px", height: "48px", borderRadius: "8px", border: "none", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: isSubmitting ? "not-allowed" : "pointer", opacity: (!sourceStockId || newQuantity === "" || quantityDiff === 0 || !reason || isSubmitting) ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Confirmar Ajuste"}
          </button>
        </form>
      </div>
    </div>
  );
}
