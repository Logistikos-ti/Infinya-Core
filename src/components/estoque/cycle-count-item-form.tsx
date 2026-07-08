"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type CycleCountItemFormProps = {
  itemId: string;
  defaultCountedQuantity: string;
  defaultObservations: string;
  mode?: "first" | "second";
};

export function CycleCountItemForm({
  itemId,
  defaultCountedQuantity,
  defaultObservations,
  mode = "first",
}: CycleCountItemFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [countedQuantity, setCountedQuantity] = useState(
    defaultCountedQuantity === "-"
      ? ""
      : defaultCountedQuantity.replace(/\./g, "").replace(",", "."),
  );
  const [observations, setObservations] = useState(
    defaultObservations.startsWith("Sem observações") ? "" : defaultObservations,
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/estoque/inventarios/itens/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: mode === "second" ? "second-count" : undefined,
            countedQuantity,
            observacoes: observations,
          }),
        });

        const payload = (await response.json()) as { error?: string; message?: string };

        if (!response.ok) {
          setFeedback({
            type: "error",
            message:
              payload.error ??
              (mode === "second"
                ? "Não foi possível registrar a segunda contagem."
                : "Não foi possível registrar a contagem."),
          });
          return;
        }

        setFeedback({
          type: "success",
          message:
            payload.message ??
            (mode === "second"
              ? "Segunda contagem registrada com sucesso."
              : "Item contado com sucesso."),
        });
        router.refresh();
      } catch {
        setFeedback({
          type: "error",
          message:
            mode === "second"
              ? "Falha de comunicação ao registrar a segunda contagem."
              : "Falha de comunicação ao registrar a contagem.",
        });
      }
    });
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-[0.7fr_1.3fr_auto]">
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {mode === "second" ? "Segunda quantidade contada" : "Quantidade contada"}
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={countedQuantity}
            onChange={(event) => setCountedQuantity(event.target.value)}
            className="h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Observações
          </span>
          <input
            type="text"
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            placeholder={
              mode === "second"
                ? "Opcional: reconferido, divergência confirmada, novo beeper..."
                : "Opcional: avaria, falta, sobra, endereço vazio..."
            }
            className="h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-slate-500"
          />
        </label>

        <div className="flex items-end">
          <Button type="submit" disabled={isPending} className="h-[46px]">
            {isPending
              ? mode === "second"
                ? "Salvando segunda..."
                : "Salvando..."
              : mode === "second"
                ? "Salvar segunda contagem"
                : "Salvar contagem"}
          </Button>
        </div>
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
    </form>
  );
}
