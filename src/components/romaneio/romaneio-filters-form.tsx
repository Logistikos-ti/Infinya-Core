"use client";

import { useState } from "react";
import { FancySelectInput, type FancySelectOption } from "@/components/ui/fancy-select-input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import Link from "next/link";

type RomaneioFiltersFormProps = {
  status: string;
  depositante: string;
  transportadora: string;
  dataInicial: string;
  dataFinal: string;
  statusOptions: FancySelectOption[];
  depositanteOptions: FancySelectOption[];
  disableDepositante?: boolean;
};

export function RomaneioFiltersForm({
  status,
  depositante,
  transportadora,
  dataInicial,
  dataFinal,
  statusOptions,
  depositanteOptions,
  disableDepositante = false,
}: RomaneioFiltersFormProps) {
  return (
    <form className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <FancySelectInputField
        label="Status do romaneio"
        name="status"
        initialValue={status}
        options={statusOptions}
      />

      <FancySelectInputField
        label="Depositante"
        name="depositante"
        initialValue={depositante}
        options={depositanteOptions}
        disabled={disableDepositante}
      />

      <label className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Transportadora
        </span>
        <input
          type="text"
          name="transportadora"
          defaultValue={transportadora}
          placeholder="Nome da transportadora"
          className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] transition hover:border-cyan-300 hover:shadow-[0_12px_35px_rgba(34,211,238,0.10)] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_12px_35px_rgba(34,211,238,0.12)] dark:focus:ring-cyan-900/40 dark:placeholder:text-slate-500"
        />
      </label>

      <DatePickerInput label="Data inicial" name="dataInicial" value={dataInicial} />
      <DatePickerInput label="Data final" name="dataFinal" value={dataFinal} />

      <div className="flex items-end gap-2 xl:col-span-5">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          Aplicar
        </button>
        <Link
          href="/romaneio"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Limpar
        </Link>
      </div>
    </form>
  );
}

function FancySelectInputField({
  label,
  name,
  initialValue,
  options,
  disabled = false,
}: {
  label: string;
  name: string;
  initialValue: string;
  options: FancySelectOption[];
  disabled?: boolean;
}) {
  return (
    <StatefulFancySelectInput
      label={label}
      name={name}
      initialValue={initialValue}
      options={options}
      disabled={disabled}
    />
  );
}

function StatefulFancySelectInput({
  label,
  name,
  initialValue,
  options,
  disabled,
}: {
  label: string;
  name: string;
  initialValue: string;
  options: FancySelectOption[];
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <FancySelectInput
      label={label}
      name={name}
      value={value}
      onChange={setValue}
      options={options}
      disabled={disabled}
    />
  );
}
