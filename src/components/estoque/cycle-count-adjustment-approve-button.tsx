"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type CycleCountAdjustmentApproveButtonProps = {
  itemId: string;
  adjustmentStatus: string;
  divergence: string;
};

export function CycleCountAdjustmentApproveButton({
  itemId,
  adjustmentStatus,
  divergence,
}: CycleCountAdjustmentApproveButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  if (adjustmentStatus === "APLICADO") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        Ajuste já aplicado ao saldo deste item.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/60 p-4 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-fuchsia-900 dark:text-fuchsia-100">
          Aprovação de divergência
        </p>
        <p className="text-sm text-fuchsia-800 dark:text-fuchsia-200/90">
          Divergência atual: {divergence}. Ao aprovar, o saldo do estoque será ajustado para a
          quantidade contada.
        </p>
      </div>

      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={2}
        placeholder="Observação da aprovação (opcional)"
        className="w-full rounded-2xl border border-fuchsia-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-fuchsia-400 dark:border-fuchsia-500/30 dark:bg-zinc-900 dark:text-white"
      />

      <Button
        type="button"
        disabled={isPending}
        className="bg-fuchsia-600 text-white hover:bg-fuchsia-500"
        onClick={() => {
          if (!window.confirm("Deseja aplicar este ajuste de inventário ao saldo atual?")) {
            return;
          }

          setFeedback(null);
          startTransition(async () => {
            try {
              const response = await fetch(`/api/estoque/inventarios/itens/${itemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "approve-adjustment",
                  observacoes: notes,
                }),
              });

              const payload = (await response.json()) as { error?: string; message?: string };

              if (!response.ok) {
                setFeedback({
                  type: "error",
                  message: payload.error ?? "Não foi possível aprovar o ajuste.",
                });
                return;
              }

              setFeedback({
                type: "success",
                message: payload.message ?? "Ajuste aplicado com sucesso.",
              });
              setNotes("");
              router.refresh();
            } catch {
              setFeedback({
                type: "error",
                message: "Falha de comunicação ao aprovar o ajuste.",
              });
            }
          });
        }}
      >
        <CheckCheck className="h-4 w-4" />
        {isPending ? "Aplicando ajuste..." : "Aprovar e ajustar saldo"}
      </Button>

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
