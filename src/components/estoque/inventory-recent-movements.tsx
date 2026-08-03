"use client";

import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, ClipboardPenLine, History } from "lucide-react";

type InventoryRecentMovementsProps = {
  t: any;
  movements: any[];
};

function getMovementPresentation(type: string) {
  if (type === "ENTRADA" || type === "AJUSTE_POSITIVO") {
    return { label: type === "ENTRADA" ? "Entrada de estoque" : "Ajuste positivo", color: "#10B981", icon: ArrowDownRight, sign: "+" };
  }
  if (type === "SAIDA" || type === "AJUSTE_NEGATIVO") {
    return { label: type === "SAIDA" ? "Saída de estoque" : "Ajuste negativo", color: "#EF4444", icon: ArrowUpRight, sign: "-" };
  }
  if (type === "TRANSFERENCIA") {
    return { label: "Transferência interna", color: "#3B82F6", icon: ArrowLeftRight, sign: "" };
  }
  return { label: type || "Movimentação", color: "#8B5CF6", icon: ClipboardPenLine, sign: "" };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function InventoryRecentMovements({ t, movements }: InventoryRecentMovementsProps) {
  const recentMovements = movements.slice(0, 8);

  return (
    <section style={{ marginTop: 24, borderRadius: 16, border: `1px solid ${t.border}`, background: t.cardBg, overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(59,130,246,.12)", color: "#3B82F6" }}>
          <History size={18} />
        </span>
        <div style={{ display: "grid", gap: 2 }}>
          <strong style={{ color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15.5 }}>Movimentações recentes</strong>
          <span style={{ color: t.textSub, fontSize: 12.5 }}>Entradas, saídas, transferências e ajustes registrados no estoque.</span>
        </div>
        <span style={{ marginLeft: "auto", color: t.textSub, fontSize: 13 }}>{recentMovements.length} registros</span>
      </header>

      {recentMovements.length ? (
        <div style={{ display: "grid" }}>
          {recentMovements.map((movement) => {
            const presentation = getMovementPresentation(String(movement.type ?? ""));
            const Icon = presentation.icon;
            return (
              <div key={movement.id} style={{ display: "grid", gridTemplateColumns: "42px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${t.border}` }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: presentation.color, background: `${presentation.color}18` }}>
                  <Icon size={17} />
                </span>
                <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
                  <strong style={{ color: t.text, fontSize: 13.5 }}>{presentation.label}</strong>
                  <span style={{ color: t.textSub, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={movement.label}>{movement.label}</span>
                  {movement.reference ? <span style={{ color: t.textFaint, fontSize: 11.5 }}>{movement.reference}</span> : null}
                </div>
                <div style={{ display: "grid", gap: 3, justifyItems: "end", textAlign: "right" }}>
                  <strong style={{ color: presentation.color, fontSize: 13.5 }}>{presentation.sign}{Number(movement.quantity ?? 0).toLocaleString("pt-BR")} un</strong>
                  <span style={{ color: t.textSub, fontSize: 11.5 }}>{formatDateTime(movement.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: "28px 20px", color: t.textSub, fontSize: 13.5 }}>Nenhuma movimentação foi registrada para os filtros atuais.</div>
      )}
    </section>
  );
}
