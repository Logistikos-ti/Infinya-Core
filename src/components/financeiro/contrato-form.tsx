"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  saveContratoAction,
  type ContratoActionState,
} from "@/app/(dashboard)/financeiro/contratos/actions";

type Depositante = { id: string; nome: string };

type ContratoEdit = {
  id: string;
  depositante_id: string;
  taxa_fulfillment: number;
  minimo_fulfillment: number;
  tarifa_posicao: number;
  valor_ponto_coleta: number;
  valor_impressao_nf: number;
  taxa_frete_fixa: number;
  taxa_frete_percentual: number;
  tarifa_recebimento: number;
  valor_logistica_reversa: number;
  valor_software: number;
  qtd_refrigeradores: number;
  valor_unitario_refrigerador: number;
  tipo_contrato: string;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  observacoes: string | null;
  ativo: boolean;
};

const initialState: ContratoActionState = { success: true, message: null };

export function ContratoForm({
  depositantes,
  currentEditItem,
}: {
  depositantes: Depositante[];
  currentEditItem: ContratoEdit | null;
}) {
  const [state, action] = useActionState(saveContratoAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {currentEditItem && <input type="hidden" name="id" value={currentEditItem.id} />}

      {state.message && !state.success && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {state.message}
        </div>
      )}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Depositante</span>
        {currentEditItem ? (
          <>
            <input type="hidden" name="depositante_id" value={currentEditItem.depositante_id} />
            <p className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 pt-2.5 text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              {depositantes.find((d) => d.id === currentEditItem.depositante_id)?.nome ?? "—"}
            </p>
          </>
        ) : (
          <select
            name="depositante_id"
            required
            defaultValue=""
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="" disabled>Selecione...</option>
            {depositantes.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
        )}
        {state.errors?.depositante_id && <p className="mt-1 text-xs text-rose-600">{state.errors.depositante_id}</p>}
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Tipo de contrato</span>
        <select
          name="tipo_contrato"
          defaultValue={currentEditItem?.tipo_contrato ?? "padrao"}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="padrao">Padrão</option>
          <option value="consignado">Consignado</option>
        </select>
      </label>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-700">
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Expedição</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumericField
            label="Taxa fulfillment (%)"
            name="taxa_fulfillment"
            defaultValue={((currentEditItem?.taxa_fulfillment ?? 0.09) * 100).toFixed(1)}
            step="0.1"
            help="Percentual sobre valor NF"
            error={state.errors?.taxa_fulfillment}
            isPercent
          />
          <NumericField
            label="Mínimo fulfillment (R$)"
            name="minimo_fulfillment"
            defaultValue={String(currentEditItem?.minimo_fulfillment ?? 4.90)}
            step="0.01"
            error={state.errors?.minimo_fulfillment}
          />
          <NumericField
            label="Ponto de coleta (R$)"
            name="valor_ponto_coleta"
            defaultValue={String(currentEditItem?.valor_ponto_coleta ?? 1.50)}
            step="0.01"
            error={state.errors?.valor_ponto_coleta}
          />
          <NumericField
            label="Impressão NF (R$)"
            name="valor_impressao_nf"
            defaultValue={String(currentEditItem?.valor_impressao_nf ?? 0.50)}
            step="0.01"
            error={state.errors?.valor_impressao_nf}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-700">
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Frete</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumericField
            label="Taxa fixa (R$)"
            name="taxa_frete_fixa"
            defaultValue={String(currentEditItem?.taxa_frete_fixa ?? 3.00)}
            step="0.01"
            error={state.errors?.taxa_frete_fixa}
          />
          <NumericField
            label="Taxa percentual (%)"
            name="taxa_frete_percentual"
            defaultValue={((currentEditItem?.taxa_frete_percentual ?? 0.10) * 100).toFixed(1)}
            step="0.1"
            help="Sobre valor do frete"
            error={state.errors?.taxa_frete_percentual}
            isPercent
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-700">
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Armazenamento, recebimento e reversa</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumericField
            label="Tarifa posição/mês (R$)"
            name="tarifa_posicao"
            defaultValue={String(currentEditItem?.tarifa_posicao ?? 90.00)}
            step="0.01"
            error={state.errors?.tarifa_posicao}
          />
          <NumericField
            label="Tarifa recebimento/un (R$)"
            name="tarifa_recebimento"
            defaultValue={String(currentEditItem?.tarifa_recebimento ?? 0.00)}
            step="0.01"
            error={state.errors?.tarifa_recebimento}
          />
          <NumericField
            label="Logística reversa/un (R$)"
            name="valor_logistica_reversa"
            defaultValue={String(currentEditItem?.valor_logistica_reversa ?? 0.00)}
            step="0.01"
            help="Cobrado por unidade devolvida"
            error={state.errors?.valor_logistica_reversa}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-700">
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Mensalidades</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumericField
            label="Software/mês (R$)"
            name="valor_software"
            defaultValue={String(currentEditItem?.valor_software ?? 0.00)}
            step="0.01"
            error={state.errors?.valor_software}
          />
          <NumericField
            label="Qtd refrigeradores"
            name="qtd_refrigeradores"
            defaultValue={String(currentEditItem?.qtd_refrigeradores ?? 0)}
            step="1"
            error={state.errors?.qtd_refrigeradores}
          />
          <NumericField
            label="Valor unit. refrigerador (R$)"
            name="valor_unitario_refrigerador"
            defaultValue={String(currentEditItem?.valor_unitario_refrigerador ?? 0.00)}
            step="0.01"
            error={state.errors?.valor_unitario_refrigerador}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Início vigência</span>
          <input
            type="date"
            name="vigencia_inicio"
            defaultValue={currentEditItem?.vigencia_inicio ?? ""}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Fim vigência</span>
          <input
            type="date"
            name="vigencia_fim"
            defaultValue={currentEditItem?.vigencia_fim ?? ""}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Observações</span>
        <textarea
          name="observacoes"
          rows={3}
          defaultValue={currentEditItem?.observacoes ?? ""}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
      </label>

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={currentEditItem?.ativo ?? true}
          className="h-4 w-4 rounded"
        />
        Contrato ativo
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          {currentEditItem ? "Salvar alterações" : "Criar contrato"}
        </Button>
        {currentEditItem && (
          <Link
            href="/financeiro/contratos"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar edição
          </Link>
        )}
      </div>
    </form>
  );
}

function NumericField({
  label,
  name,
  defaultValue,
  step,
  help,
  error,
  isPercent,
}: {
  label: string;
  name: string;
  defaultValue: string;
  step: string;
  help?: string;
  error?: string;
  isPercent?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">{label}</span>
      {isPercent ? (
        <PercentInput name={name} defaultValue={defaultValue} step={step} />
      ) : (
        <input
          type="number"
          name={name}
          defaultValue={defaultValue}
          step={step}
          min="0"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
      )}
      {help && <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-zinc-500">{help}</span>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </label>
  );
}

function PercentInput({
  name,
  defaultValue,
  step,
}: {
  name: string;
  defaultValue: string;
  step: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        defaultValue={defaultValue}
        step={step}
        min="0"
        max="100"
        onChange={(e) => {
          const hidden = e.target.parentElement?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
          if (hidden) hidden.value = String(Number(e.target.value) / 100);
        }}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
      <input type="hidden" name={name} defaultValue={String(Number(defaultValue) / 100)} />
    </div>
  );
}
