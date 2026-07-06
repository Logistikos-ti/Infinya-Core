"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type StockBalanceAdminActionsProps = {
  stockId: string;
  stockLabel: string;
  currentBalance: string;
  reservedBalance: string;
};

export function StockBalanceAdminActions({
  stockId,
  stockLabel,
  currentBalance,
  reservedBalance,
}: StockBalanceAdminActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  function handleZero() {
    if (
      !window.confirm(
        `Deseja realmente zerar o saldo do protocolo ${stockLabel}? Essa ação gera um ajuste administrativo no histórico.`,
      )
    ) {
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/estoque/${stockId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "zero" }),
        });
        const payload = (await response.json()) as { error?: string; message?: string };

        if (!response.ok) {
          setFeedback({
            type: "error",
            message: payload.error ?? "Não foi possível zerar o saldo.",
          });
          return;
        }

        setFeedback({
          type: "success",
          message: payload.message ?? "Saldo zerado com sucesso.",
        });
        router.refresh();
      } catch {
        setFeedback({
          type: "error",
          message: "Falha de comunicação ao zerar o saldo.",
        });
      }
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Deseja excluir a linha de estoque do protocolo ${stockLabel}? Use isso apenas quando o saldo já estiver zerado.`,
      )
    ) {
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/estoque/${stockId}`, {
          method: "DELETE",
        });
        const payload = (await response.json()) as { error?: string; message?: string };

        if (!response.ok) {
          setFeedback({
            type: "error",
            message: payload.error ?? "Não foi possível excluir a linha de estoque.",
          });
          return;
        }

        router.push("/estoque");
        router.refresh();
      } catch {
        setFeedback({
          type: "error",
          message: "Falha de comunicação ao excluir a linha de estoque.",
        });
      }
    });
  }

  return (
    <div className="flex min-w-full flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-500/20 dark:bg-amber-500/10 md:min-w-[420px]">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            Ajuste administrativo de estoque
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-200/90">
            Recurso visível apenas para Admin/TI. Saldo atual: {currentBalance}. Reservado:{" "}
            {reservedBalance}.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleZero}
          disabled={isPending}
          className="bg-amber-600 text-white hover:bg-amber-500"
        >
          Zerar saldo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleDelete}
          disabled={isPending}
          className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
        >
          <Trash2 className="h-4 w-4" />
          Excluir linha
        </Button>
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
