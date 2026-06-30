"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, RefreshCw, Siren, WifiOff } from "lucide-react";
import { formatDateTimePtBr } from "@/lib/utils";

type IntegrationAlert = {
  id: string;
  depositanteId: string;
  depositante: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  source: "oauth" | "webhook" | "xml" | "reprocess";
  createdAt: string | null;
};

type IntegrationAlertCenterProps = {
  initialAlerts: IntegrationAlert[];
  compact?: boolean;
};

export function IntegrationAlertCenter({
  initialAlerts,
  compact = false,
}: IntegrationAlertCenterProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshAlerts();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter((item) => item.severity === "critical").length,
      warning: alerts.filter((item) => item.severity === "warning").length,
    };
  }, [alerts]);

  async function refreshAlerts() {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/integracoes/alertas", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        alerts?: IntegrationAlert[];
      };

      if (response.ok && Array.isArray(payload.alerts)) {
        setAlerts(payload.alerts);
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Alertas de integração
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Atualização automática a cada 30 segundos para falhas e pendências críticas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshAlerts()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Atualizar agora
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone={summary.critical ? "critical" : "neutral"}>
          {summary.critical} crítico(s)
        </Badge>
        <Badge tone={summary.warning ? "warning" : "neutral"}>
          {summary.warning} aviso(s)
        </Badge>
        <Badge tone={summary.total ? "info" : "neutral"}>
          {summary.total} alerta(s) monitorado(s)
        </Badge>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.length ? (
          alerts.slice(0, compact ? 3 : 10).map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border px-4 py-3 ${
                alert.severity === "critical"
                  ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
                  : alert.severity === "warning"
                    ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                    : "border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {alert.severity === "critical" ? (
                      <Siren className="h-4 w-4 text-rose-700 dark:text-rose-200" />
                    ) : alert.severity === "warning" ? (
                      <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-200" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-sky-700 dark:text-sky-200" />
                    )}
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      {alert.title}
                    </p>
                  </div>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {alert.depositante} • {getSourceLabel(alert.source)}
                  </p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {alert.message}
                  </p>
                </div>

                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
                  {formatDateTimePtBr(alert.createdAt, "Sem data")}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            Nenhuma falha ativa no momento. As integrações estão estáveis dentro dos critérios
            monitorados.
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "critical" | "warning" | "info" | "neutral";
}) {
  const className =
    tone === "critical"
      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
        : tone === "info"
          ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function getSourceLabel(source: IntegrationAlert["source"]) {
  switch (source) {
    case "oauth":
      return "OAuth";
    case "webhook":
      return "Webhook";
    case "xml":
      return "XML";
    case "reprocess":
      return "Reprocessamento";
    default:
      return source;
  }
}
