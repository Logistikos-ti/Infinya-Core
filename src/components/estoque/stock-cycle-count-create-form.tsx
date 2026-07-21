"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FancySelectInput, type FancySelectOption } from "@/components/ui/fancy-select-input";

type StockCycleCountCreateFormProps = {
  available: boolean;
  depositantes: FancySelectOption[];
  areas: FancySelectOption[];
  defaultDepositanteId?: string;
  canSelectDepositante: boolean;
};

export function StockCycleCountCreateForm({
  available,
  depositantes,
  areas,
  defaultDepositanteId = "",
  canSelectDepositante,
}: StockCycleCountCreateFormProps) {
  const router = useRouter();
  const [depositanteId, setDepositanteId] = useState(
    defaultDepositanteId || (depositantes.length === 1 ? depositantes[0]?.value ?? "" : ""),
  );
  const [area, setÁrea] = useState("");
  const [title, setTitle] = useState("");
  const [observations, setObservations] = useState("");
  const [blindCount, setBlindCount] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!available) {
      setFeedback({
        type: "error",
        message: "A base de inventário cíclico ainda não foi preparada no Supabase.",
      });
      return;
    }

    if (!depositanteId) {
      setFeedback({ type: "error", message: "Selecione o depositante da contagem." });
      return;
    }

    if (!title.trim()) {
      setFeedback({ type: "error", message: "Informe um título para a contagem." });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/estoque/inventarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositanteId,
          area,
          titulo: title,
          observacoes: observations,
          blindCount,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        result?: { id?: string };
      };

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: payload.error ?? "Não foi possível abrir a contagem cíclica.",
        });
        return;
      }

      if (payload.result?.id) {
        router.push(`/estoque/inventarios/${payload.result.id}`);
        router.refresh();
        return;
      }

      setFeedback({
        type: "success",
        message: payload.message ?? "Contagem criada com sucesso.",
      });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Falha de comunicação ao abrir a contagem cíclica.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Inventário cíclico
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Abra contagens por depositante e área, com opção de contagem cega e segunda conferência
            para itens divergentes.
          </p>
        </div>
        <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
          Cycle count
        </span>
      </div>

      {!available ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          A estrutura de inventário cíclico ainda não foi criada no banco atual. Assim que a
          migração nova for executada no Supabase, este bloco entra em operação.
        </div>
      ) : null}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_0.9fr_1.4fr]">
          <FancySelectInput
            label="Depositante"
            name="depositanteId"
            value={depositanteId}
            onChange={setDepositanteId}
            options={depositantes}
            disabled={!canSelectDepositante}
          />
          <FancySelectInput
            label="Área"
            name="area"
            value={area}
            onChange={setÁrea}
            options={[{ value: "", label: "Todas as áreas" }, ...areas]}
          />
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Título da contagem
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Contagem semanal picking A"
              className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-slate-500"
            />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={blindCount}
            onChange={(event) => setBlindCount(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
          />
          <span>
            <strong>Contagem cega</strong>
            <br />
            A primeira contagem não exibe a quantidade do sistema para o operador. Ideal para
            conferência real de piso.
          </span>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Observações
          </span>
          <textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            rows={3}
            placeholder="Opcional: equipe responsável, prioridade, corredor, motivo da contagem..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-slate-500"
          />
        </label>

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

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={isSubmitting || !available}
            className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            <ClipboardList className="h-4 w-4" />
            {isSubmitting ? "Abrindo contagem..." : "Abrir contagem cíclica"}
          </Button>
        </div>
      </form>
    </section>
  );
}
