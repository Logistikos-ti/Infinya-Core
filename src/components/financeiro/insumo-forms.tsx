"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  saveInsumoAction,
  cobrarInsumoAction,
  type InsumoActionState,
} from "@/app/(dashboard)/financeiro/insumos/actions";

type Depositante = { id: string; nome: string };

type InsumoEdit = {
  id: string;
  nome: string;
  unidade: string;
  preco_unitario: number;
  ordem: number;
  ativo: boolean;
};

type InsumoCatalogo = {
  id: string;
  nome: string;
  unidade: string;
  preco_unitario: number;
};

const initialState: InsumoActionState = { success: true, message: null };

export function InsumoForm({ currentEditItem }: { currentEditItem: InsumoEdit | null }) {
  const [state, action] = useActionState(saveInsumoAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {currentEditItem && <input type="hidden" name="id" value={currentEditItem.id} />}

      {state.message && !state.success && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {state.message}
        </div>
      )}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Nome</span>
        <input
          type="text"
          name="nome"
          required
          defaultValue={currentEditItem?.nome ?? ""}
          placeholder="Ex: Etiqueta térmica, Fita adesiva"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Unidade</span>
          <input
            type="text"
            name="unidade"
            defaultValue={currentEditItem?.unidade ?? "un"}
            placeholder="un"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Preço unit. (R$)</span>
          <input
            type="number"
            name="preco_unitario"
            step="0.01"
            min="0.01"
            required
            defaultValue={String(currentEditItem?.preco_unitario ?? "")}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Ordem</span>
          <input
            type="number"
            name="ordem"
            step="1"
            min="0"
            defaultValue={String(currentEditItem?.ordem ?? 0)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={currentEditItem?.ativo ?? true}
          className="h-4 w-4 rounded"
        />
        Insumo ativo
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          {currentEditItem ? "Salvar alterações" : "Cadastrar insumo"}
        </Button>
        {currentEditItem && (
          <Link
            href="/financeiro/insumos"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar edição
          </Link>
        )}
      </div>
    </form>
  );
}

export function CobrarInsumoForm({
  depositantes,
  insumos,
}: {
  depositantes: Depositante[];
  insumos: InsumoCatalogo[];
}) {
  const [state, action] = useActionState(cobrarInsumoAction, initialState);

  if (insumos.length === 0) return null;

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
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Insumo</span>
        <select
          name="insumo_id"
          required
          defaultValue=""
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="" disabled>Selecione...</option>
          {insumos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome} — R$ {Number(i.preco_unitario).toFixed(2)}/{i.unidade}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Quantidade</span>
        <input
          type="number"
          name="quantidade"
          step="1"
          min="1"
          defaultValue="1"
          required
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
      </label>

      <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
        Cobrar insumo
      </Button>
    </form>
  );
}
