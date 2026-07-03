"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FancySelectInput,
  type FancySelectOption,
} from "@/components/ui/fancy-select-input";

type StockFiltersFormProps = {
  depositante: string;
  produto: string;
  area: string;
  lote: string;
  canSelectDepositante: boolean;
  depositantes: FancySelectOption[];
  areas: FancySelectOption[];
};

export function StockFiltersForm({
  depositante,
  produto,
  area,
  lote,
  canSelectDepositante,
  depositantes,
  areas,
}: StockFiltersFormProps) {
  const [depositanteValue, setDepositanteValue] = useState(depositante);
  const [areaValue, setAreaValue] = useState(area);

  return (
    <form
      method="get"
      action="/estoque"
      className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.3fr_0.9fr_1fr_auto]">
        <FancySelectInput
          label="Depositante"
          name="depositante"
          value={depositanteValue}
          onChange={setDepositanteValue}
          options={[{ value: "", label: "Todos" }, ...depositantes]}
          disabled={!canSelectDepositante}
        />

        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Produto
          </span>
          <div className="flex h-[52px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-[0_10px_35px_rgba(15,23,42,0.04)] dark:border-zinc-700 dark:bg-zinc-900">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              name="produto"
              defaultValue={produto}
              placeholder="SKU, nome ou código interno"
              className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
        </label>

        <FancySelectInput
          label="Área"
          name="area"
          value={areaValue}
          onChange={setAreaValue}
          options={areas}
        />

        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Lote
          </span>
          <input
            type="text"
            name="lote"
            defaultValue={lote}
            placeholder="Ex.: LOT-2026-001"
            className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 shadow-[0_10px_35px_rgba(15,23,42,0.04)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-slate-500"
          />
        </label>

        <div className="flex items-end gap-2">
          <Button
            type="submit"
            className="h-[52px] bg-slate-950 px-5 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            Filtrar
          </Button>
          <Link
            href="/estoque"
            className="inline-flex h-[52px] items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  );
}
