import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const APP_TIME_ZONE = "America/Sao_Paulo";

/** Normalizes database and integration timestamps before they reach the UI. */
export function parseAppDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const normalized = value.trim();
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}T00:00:00-03:00`);
  }

  // Values without an offset are operational Sao Paulo times, not browser time.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) {
    return new Date(`${normalized.replace(" ", "T")}-03:00`);
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTimePtBr(
  value: string | Date | null | undefined,
  fallback = "-",
) {
  if (!value) {
    return fallback;
  }

  const date = parseAppDate(value);
  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export function formatDatePtBr(
  value: string | Date | null | undefined,
  fallback = "-",
) {
  if (!value) {
    return fallback;
  }

  const date = parseAppDate(value);
  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "short",
  }).format(date);
}

export function getSaoPauloDateStamp(
  value: string | Date | null | undefined,
) {
  if (!value) {
    return null;
  }

  const date = parseAppDate(value);
  if (!date) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}${month}${day}`;
}
