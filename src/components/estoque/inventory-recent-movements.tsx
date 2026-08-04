"use client";

type InventoryRecentMovementsProps = {
  t: any;
  movements: any[];
};

function movementLabel(type: string) {
  switch (type) {
    case "ENTRADA": return "Entrada de estoque";
    case "SAIDA": return "Saída de estoque";
    case "TRANSFERENCIA": return "Movimentação interna";
    case "AJUSTE_POSITIVO": return "Ajuste positivo";
    case "AJUSTE_NEGATIVO": return "Ajuste negativo";
    case "BLOQUEIO": return "Bloqueio de estoque";
    case "DESBLOQUEIO": return "Desbloqueio de estoque";
    default: return type || "Movimentação de estoque";
  }
}

function movementColor(type: string) {
  if (type === "SAIDA" || type === "AJUSTE_NEGATIVO" || type === "BLOQUEIO") return "#EF4444";
  if (type === "TRANSFERENCIA") return "#3B82F6";
  if (type === "AJUSTE_POSITIVO") return "#8B5CF6";
  return "#10B981";
}

function formatSaoPauloDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";

  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("day")}/${read("month")}/${read("year")} às ${read("hour")}:${read("minute")}`;
}

export function InventoryRecentMovements({ t, movements }: InventoryRecentMovementsProps) {
  const recentMovements = movements.slice(0, 8);

  return (
    <section style={{ marginTop: 24, borderRadius: 16, border: `1px solid ${t.border}`, background: t.cardBg, padding: "18px 20px 10px" }}>
      <strong style={{ display: "block", marginBottom: 15, color: t.text, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15.5 }}>Movimentações recentes</strong>
      {recentMovements.length ? (
        <div style={{ display: "grid", gap: 0 }}>
          {recentMovements.map((movement, index) => {
            const color = movementColor(String(movement.type ?? ""));
            return (
              <div key={movement.id} style={{ display: "grid", gridTemplateColumns: "20px minmax(0,1fr)", columnGap: 8, minHeight: 66 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ width: 10, height: 10, marginTop: 4, borderRadius: 99, flexShrink: 0, background: color, boxShadow: `0 0 0 3px ${color}22` }} />
                  {index < recentMovements.length - 1 ? <span style={{ flex: 1, width: 2, marginTop: 4, background: t.border }} /> : null}
                </div>
                <div style={{ display: "grid", alignContent: "start", gap: 4, paddingBottom: 14 }}>
                  <strong style={{ color: t.text, fontSize: 13.5 }}>{movementLabel(String(movement.type ?? ""))}</strong>
                  <span style={{ color: t.textSub, fontSize: 12.5, lineHeight: 1.45 }}>
                    {formatSaoPauloDateTime(movement.createdAt)} · {movement.observation || movement.reference}
                  </span>
                  <span style={{ color: t.textFaint, fontSize: 11.5 }}>Operador: {movement.operatorName || "Sistema"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: "6px 0 16px", color: t.textSub, fontSize: 13.5 }}>Nenhuma movimentação foi registrada para os filtros atuais.</div>
      )}
    </section>
  );
}
