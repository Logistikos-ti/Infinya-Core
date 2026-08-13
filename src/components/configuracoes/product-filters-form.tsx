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
  categoria: string;
  perPage: string;
  depositantes: FancySelectOption[];
  categorias: FancySelectOption[];
};

export function ProductFiltersForm({
  searchTerm,
  depositante,
  status,
  metodo,
  unidade,
  categoria,
  perPage,
  depositantes,
  categorias,
}: ProductFiltersFormProps) {
  const [depositanteValue, setDepositanteValue] = useState(depositante);
  const [statusValue, setStatusValue] = useState(status);
  const [metodoValue, setMetodoValue] = useState(metodo);
  const [unidadeValue, setUnidadeValue] = useState(unidade);
  const [categoriaValue, setCategoriaValue] = useState(categoria);
  const [perPageValue, setPerPageValue] = useState(perPage);

  return (
    <form
      method="get"
      action="/configuracoes/produtos"
      className="flex flex-col gap-4 rounded-[20px] border border-slate-200/60 bg-white/60 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/40"
    >
      <div className="mb-1 flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-slate-100">
        <Filter className="h-4 w-4 text-violet-500" /> Filtros e busca
      </div>
      <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.9fr_0.9fr_auto]">
        <label className="flex-1 space-y-1.5">
          <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Busca rápida
          </span>
          <div className="flex h-[52px] items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 transition-colors focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 dark:border-slate-800 dark:bg-slate-950/50">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              name="q"
              defaultValue={searchTerm}
              placeholder="Nome, SKU, código interno ou EAN"
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
            { value: "ruptura", label: "Em ruptura" },
            { value: "baixo", label: "Estoque baixo" },
            { value: "todos", label: "Todos" },
          ]}
        />

        <FancySelectInput
          label="Método"
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

        <FancySelectInput
          label="Categoria"
          name="categoria"
          value={categoriaValue}
          onChange={setCategoriaValue}
          options={[{ value: "", label: "Todas" }, ...categorias]}
        />

        <div className="flex items-end gap-2">
          <FancySelectInput
            label="Página"
            name="perPage"
            value={perPageValue}
            onChange={setPerPageValue}
            options={[
              { value: "10", label: "10 / página" },
              { value: "20", label: "20 / página" },
              { value: "50", label: "50 / página" },
            ]}
          />
          <Button
            type="submit"
            className="h-[52px] rounded-2xl border-0 bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-bold text-white shadow-sm shadow-violet-500/20 hover:from-violet-700 hover:to-indigo-700"
          >
            Filtrar
          </Button>
          <Link
            href="/configuracoes/produtos"
            className="inline-flex h-[52px] items-center justify-center rounded-2xl border border-slate-200/60 bg-white/50 px-5 text-[14px] font-bold text-slate-700 shadow-sm transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  );
}
