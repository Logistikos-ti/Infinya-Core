"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
};

type ProductFiltersFormProps = {
  searchTerm: string;
  depositante: string;
  status: string;
  metodo: string;
  unidade: string;
  perPage: string;
  depositantes: Option[];
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
      className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.9fr_auto]">
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Busca
          </span>
          <div className="flex h-[52px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-[0_10px_35px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-950">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              name="q"
              defaultValue={searchTerm}
              placeholder="Nome, SKU, código interno ou EAN"
              className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
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
          <Button type="submit" className="h-[52px] bg-slate-950 px-5 text-white hover:bg-slate-800">
            Filtrar
          </Button>
          <Link
            href="/configuracoes/produtos"
            className="inline-flex h-[52px] items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  );
}

type FancySelectInputProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
};

function FancySelectInput({
  label,
  name,
  value,
  onChange,
  options,
}: FancySelectInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="space-y-1" ref={containerRef}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-[52px] w-full items-center justify-between rounded-2xl border bg-white px-4 text-left text-sm text-slate-950 outline-none transition",
          "border-slate-200 shadow-[0_10px_35px_rgba(15,23,42,0.04)] hover:border-cyan-300 hover:shadow-[0_12px_35px_rgba(34,211,238,0.10)]",
          "focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_12px_35px_rgba(34,211,238,0.12)] dark:focus-visible:ring-cyan-900/40",
        )}
      >
        <span className="truncate">{selectedOption?.label ?? "Selecionar"}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-500 transition-transform dark:text-slate-300",
            open ? "rotate-180" : "",
          )}
        />
      </button>

      {open ? (
        <div className="relative">
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_60px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-950">
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={`${name}-${option.value}`}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition",
                    selected
                      ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900",
                  )}
                >
                  <span>{option.label}</span>
                  {selected ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
