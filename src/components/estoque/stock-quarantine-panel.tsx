/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { CheckCircle2, ShieldAlert, Trash2 } from "lucide-react";

import type { StockQuarantineItem } from "@/lib/stock-quarantine";

type StockQuarantinePanelProps = {
  t: any;
  items?: StockQuarantineItem[];
};

export function StockQuarantinePanel({ t, items = [] }: StockQuarantinePanelProps) {
  const [loadingId, setLoadingId] = useState("");
  const [error, setError] = useState("");

  async function resolveItem(item: StockQuarantineItem, action: "release" | "discard") {
    if (loadingId) return;
    const confirmation =
      action === "release"
        ? `Liberar ${item.quantityLabel} un de ${item.productName} de volta ao estoque?`
        : `Descartar definitivamente ${item.quantityLabel} un de ${item.productName}?`;

    if (!window.confirm(confirmation)) return;

    setLoadingId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/estoque/quarentena/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          observations:
            action === "release"
              ? "Liberado pela operacao."
              : "Descartado pela operacao.",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel resolver a quarentena.");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel resolver a quarentena.");
      setLoadingId("");
    }
  }

  return (
    <section
      style={{
        marginTop: 24,
        border: `1px solid ${t.border}`,
        borderRadius: 20,
        background: t.cardBg,
        boxShadow: "0 12px 34px rgba(15,23,42,.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 20px",
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 42,
            height: 42,
            borderRadius: 14,
            background: "rgba(245,158,11,.12)",
            color: "#F59E0B",
          }}
        >
          <ShieldAlert size={20} />
        </span>
        <div style={{ flex: 1 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: t.text,
            }}
          >
            Quarentena operacional
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: t.textSub }}>
            Produtos retirados do estoque disponivel para analise, avaria ou divergencia.
          </p>
        </div>
        <span
          style={{
            borderRadius: 999,
            background: t.softBg,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 800,
            color: t.textSub,
          }}
        >
          {items.length} registro(s)
        </span>
      </div>

      {error ? (
        <div
          style={{
            margin: "16px 20px 0",
            border: "1px solid rgba(244,63,94,.25)",
            borderRadius: 14,
            background: "rgba(244,63,94,.1)",
            color: "#E11D48",
            padding: 12,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      {items.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Produto", "Depositante", "Endereco", "Qtd.", "Motivo", "Registro", "Acoes"].map(
                  (label) => (
                    <th
                      key={label}
                      style={{
                        padding: "13px 20px",
                        background: t.headBg,
                        borderBottom: `1px solid ${t.border}`,
                        color: t.textSub,
                        fontSize: 11.5,
                        fontWeight: 900,
                        textAlign: "left",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                      }}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: "15px 20px", borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div
                        style={{
                          display: "grid",
                          placeItems: "center",
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          background: t.softBg,
                          overflow: "hidden",
                        }}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <ShieldAlert size={18} color={t.textSub} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            maxWidth: 260,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: t.text,
                            fontWeight: 800,
                          }}
                          title={item.productName}
                        >
                          {item.productName}
                        </p>
                        <p style={{ margin: "2px 0 0", color: t.textSub, fontSize: 12 }}>
                          {item.sku}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "15px 20px", borderBottom: `1px solid ${t.border}`, color: t.text }}>
                    {item.depositante}
                  </td>
                  <td style={{ padding: "15px 20px", borderBottom: `1px solid ${t.border}`, color: t.text }}>
                    {item.endereco}
                    <p style={{ margin: "2px 0 0", color: t.textSub, fontSize: 12 }}>{item.area}</p>
                  </td>
                  <td style={{ padding: "15px 20px", borderBottom: `1px solid ${t.border}`, color: t.text, fontWeight: 900 }}>
                    {item.quantityLabel} un
                  </td>
                  <td style={{ padding: "15px 20px", borderBottom: `1px solid ${t.border}`, color: t.textSub, maxWidth: 260 }}>
                    {item.reason}
                  </td>
                  <td style={{ padding: "15px 20px", borderBottom: `1px solid ${t.border}`, color: t.textSub }}>
                    {item.createdAtLabel}
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: t.text }}>{item.createdBy}</p>
                  </td>
                  <td style={{ padding: "15px 20px", borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => resolveItem(item, "release")}
                        disabled={loadingId === item.id}
                        style={{
                          height: 36,
                          borderRadius: 11,
                          border: "1px solid rgba(16,185,129,.35)",
                          background: "rgba(16,185,129,.1)",
                          color: "#059669",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "0 12px",
                        }}
                      >
                        <CheckCircle2 size={15} /> Liberar
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveItem(item, "discard")}
                        disabled={loadingId === item.id}
                        style={{
                          height: 36,
                          borderRadius: 11,
                          border: "1px solid rgba(239,68,68,.35)",
                          background: "rgba(239,68,68,.08)",
                          color: "#EF4444",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "0 12px",
                        }}
                      >
                        <Trash2 size={15} /> Descartar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: 28, color: t.textSub, fontSize: 14 }}>
          Nenhum produto em quarentena no momento.
        </div>
      )}
    </section>
  );
}
