"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatTransportadoraModalidade,
  TRANSPORTADORA_MODALIDADES,
  type TransportadoraListItem,
} from "@/lib/transportadoras";
import {
  saveTransportadoraAction,
  type TransportadoraActionState,
} from "@/app/(dashboard)/configuracoes/transportadoras/actions";

const initialState: TransportadoraActionState = {
  success: true,
  message: null,
};

export function TransportadoraForm({
  currentEditItem,
}: {
  currentEditItem: TransportadoraListItem | null;
}) {
  const [state, action] = useActionState(saveTransportadoraAction, initialState);

  return (
    <form action={action} className="mt-5 space-y-4">
      {currentEditItem ? <input type="hidden" name="id" value={currentEditItem.id} /> : null}

      {state.message && !state.success ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Nome fantasia"
          name="nome"
          required
          defaultValue={currentEditItem?.nome ?? ""}
          error={state.errors?.nome}
        />
        <Field
          label="Razão social"
          name="razaoSocial"
          required
          defaultValue={currentEditItem?.razaoSocial ?? ""}
          error={state.errors?.razaoSocial}
        />
        <Field
          label="CNPJ"
          name="cnpj"
          required
          defaultValue={currentEditItem?.cnpj ?? ""}
          error={state.errors?.cnpj}
        />
        <Field
          label="Telefone"
          name="telefone"
          defaultValue={currentEditItem?.telefone ?? ""}
          error={state.errors?.telefone}
        />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={currentEditItem?.email ?? ""}
          error={state.errors?.email}
          className="md:col-span-2"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-900">Modalidades</p>
        <p className="mt-1 text-xs text-slate-500">
          Selecione as modalidades que essa transportadora atende no seu fluxo.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {TRANSPORTADORA_MODALIDADES.map((modalidade) => (
            <label
              key={modalidade}
              className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name="modalidades"
                value={modalidade}
                defaultChecked={currentEditItem?.modalidades.includes(modalidade) ?? false}
                className="h-4 w-4 rounded"
              />
              {formatTransportadoraModalidade(modalidade)}
            </label>
          ))}
        </div>
        {state.errors?.modalidades ? (
          <p className="mt-2 text-xs text-rose-600">{state.errors.modalidades}</p>
        ) : null}
      </div>

      <Field label="Observações" name="observacoes" as="textarea" defaultValue={currentEditItem?.observacoes ?? ""} />

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={currentEditItem?.ativo ?? true}
          className="h-4 w-4 rounded"
        />
        Transportadora ativa para operação
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="bg-slate-950 text-white hover:bg-slate-800">
          {currentEditItem ? "Salvar alterações" : "Criar transportadora"}
        </Button>
        {currentEditItem ? (
          <Link
            href="/configuracoes/transportadoras"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar edição
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  error,
  type = "text",
  as = "input",
  required = false,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  type?: string;
  as?: "input" | "textarea";
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {as === "textarea" ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={5}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          defaultValue={defaultValue}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
        />
      )}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </label>
  );
}
