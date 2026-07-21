"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FancySelectInput, type FancySelectOption } from "@/components/ui/fancy-select-input";

type AddressBulkGeneratorFormProps = {
  action: (formData: FormData) => void;
};

const areaOptions: FancySelectOption[] = [
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Armazenagem" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "Expedição" },
];

const unidadeOptions: FancySelectOption[] = [
  { value: "UNIDADE", label: "Unidade" },
  { value: "CAIXA", label: "Caixa" },
  { value: "PALLET", label: "Pallet" },
];

export function AddressBulkGeneratorForm({ action }: AddressBulkGeneratorFormProps) {
  const [area, setÁrea] = useState("PULMAO");
  const [unidadePadrao, setUnidadePadrao] = useState("CAIXA");

  return (
    <form action={action} className="mt-5 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <FancySelectInput
          label="Área"
          name="area"
          value={area}
          onChange={setÁrea}
          options={areaOptions}
        />
        <Field
          label="Descrição base"
          name="descricaoBase"
          defaultValue=""
          placeholder="Ex.: Picking fracionado"
        />
        <FancySelectInput
          label="Unidade padrão"
          name="unidadePadrao"
          value={unidadePadrao}
          onChange={setUnidadePadrao}
          options={unidadeOptions}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <RangeField prefixLabel="Corredor" prefixName="corredorPrefixo" startName="corredorInicio" endName="corredorFim" defaultPrefix="R" />
        <RangeField prefixLabel="Módulo" prefixName="moduloPrefixo" startName="moduloInicio" endName="moduloFim" defaultPrefix="M" />
        <RangeField prefixLabel="Nível" prefixName="nivelPrefixo" startName="nivelInicio" endName="nivelFim" defaultPrefix="N" />
        <RangeField prefixLabel="Posição" prefixName="posicaoPrefixo" startName="posicaoInicio" endName="posicaoFim" defaultPrefix="P" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Capacidade máxima"
          name="capacidadeMaxima"
          defaultValue=""
          placeholder="Ex.: 100"
        />
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:mt-7 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          <input type="checkbox" name="ativo" defaultChecked className="h-4 w-4 rounded accent-cyan-500" />
          Gerar endereços já ativos
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        O código será montado automaticamente no padrão{" "}
        <strong>ÁREA-CORREDOR-MÓDULO-NÍVEL-POSIÇÃO</strong>, por exemplo:{" "}
        <strong>PICK-R01-M01-N01-P01</strong>.
      </div>

      <Button type="submit" size="lg" className="rounded-xl px-5 shadow-[0_8px_24px_rgba(34,211,238,0.18)]">
        Gerar endereços
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
      <span className="font-medium">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-white/[0.07]"
      />
    </label>
  );
}

function RangeField({
  prefixLabel,
  prefixName,
  startName,
  endName,
  defaultPrefix,
}: {
  prefixLabel: string;
  prefixName: string;
  startName: string;
  endName: string;
  defaultPrefix: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{prefixLabel}</p>
      <div className="mt-3 grid gap-3">
        <Field label="Prefixo" name={prefixName} defaultValue={defaultPrefix} placeholder={defaultPrefix} />
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium">Início</span>
            <input
              type="number"
              min={1}
              name={startName}
              defaultValue={1}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:bg-white/[0.07]"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium">Fim</span>
            <input
              type="number"
              min={1}
              name={endName}
              defaultValue={1}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:bg-white/[0.07]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
