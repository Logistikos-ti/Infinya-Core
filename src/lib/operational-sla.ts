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

  const date = parseOperationalDate(value);
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
    createdAtLabel: formatOperationalDateLabel(value, date),
    ageLabel,
    tone,
  };
}

function parseOperationalDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00-03:00`);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(value)) {
    return new Date(`${value}-03:00`);
  }

  return new Date(value);
}

function formatOperationalDateLabel(originalValue: string, parsedDate: Date) {
  const localDateTimeMatch = originalValue.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/,
  );

  if (localDateTimeMatch) {
    const [, year, month, day, hour, minute] = localDateTimeMatch;
    return `${day}/${month}/${year}, ${hour}:${minute}`;
  }

  const dateOnlyMatch = originalValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}/${month}/${year}`;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsedDate);
}
