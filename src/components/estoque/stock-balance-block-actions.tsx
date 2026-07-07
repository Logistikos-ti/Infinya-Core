"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";

type StockBalanceBlockActionsProps = {
  stockId: string;
  stockLabel: string;
  status: string;
  currentReason?: string | null;
  blockedAt?: string | null;
};

export function StockBalanceBlockActions({
  stockId,
  stockLabel,
  status,
  currentReason,
  blockedAt,
}: StockBalanceBlockActionsProps) {
  const router = useRouter();
  const [reason, setReason] = useState(currentReason ?? "");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const isBlocked = status === "Bloqueado";
  const helperText = useMemo(() => {
    if (isBlocked) {
      return blockedAt
        ? `Bloqueado em ${blockedAt}. Ao desbloquear, o saldo volta a ficar disponível para separação e transferência.`
        : "Este saldo está fora de circulação operacional.";
    }

    return "Use o bloqueio para avaria, quarentena, divergência ou qualquer retenção temporária do saldo.";
  }, [blockedAt, isBlocked]);

  function submit(action: "block" | "unblock") {
    const normalizedReason = reason.trim();

    if (action === "block" && !normalizedReason) {
      setFeedback({
        type: "error",
        message: "Informe o motivo antes de bloquear o saldo.",
      });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/estoque/${stockId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            reason: normalizedReason || undefined,
          }),
        });
        const payload = (await response.json()) as { error?: string; message?: string };

        if (!response.ok) {
          setFeedback({
            type: "error",
            message: payload.error ?? "Não foi possível atualizar o bloqueio do saldo.",
          });
          return;
        }

        setFeedback({
          type: "success",
          message:
            payload.message ??
            (action === "block"
              ? "Saldo bloqueado com sucesso."
              : "Saldo desbloqueado com sucesso."),
        });

        if (action === "unblock") {
          setReason("");
        }

        router.refresh();
      } catch {
        setFeedback({
          type: "error",
          message: "Falha de comunicação ao atualizar o bloqueio do saldo.",
        });
      }
    });
  }

  return (
    <div className="flex min-w-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 md:min-w-[420px]">
      <div className="space-y-1">
        <p className="font-semibold text-slate-950 dark:text-white">Bloqueio operacional</p>
        <p className="text-slate-600 dark:text-slate-300">{helperText}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Protocolo: {stockLabel}</p>
      </div>

      <label className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Motivo
        </span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder={
            isBlocked
              ? "Opcional para desbloqueio (ex.: divergência resolvida)"
              : "Ex.: avaria no pallet, quarentena, conferência pendente"
          }
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-fuchsia-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-white dark:focus:border-fuchsia-500"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {isBlocked ? (
          <Button
            type="button"
            onClick={() => submit("unblock")}
            disabled={isPending}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <Unlock className="h-4 w-4" />
            Desbloquear saldo
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => submit("block")}
            disabled={isPending}
            className="bg-rose-600 text-white hover:bg-rose-500"
          >
            <Lock className="h-4 w-4" />
            Bloquear saldo
          </Button>
        )}
      </div>

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}
