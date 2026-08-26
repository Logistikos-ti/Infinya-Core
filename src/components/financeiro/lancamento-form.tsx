"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  criarLancamentoManualAction,
  type LancamentoActionState,
} from "@/app/(dashboard)/financeiro/lancamentos/actions";

type Depositante = { id: string; nome: string };

const TIPOS_SERVICO = [
  { value: "COBRANCA_EXTRA", label: "Cobrança Extra" },
  { value: "DESCONTO", label: "Desconto" },
  { value: "INSUMO", label: "Insumo" },
  { value: "FULFILLMENT", label: "Fulfillment" },
  { value: "PONTO_COLETA", label: "Ponto de Coleta" },
  { value: "IMPRESSAO_NF", label: "Impressão NF" },
  { value: "GESTAO_FRETE", label: "Gestão de Frete" },
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "ARMAZENAMENTO", label: "Armazenamento" },
  { value: "LOGISTICA_REVERSA", label: "Logística Reversa" },
  { value: "SOFTWARE", label: "Software" },
  { value: "REFRIGERADOR", label: "Refrigerador" },
];

const initialState: LancamentoActionState = { success: true, message: null };

export function LancamentoForm({ depositantes }: { depositantes: Depositante[] }) {
  const [state, action] = useActionState(criarLancamentoManualAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {state.message && !state.success && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {state.message}
        </div>
      )}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Depositante</span>
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
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Tipo de serviço</span>
        <select
          name="tipo_servico"
          required
          defaultValue=""
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="" disabled>Selecione...</option>
          {TIPOS_SERVICO.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Descrição</span>
        <input
          type="text"
          name="descricao"
          required
          placeholder="Ex: Ajuste de cobrança ref. pedido #123"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Quantidade</span>
          <input
            type="number"
            name="quantidade"
            defaultValue="1"
            step="1"
            min="1"
            required
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Valor unitário (R$)</span>
          <input
            type="number"
            name="valor_unitario"
            step="0.01"
            required
            placeholder="0.00"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </label>
      </div>

      <Button type="submit" className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
        Criar lançamento
      </Button>
    </form>
  );
}
