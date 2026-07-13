/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, parse, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DatePickerInputProps = {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
  hideLabel?: boolean;
};

export function DatePickerInput({
  label,
  name,
  value = "",
  required = false,
  hideLabel = false,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value);
  const [viewDate, setViewDate] = useState(() => getInitialViewDate(value));
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedDate(value);
    setViewDate(getInitialViewDate(value));
  }, [value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPadding = (getDay(monthStart) + 6) % 7;

    return {
      monthDays,
      startPadding,
    };
  }, [viewDate]);

  return (
    <div className="space-y-1" ref={containerRef}>
      {hideLabel ? null : (
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
      )}
      <input type="hidden" name={name} value={selectedDate} required={required} />

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-[52px] w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm text-slate-700 shadow-[0_10px_35px_rgba(15,23,42,0.04)] transition hover:border-cyan-300 hover:shadow-[0_12px_35px_rgba(34,211,238,0.10)] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_12px_35px_rgba(34,211,238,0.12)] dark:focus:ring-cyan-900/40"
      >
        <span className="inline-flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className={selectedDate ? "" : "text-slate-400 dark:text-slate-500"}>
            {selectedDate ? formatDisplayDate(selectedDate) : "Selecionar data"}
          </span>
        </span>
      </button>

      {open ? (
        <div className="relative">
          <div className="absolute z-30 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewDate((current) => subMonths(current, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                {format(viewDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </div>

              <button
                type="button"
                onClick={() => setViewDate((current) => addMonths(current, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: days.startPadding }).map((_, index) => (
                <div key={`pad-${index}`} className="h-10" />
              ))}

              {days.monthDays.map((day) => {
                const dateValue = format(day, "yyyy-MM-dd");
                const selected = dateValue === selectedDate;
                const isToday = dateValue === format(new Date(), "yyyy-MM-dd");

                return (
                  <button
                    key={dateValue}
                    type="button"
                    onClick={() => {
                      setSelectedDate(dateValue);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-xl text-sm transition",
                      selected
                        ? "bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 font-semibold text-white shadow-[0_10px_25px_rgba(59,130,246,0.35)]"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900",
                      isToday && !selected
                        ? "border border-cyan-200 bg-cyan-50/70 dark:border-cyan-500/20 dark:bg-cyan-500/10"
                        : "",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("");
                  setOpen(false);
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = format(new Date(), "yyyy-MM-dd");
                  setSelectedDate(today);
                  setViewDate(new Date());
                  setOpen(false);
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-950 bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                Hoje
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getInitialViewDate(value: string) {
  if (!value) {
    return new Date();
  }

  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDisplayDate(value: string) {
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return format(parsed, "dd/MM/yyyy");
}
