"use client";

import { useState } from "react";
import { X, RotateCcw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type StockInventoryModalProps = {
  sku: any;
  allBalances: any[];
  onClose: () => void;
  onSuccess: () => void;
  t: any;
};

export function StockInventoryModal({ sku, allBalances, onClose, onSuccess, t }: StockInventoryModalProps) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(`Inventário Pontual: ${sku.sku}`);
  const [observacoes, setObservacoes] = useState("");
  const [blindCount, setBlindCount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const skuBalances = allBalances.filter((b) => b.productId === sku.productId);
  const totalAddresses = new Set(skuBalances.map(b => b.enderecoId)).size;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/estoque/inventariar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skuId: sku.productId,
          titulo,
          observacoes,
          blindCount,
          depositanteId: skuBalances[0]?.depositanteId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Erro ao criar tarefa de contagem");
      }

      onSuccess();
      router.push("/estoque/contagens-ciclicas");
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
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(139,92,246,0.15)", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RotateCcw size={16} />
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: t.text }}>Criar Contagem (Inventariar)</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.textSub, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {error && (
            <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: "13px", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#3B82F6" }}>Informações da Tarefa</span>
            <span style={{ fontSize: "12.5px", color: t.textSub, lineHeight: 1.4 }}>
              Isto criará uma tarefa formal de inventário para o produto <strong>{sku.sku}</strong>, exigindo conferência nos <strong>{totalAddresses} endereço(s)</strong> vinculados.
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: t.textSub }}>Título da Contagem</label>
            <input
              required
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Contagem de Segurança"
              style={{ padding: "12px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "14px", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: t.textSub }}>Observações para o Operador</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Instruções adicionais..."
              style={{ padding: "12px", borderRadius: "8px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontSize: "14px", outline: "none", minHeight: "80px", resize: "none" }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: t.softBg, padding: "12px", borderRadius: "8px", border: `1px solid ${t.border}` }}>
            <input
              type="checkbox"
              checked={blindCount}
              onChange={(e) => setBlindCount(e.target.checked)}
              style={{ width: "16px", height: "16px", accentColor: "#8B5CF6", cursor: "pointer" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "13.5px", fontWeight: 700, color: t.text }}>Contagem Cega</span>
              <span style={{ fontSize: "11.5px", color: t.textSub }}>Ocultar quantidades atuais no coletor</span>
            </div>
          </label>

          <button
            type="submit"
            disabled={isSubmitting || !titulo}
            style={{ marginTop: "10px", height: "48px", borderRadius: "8px", border: "none", background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: isSubmitting ? "not-allowed" : "pointer", opacity: (!titulo || isSubmitting) ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Gerar Tarefa de Contagem"}
          </button>
        </form>
      </div>
    </div>
  );
}
