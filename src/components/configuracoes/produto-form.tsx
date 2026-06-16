"use client";

import { useActionState } from "react";
import { saveProdutoAction } from "@/app/(dashboard)/configuracoes/produtos/actions";
import { Button } from "@/components/ui/button";

type DepositanteOption = {
  id: string;
  nome: string;
};

type ProdutoFormProps = {
  depositantes: DepositanteOption[];
  defaultValues?: {
    id?: string;
    depositanteId?: string;
    codigoInterno?: string;
    sku?: string;
    nome?: string;
    eanGtin?: string;
    categoria?: string;
    metodoRetirada?: "FEFO" | "FIFO" | "LIFO";
    unidadeEstocagem?: "UNIDADE" | "CAIXA" | "PALLET";
    exigeLote?: boolean;
    exigeValidade?: boolean;
    ativo?: boolean;
  };
};

export function ProdutoForm({ depositantes, defaultValues }: ProdutoFormProps) {
  const initialState = {
    success: false,
    message: null,
  };

  const [state, formAction, isPending] = useActionState(saveProdutoAction, initialState);

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          {defaultValues?.id ? "Editar produto" : "Novo produto"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Cadastro de SKU com depositante, EAN/GTIN, categoria, método de retirada e unidade de estocagem.
        </p>
      </div>

      <input type="hidden" name="id" value={defaultValues?.id ?? ""} />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <SelectField
          label="Depositante"
          name="depositanteId"
          defaultValue={defaultValues?.depositanteId ?? ""}
          error={state.errors?.depositanteId}
          options={[
            { value: "", label: "Selecione um depositante" },
            ...depositantes.map((item) => ({ value: item.id, label: item.nome })),
          ]}
        />
        <Field
          label="Código interno"
          name="codigoInterno"
          defaultValue={defaultValues?.codigoInterno ?? ""}
          error={state.errors?.codigoInterno}
        />
        <Field
          label="SKU"
          name="sku"
          defaultValue={defaultValues?.sku ?? ""}
          error={state.errors?.sku}
        />
        <Field
          label="Nome do produto"
          name="nome"
          defaultValue={defaultValues?.nome ?? ""}
          error={state.errors?.nome}
        />
        <Field
          label="EAN/GTIN"
          name="eanGtin"
          defaultValue={defaultValues?.eanGtin ?? ""}
          error={state.errors?.eanGtin}
        />
        <Field
          label="Categoria"
          name="categoria"
          defaultValue={defaultValues?.categoria ?? ""}
          error={state.errors?.categoria}
        />
        <SelectField
          label="Método de retirada"
          name="metodoRetirada"
          defaultValue={defaultValues?.metodoRetirada ?? "FEFO"}
          error={state.errors?.metodoRetirada}
          options={[
            { value: "FEFO", label: "FEFO" },
            { value: "FIFO", label: "FIFO" },
            { value: "LIFO", label: "LIFO" },
          ]}
        />
        <SelectField
          label="Unidade de estocagem"
          name="unidadeEstocagem"
          defaultValue={defaultValues?.unidadeEstocagem ?? "UNIDADE"}
          error={state.errors?.unidadeEstocagem}
          options={[
            { value: "UNIDADE", label: "Unidade" },
            { value: "CAIXA", label: "Caixa" },
            { value: "PALLET", label: "Pallet" },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <CheckboxField
          name="exigeLote"
          label="Controlar lote"
          description="Exige rastreabilidade de lote nas operações do produto."
          defaultChecked={defaultValues?.exigeLote ?? false}
        />
        <CheckboxField
          name="exigeValidade"
          label="Controlar validade"
          description="Ativa controle de validade e suporte ao FEFO quando necessário."
          defaultChecked={defaultValues?.exigeValidade ?? false}
        />
        <CheckboxField
          name="ativo"
          label="Produto ativo"
          description="Mantém o SKU disponível para recebimento, estoque e expedição."
          defaultChecked={defaultValues?.ativo ?? true}
        />
      </div>

      {state.message ? (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            state.success
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-slate-950 text-white hover:bg-slate-800"
        >
          {isPending ? "Salvando..." : defaultValues?.id ? "Salvar alterações" : "Criar produto"}
        </Button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
};

function Field({ label, name, defaultValue, error }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
      {error ? <span className="mt-2 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
  options: { value: string; label: string }[];
};

function SelectField({ label, name, defaultValue, error, options }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="mt-2 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

type CheckboxFieldProps = {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
};

function CheckboxField({
  name,
  label,
  description,
  defaultChecked,
}: CheckboxFieldProps) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      />
      <span>
        <span className="font-medium text-slate-950">{label}</span>
        <span className="mt-1 block text-slate-500">{description}</span>
      </span>
    </label>
  );
}
