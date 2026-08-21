"use client";

import { CalendarDays, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

const TIME_ZONE_BY_UF: Record<string, string> = {
  AC: "America/Rio_Branco",
  AM: "America/Manaus",
  MS: "America/Campo_Grande",
  MT: "America/Cuiaba",
  RO: "America/Porto_Velho",
  RR: "America/Boa_Vista",
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function PortalDateTime({ city, uf }: { city?: string; uf?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const normalizedUf = uf?.trim().toUpperCase() ?? "";
  const timeZone = TIME_ZONE_BY_UF[normalizedUf] ?? "America/Sao_Paulo";
  const location = [city?.trim(), normalizedUf].filter(Boolean).join(" - ");
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  });
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  });

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
        <CalendarDays className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400">
          {now ? capitalize(dateFormatter.format(now)) : "Data de hoje"}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold tabular-nums text-slate-950 dark:text-white">
          <Clock3 className="h-3.5 w-3.5 text-indigo-500" />
          {now ? timeFormatter.format(now) : "--:--:--"}
          {location ? (
            <span className="text-[10px] font-semibold uppercase text-slate-400">
              {location}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
