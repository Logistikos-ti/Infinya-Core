"use client";

import { useState } from "react";
import Link from "next/link";
import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FancySelectInput,
  type FancySelectOption,
} from "@/components/ui/fancy-select-input";

type ProductFiltersFormProps = {
  searchTerm: string;
  depositante: string;
  status: string;
  metodo: string;
  unidade: string;
  perPage: string;
  depositantes: FancySelectOption[];
};

export function ProductFiltersForm({
  searchTerm,
  depositante,
  status,
  metodo,
  unidade,
  perPage,
  depositantes,
}: ProductFiltersFormProps) {
  const [depositanteValue, setDepositanteValue] = useState(depositante);
  const [statusValue, setStatusValue] = useState(status);
  const [metodoValue, setMetodoValue] = useState(metodo);
  const [unidadeValue, setUnidadeValue] = useState(unidade);
  const [perPageValue, setPerPageValue] = useState(perPage);

  return (
    <form
      method="get"
      action="/configuracoes/produtos"
      className="p-5 rounded-[20px] bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 shadow-sm backdrop-blur-md flex flex-col gap-4"
    >
      <div className="flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-slate-100 mb-1">
        <Filter className="w-4 h-4 text-violet-500" /> Filtros e Busca
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.9fr_auto] items-end">
        <label className="space-y-1.5 flex-1">
          <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Busca rápida
          </span>
          <div className="flex h-[52px] items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 dark:bg-slate-950/50 px-3 transition-colors focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 dark:border-slate-800">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              name="q"
              defaultValue={searchTerm}
              placeholder="Nome, SKU, codigo interno ou EAN"
              className="w-full border-0 bg-transparent text-[14px] font-medium outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
          </div>
        </label>

        <FancySelectInput
          label="Depositante"
          name="depositante"
          value={depositanteValue}
          onChange={setDepositanteValue}
          options={[{ value: "", label: "Todos" }, ...depositantes]}
        />

        <FancySelectInput
          label="Status"
          name="status"
          value={statusValue}
          onChange={setStatusValue}
          options={[
            { value: "ativos", label: "Ativos" },
            { value: "inativos", label: "Inativos" },
            { value: "todos", label: "Todos" },
          ]}
        />

        <FancySelectInput
          label="Metodo"
          name="metodo"
          value={metodoValue}
          onChange={setMetodoValue}
          options={[
            { value: "", label: "Todos" },
            { value: "FEFO", label: "FEFO" },
            { value: "FIFO", label: "FIFO" },
            { value: "LIFO", label: "LIFO" },
          ]}
        />

        <FancySelectInput
          label="Unidade"
          name="unidade"
          value={unidadeValue}
          onChange={setUnidadeValue}
          options={[
            { value: "", label: "Todas" },
            { value: "UNIDADE", label: "Unidade" },
            { value: "CAIXA", label: "Caixa" },
            { value: "PACK", label: "Pack" },
            { value: "PALLET", label: "Pallet" },
          ]}
        />

        <div className="flex items-end gap-2">
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
          <Button type="submit" className="h-[52px] rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-bold text-white hover:from-violet-700 hover:to-indigo-700 border-0 shadow-sm shadow-violet-500/20">
            Filtrar
          </Button>
          <Link
            href="/configuracoes/produtos"
            className="inline-flex h-[52px] items-center justify-center rounded-2xl border border-slate-200/60 bg-white/50 px-5 text-[14px] font-bold text-slate-700 transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800 shadow-sm"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  );
}
