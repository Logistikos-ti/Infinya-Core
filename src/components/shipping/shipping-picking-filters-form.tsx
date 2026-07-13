"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FancySelectInput,
  type FancySelectOption,
} from "@/components/ui/fancy-select-input";

type ShippingPickingFiltersFormProps = {
  status: string;
  operador: string;
  depositante: string;
  perPage: string;
  canSelectDepositante: boolean;
  statusOptions: FancySelectOption[];
  operatorOptions: FancySelectOption[];
  depositanteOptions: FancySelectOption[];
};

export function ShippingPickingFiltersForm({
  status,
  operador,
  depositante,
  perPage,
  canSelectDepositante,
  statusOptions,
  operatorOptions,
  depositanteOptions,
}: ShippingPickingFiltersFormProps) {
  const [statusValue, setStatusValue] = useState(status);
  const [operatorValue, setOperatorValue] = useState(operador);
  const [depositanteValue, setDepositanteValue] = useState(depositante);
  const [perPageValue, setPerPageValue] = useState(perPage);

  return (
    <form
      method="get"
      action="/expedicao/separacao"
      className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_0.8fr_auto] items-end">
        <FancySelectInput
          label="Status"
          name="status"
          value={statusValue}
          onChange={setStatusValue}
          options={statusOptions}
        />

        <FancySelectInput
          label="Operador"
          name="operador"
          value={operatorValue}
          onChange={setOperatorValue}
          options={operatorOptions}
        />

        <FancySelectInput
          label="Depositante"
          name="depositante"
          value={depositanteValue}
          onChange={setDepositanteValue}
          options={depositanteOptions}
          disabled={!canSelectDepositante}
        />

        <FancySelectInput
          label="Pagina"
          name="perPage"
          value={perPageValue}
          onChange={setPerPageValue}
          options={[
            { value: "10", label: "10 / pagina" },
            { value: "20", label: "20 / pagina" },
            { value: "50", label: "50 / pagina" },
          ]}
        />

        <div className="flex items-end gap-2">
          <Button
            type="submit"
            className="h-[52px] bg-slate-950 px-5 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            Filtrar
          </Button>
          <Link
            href="/expedicao/separacao"
            className="inline-flex h-[52px] items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  );
}
