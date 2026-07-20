"use client";

import { useState } from "react";
import { X, ArrowRight, Loader2 } from "lucide-react";
import { FancySelectInput } from "@/components/ui/fancy-select-input";

type StockTransferQuickModalProps = {
  sku: any;
  allBalances: any[];
  allAddresses: any[];
  onClose: () => void;
  onSuccess: () => void;
  t: any;
};

export function StockTransferQuickModal({ sku, allBalances, allAddresses, onClose, onSuccess, t }: StockTransferQuickModalProps) {
  const [sourceStockId, setSourceStockId] = useState("");
  const [destinationAddressId, setDestinationAddressId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const skuBalances = allBalances.filter((b) => b.productId === sku.productId && b.rawQuantidade > 0);
  
  const selectedBalance = skuBalances.find((b) => b.id === sourceStockId);
  const availableQty = selectedBalance ? selectedBalance.rawQuantidade : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceStockId || !destinationAddressId || !quantity) return;
    
    if (Number(quantity) <= 0 || Number(quantity) > availableQty) {
      setError("Quantidade inválida");
      return;
    }

    if (selectedBalance?.enderecoId === destinationAddressId) {
      setError("O endereço de destino deve ser diferente da origem");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/estoque/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transferencia",
          stockId: sourceStockId,
          destinationAddressId,
          quantity: Number(quantity),
          depositanteId: selectedBalance?.depositanteId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Erro ao realizar transferência");
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
              <ArrowRight size={16} />
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: t.text }}>Transferência</span>
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
            label="Endereço de Origem / Lote"
            name="sourceStockId"
            value={sourceStockId}
            onChange={(val) => {
              setSourceStockId(val);
              setQuantity("");
            }}
            options={[
              { value: "", label: "Selecione a origem..." },
              ...skuBalances.map((b) => ({
                value: b.id,
                label: `${b.enderecoNome || "Sem endereço"} ${b.lote ? `(Lote: ${b.lote})` : ""} - Disponível: ${b.rawQuantidade} un`,
              }))
            ]}
          />

          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ flex: 2 }}>
              <FancySelectInput
                label="Endereço de Destino"
                name="destinationAddressId"
                value={destinationAddressId}
                onChange={setDestinationAddressId}
                options={[
                  { value: "", label: "Selecione o destino..." },
                  ...allAddresses.map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))
                ]}
              />
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: t.textSub }}>Qtd</label>
              <input
                required
                type="number"
                min="1"
                max={availableQty || 1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ex: 10"
                style={{ padding: "12px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "14px", outline: "none" }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !sourceStockId || !destinationAddressId || !quantity}
            style={{ marginTop: "10px", height: "48px", borderRadius: "8px", border: "none", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: isSubmitting ? "not-allowed" : "pointer", opacity: (!sourceStockId || !destinationAddressId || !quantity || isSubmitting) ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Confirmar Transferência"}
          </button>
        </form>
      </div>
    </div>
  );
}
