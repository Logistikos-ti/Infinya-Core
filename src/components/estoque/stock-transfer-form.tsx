"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, MoveRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  FancySelectInput,
  type FancySelectOption,
} from "@/components/ui/fancy-select-input";

type DepositanteOption = FancySelectOption;
type AddressOption = FancySelectOption & { area: string };
type StockSourceOption = {
  value: string;
  label: string;
  depositanteId: string;
  enderecoId: string;
};

type StockTransferFormProps = {
  depositantes: DepositanteOption[];
  addresses: AddressOption[];
  stockSources: StockSourceOption[];
  defaultDepositanteId?: string;
  canSelectDepositante: boolean;
};

export function StockTransferForm({
  depositantes,
  addresses,
  stockSources,
  defaultDepositanteId = "",
  canSelectDepositante,
}: StockTransferFormProps) {
  const router = useRouter();
  const [depositanteId, setDepositanteId] = useState(
    defaultDepositanteId || (depositantes.length === 1 ? depositantes[0]?.value ?? "" : ""),
  );
  const [stockId, setStockId] = useState("");
  const [destinationAddressId, setDestinationAddressId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const filteredSources = useMemo(
    () => stockSources.filter((item) => item.depositanteId === depositanteId),
    [depositanteId, stockSources],
  );

  const selectedSource = filteredSources.find((item) => item.value === stockId) ?? null;
  const destinationOptions = useMemo(
    () =>
      addresses
        .filter((item) => item.value !== selectedSource?.enderecoId)
        .map((item) => ({
          value: item.value,
          label: `${item.label} • ${formatAreaLabel(item.area)}`,
        })),
    [addresses, selectedSource],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!depositanteId) {
      setFeedback({ type: "error", message: "Selecione o depositante da movimentação." });
      return;
    }

    if (!stockId) {
      setFeedback({ type: "error", message: "Selecione um saldo de origem para transferir." });
      return;
    }

    if (!destinationAddressId) {
      setFeedback({ type: "error", message: "Selecione um endereço de destino." });
      return;
    }

    if (!quantity.trim() || Number(quantity) <= 0) {
      setFeedback({ type: "error", message: "Informe uma quantidade maior que zero." });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/estoque/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transferencia",
          depositanteId,
          stockId,
          destinationAddressId,
          quantity,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: payload.error ?? "Não foi possível concluir a transferência interna.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: payload.message ?? "Transferência interna concluída com sucesso.",
      });
      setStockId("");
      setDestinationAddressId("");
      setQuantity("");
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Falha de comunicação ao transferir o estoque.",
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
            Movimentação interna
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Transfira saldo entre endereços do armazém com rastreabilidade completa de origem,
            destino, operador e quantidade.
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
          Transferência
        </span>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.6fr_1.1fr_0.8fr]">
          <FancySelectInput
            label="Depositante"
            name="depositanteId"
            value={depositanteId}
            onChange={(value) => {
              setDepositanteId(value);
              setStockId("");
              setDestinationAddressId("");
            }}
            options={depositantes}
            disabled={!canSelectDepositante}
          />

          <FancySelectInput
            label="Saldo de origem"
            name="stockId"
            value={stockId}
            onChange={setStockId}
            options={
              filteredSources.length
                ? filteredSources.map((item) => ({ value: item.value, label: item.label }))
                : [{ value: "", label: "Nenhum saldo disponível para transferir" }]
            }
            disabled={!filteredSources.length}
          />

          <FancySelectInput
            label="Endereço de destino"
            name="destinationAddressId"
            value={destinationAddressId}
            onChange={setDestinationAddressId}
            options={
              destinationOptions.length
                ? destinationOptions
                : [{ value: "", label: "Selecione um saldo de origem primeiro" }]
            }
            disabled={!selectedSource || !destinationOptions.length}
          />

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Quantidade
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Ex.: 12"
              className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-slate-500"
            />
          </label>
        </div>

        {selectedSource ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-200">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="font-medium">Origem selecionada:</span>
              <span>{selectedSource.label}</span>
            </div>
          </div>
        ) : null}

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
            disabled={isSubmitting}
            className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            <MoveRight className="h-4 w-4" />
            {isSubmitting ? "Transferindo..." : "Transferir estoque"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function formatAreaLabel(area: string) {
  switch (area) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Pulmão";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "Expedição";
    default:
      return area;
  }
}
