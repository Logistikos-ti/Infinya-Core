export type OperationalSlaTone = "fresh" | "warning" | "critical";

export type OperationalSlaMeta = {
  createdAtIso: string | null;
  createdAtLabel: string;
  ageLabel: string;
  tone: OperationalSlaTone;
};

export function buildOperationalSlaMeta(value: string | null | undefined): OperationalSlaMeta {
  if (!value) {
    return {
      createdAtIso: null,
      createdAtLabel: "Sem data",
      ageLabel: "Sem SLA",
      tone: "fresh",
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      createdAtIso: null,
      createdAtLabel: "Sem data",
      ageLabel: "Sem SLA",
      tone: "fresh",
    };
  }

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const diffDays = Math.floor(diffHours / 24);

  let ageLabel = "Hoje";
  let tone: OperationalSlaTone = "fresh";

  if (diffHours >= 72) {
    ageLabel = `${diffDays}d em fila`;
    tone = "critical";
  } else if (diffHours >= 24) {
    ageLabel = diffDays <= 1 ? "1d em fila" : `${diffDays}d em fila`;
    tone = "warning";
  }

  return {
    createdAtIso: date.toISOString(),
    createdAtLabel: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(date),
    ageLabel,
    tone,
  };
}
