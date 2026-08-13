"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";

type StockQuarantineModalProps = {
  sku: any;
  allBalances: any[];
  t: any;
  onClose: () => void;
  onSuccess: () => void;
};

export function StockQuarantineModal({
  sku,
  allBalances,
  t,
  onClose,
  onSuccess,
}: StockQuarantineModalProps) {
  const skuIdToFind = sku.productId || sku.sku;
  const balances = useMemo(
    () =>
      allBalances.filter(
        (balance) =>
          (balance.productId || balance.sku) === skuIdToFind &&
          Number(balance.rawQuantidade ?? 0) > 0,
      ),
    [allBalances, skuIdToFind],
  );
  const [stockId, setStockId] = useState(balances[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedBalance = balances.find((balance) => balance.id === stockId);
  const available = Math.max(
    0,
    Number(selectedBalance?.rawQuantidade ?? 0) - Number(selectedBalance?.rawReserved ?? 0),
  );
  const quantityNumber = Number(String(quantity).replace(",", "."));
  const canSubmit =
    stockId && quantityNumber > 0 && quantityNumber <= available && reason.trim().length >= 3;

  async function submit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/estoque/quarentena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId,
          quantity: quantityNumber,
          reason,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel criar a quarentena.");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel criar a quarentena.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        background: "rgba(6,10,20,0.62)",
        backdropFilter: "blur(4px)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(520px, 94vw)",
          borderRadius: 24,
          border: `1px solid ${t.border}`,
          background: t.drawerBg,
          boxShadow: "0 30px 90px rgba(0,0,0,.34)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 22px",
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "rgba(245,158,11,.14)",
              color: "#F59E0B",
            }}
          >
            <ShieldAlert size={19} />
          </span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: t.text }}>
              Enviar para quarentena
            </h3>
            <p style={{ marginTop: 2, fontSize: 12.5, color: t.textSub }}>
              Retire unidades do disponivel por avaria, analise ou divergencia.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: "grid",
              placeItems: "center",
              width: 36,
              height: 36,
              borderRadius: 12,
              border: `1px solid ${t.border}`,
              background: t.cardBg,
              color: t.textSub,
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 16, padding: 22 }}>
          <div
            style={{
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              background: t.cardBg,
              padding: 14,
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 800, color: t.textSub }}>Produto</p>
            <p style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: t.text }}>
              {sku.productName || sku.sku}
            </p>
            <p style={{ marginTop: 2, fontSize: 12, color: t.textSub }}>{sku.sku}</p>
          </div>

          <label style={{ display: "grid", gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: t.textSub }}>
              Linha de estoque
            </span>
            <select
              value={stockId}
              onChange={(event) => setStockId(event.target.value)}
              style={{
                height: 50,
                borderRadius: 14,
                border: `1px solid ${t.border}`,
                background: t.cardBg,
                color: t.text,
                padding: "0 14px",
                fontWeight: 700,
              }}
            >
              {balances.map((balance) => {
                const availableLabel = Math.max(
                  0,
                  Number(balance.rawQuantidade ?? 0) - Number(balance.rawReserved ?? 0),
                ).toLocaleString("pt-BR");
                return (
                  <option key={balance.id} value={balance.id}>
                    {balance.endereco || "Sem endereco"} - lote {balance.lote || "-"} - {availableLabel} un
                  </option>
                );
              })}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: t.textSub }}>
                Disponivel
              </span>
              <div
                style={{
                  height: 50,
                  borderRadius: 14,
                  border: `1px solid ${t.border}`,
                  background: t.cardBg,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 14px",
                  fontWeight: 800,
                  color: t.text,
                }}
              >
                {available.toLocaleString("pt-BR")} un
              </div>
            </label>
            <label style={{ display: "grid", gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: t.textSub }}>
                Quantidade
              </span>
              <input
                type="number"
                min={0}
                max={available}
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                style={{
                  height: 50,
                  borderRadius: 14,
                  border: `1px solid ${quantityNumber > available ? "#EF4444" : t.border}`,
                  background: t.cardBg,
                  color: t.text,
                  padding: "0 14px",
                  fontWeight: 800,
                }}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: t.textSub }}>
              Motivo da quarentena
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: avaria na embalagem, analise de qualidade, divergencia de validade..."
              rows={4}
              style={{
                minHeight: 104,
                borderRadius: 14,
                border: `1px solid ${t.border}`,
                background: t.cardBg,
                color: t.text,
                padding: 14,
                resize: "vertical",
              }}
            />
          </label>

          {error ? (
            <div
              style={{
                display: "flex",
                gap: 10,
                borderRadius: 14,
                border: "1px solid rgba(244,63,94,.28)",
                background: "rgba(244,63,94,.1)",
                padding: 12,
                color: "#E11D48",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <AlertTriangle size={16} />
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || loading}
            style={{
              height: 50,
              borderRadius: 14,
              border: "none",
              background:
                canSubmit && !loading
                  ? "linear-gradient(135deg, #F59E0B, #EF4444)"
                  : "rgba(148,163,184,.45)",
              color: "#fff",
              fontWeight: 900,
              cursor: canSubmit && !loading ? "pointer" : "not-allowed",
              boxShadow: canSubmit && !loading ? "0 16px 32px rgba(239,68,68,.22)" : "none",
            }}
          >
            {loading ? "Enviando..." : "Enviar para quarentena"}
          </button>
        </div>
      </div>
    </div>
  );
}
