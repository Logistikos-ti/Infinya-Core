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

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  let ageLabel = "há menos de 1 minuto";
  let tone: OperationalSlaTone = "fresh";

  if (diffMinutes === 0) {
    ageLabel = "há menos de 1 minuto";
  } else if (diffMinutes < 60) {
    ageLabel = `há ${diffMinutes} ${diffMinutes === 1 ? "minuto" : "minutos"}`;
  } else if (diffHours < 24) {
    ageLabel = `há ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  } else {
    ageLabel = `há ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
  }

  if (diffHours >= 72) {
    tone = "critical";
  } else if (diffHours >= 24) {
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
