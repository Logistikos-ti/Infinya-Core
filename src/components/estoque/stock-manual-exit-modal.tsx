"use client";

import { Loader2, LogOut, X } from "lucide-react";
import { useMemo, useState } from "react";

import { FancySelectInput } from "@/components/ui/fancy-select-input";

type StockManualExitModalProps = {
  sku: any;
  allBalances: any[];
  onClose: () => void;
  onSuccess: () => void;
  t: any;
};

// Mesmos motivos estruturados do coletor (mobile-manual-exit-panel.tsx), menos
// "Avaria" -- essa exige foto do dano tirada na prateleira, então fica só no
// coletor. "Vencimento" roteia para a quarentena na API (o depositante decide
// retirar ou descartar); os demais são baixa direta.
const REASONS: { value: "PERDA" | "VENCIMENTO" | "USO_INTERNO" | "OUTRO"; label: string }[] = [
  { value: "PERDA", label: "Perda" },
  { value: "VENCIMENTO", label: "Vencimento" },
  { value: "USO_INTERNO", label: "Uso interno" },
  { value: "OUTRO", label: "Outro" },
];

function quantityOf(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  return Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\.(?=\d{3}(?:\D|$))/g, "")) || 0;
}

export function StockManualExitModal({ sku, allBalances, onClose, onSuccess, t }: StockManualExitModalProps) {
  const [stockId, setStockId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reasonKey, setReasonKey] = useState<"" | (typeof REASONS)[number]["value"]>("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasonLabel = REASONS.find((item) => item.value === reasonKey)?.label ?? "";
  const effectiveReason = reasonKey === "OUTRO" ? reasonDetail.trim() : reasonLabel;
  const reasonComplete = Boolean(reasonKey) && (reasonKey !== "OUTRO" || reasonDetail.trim().length > 0);

  const balances = useMemo(() => {
    const productKey = sku.productId || sku.sku;
    return allBalances.filter((balance) => (balance.productId || balance.sku) === productKey && quantityOf(balance.rawQuantidade) > 0);
  }, [allBalances, sku.productId, sku.sku]);
  const selectedBalance = balances.find((balance) => balance.id === stockId);
  const available = selectedBalance
    ? Math.max(quantityOf(selectedBalance.rawQuantidade) - quantityOf(selectedBalance.rawReserved), 0)
    : 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const requested = Number(quantity);
    if (!selectedBalance || !Number.isFinite(requested) || requested <= 0 || !reasonComplete) return;
    if (requested > available) {
      setError(`A quantidade deve ser de até ${available.toLocaleString("pt-BR")} un.`);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/estoque/saida-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId: selectedBalance.id,
          quantity: requested,
          reason: effectiveReason,
          depositanteId: selectedBalance.depositanteId || sku.depositanteId,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível registrar a saída manual.");
      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar a saída manual.");
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.46)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: "440px", maxWidth: "100%", borderRadius: "16px", border: `1px solid ${t.border}`, background: t.cardBg, boxShadow: "0 20px 60px rgba(0,0,0,.4)", overflow: "visible", animation: "modalIn .2s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${t.border}`, background: t.headBg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 8, background: "rgba(239,68,68,.13)", color: "#EF4444" }}><LogOut size={16} /></div>
            <strong style={{ fontFamily: "'Space Grotesk', sans-serif", color: t.text }}>Saída manual</strong>
          </div>
          <button type="button" onClick={onClose} style={{ border: 0, background: "transparent", color: t.textSub, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <form onSubmit={submit} style={{ padding: 24, display: "grid", gap: 18 }}>
          {error && <div style={{ padding: 12, borderRadius: 9, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#EF4444", fontSize: 13, fontWeight: 650 }}>{error}</div>}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ color: t.textSub, fontSize: 13, fontWeight: 650 }}>Produto</label>
            <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${t.border}`, background: t.softBg, color: t.text, fontSize: 14 }}>{sku.sku} - {sku.productName}</div>
          </div>
          <FancySelectInput
            label="Endereço / lote de origem"
            name="manualExitStock"
            value={stockId}
            onChange={(value) => { setStockId(value); setQuantity(""); setError(""); }}
            options={[
              { value: "", label: "Selecione o saldo de origem..." },
              ...balances.map((balance) => {
                const balanceAvailable = Math.max(quantityOf(balance.rawQuantidade) - quantityOf(balance.rawReserved), 0);
                return { value: balance.id, label: `${balance.enderecoNome || "Sem endereço"}${balance.lote ? ` (Lote: ${balance.lote})` : ""} - Disponível: ${balanceAvailable.toLocaleString("pt-BR")} un` };
              }),
            ]}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: t.textSub, fontSize: 13, fontWeight: 650 }}>Disponível</label>
              <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${t.border}`, background: t.softBg, color: t.text, fontWeight: 700 }}>{stockId ? `${available.toLocaleString("pt-BR")} un` : "-"}</div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label htmlFor="manual-exit-quantity" style={{ color: t.textSub, fontSize: 13, fontWeight: 650 }}>Quantidade de saída</label>
              <input id="manual-exit-quantity" required type="number" min="1" max={available || 1} disabled={!stockId} value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Ex.: 10" style={{ padding: 12, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, outline: "none" }} />
            </div>
          </div>
          <FancySelectInput
            label="Motivo da saída"
            name="manualExitReason"
            value={reasonKey}
            onChange={(value) => { setReasonKey(value as typeof reasonKey); setError(""); }}
            options={[
              { value: "", label: "Selecione o motivo..." },
              ...REASONS.map((item) => ({ value: item.value, label: item.label })),
            ]}
          />
          {reasonKey === "OUTRO" ? (
            <div style={{ display: "grid", gap: 6 }}>
              <label htmlFor="manual-exit-reason-detail" style={{ color: t.textSub, fontSize: 13, fontWeight: 650 }}>Descreva o motivo</label>
              <textarea id="manual-exit-reason-detail" required value={reasonDetail} onChange={(event) => setReasonDetail(event.target.value)} placeholder="Ex.: consumo interno, devolução ao fornecedor" rows={2} style={{ resize: "vertical", padding: 12, borderRadius: 8, border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, outline: "none", fontFamily: "inherit" }} />
            </div>
          ) : null}
          <p style={{ margin: 0, color: t.textSub, fontSize: 12.5, lineHeight: 1.5 }}>
            {reasonKey === "VENCIMENTO"
              ? "O lote vai para a quarentena com o motivo Vencimento — o depositante decide se retira ou descarta."
              : "A confirmação reduz o saldo disponível e registra a movimentação com seu usuário, data e motivo."}
          </p>
          <button type="submit" disabled={isSubmitting || !stockId || !quantity || !reasonComplete} style={{ height: 48, border: 0, borderRadius: 9, background: "linear-gradient(92deg,#EF4444,#DC2626)", color: "#fff", fontWeight: 750, cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting || !stockId || !quantity || !reasonComplete ? .6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><LogOut size={16} /> Confirmar saída manual</>}
          </button>
        </form>
      </div>
    </div>
  );
}
