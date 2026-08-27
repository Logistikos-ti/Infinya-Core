"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  saveInsumoAction,
  cobrarInsumoAction,
  type InsumoActionState,
} from "@/app/(dashboard)/financeiro/insumos/actions";
import { FIN_MONO } from "@/components/financeiro/fin-ui";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

type Depositante = { id: string; nome: string };

type InsumoEdit = {
  id: string;
  nome: string;
  sku: string | null;
  categoria: string | null;
  unidade: string;
  preco_unitario: number;
  estoque_inicial: number;
  estoque_minimo: number;
  fornecedor: string | null;
  ordem: number;
  ativo: boolean;
};

type InsumoCatalogo = {
  id: string;
  nome: string;
  unidade: string;
  preco_unitario: number;
};

const initialState: InsumoActionState = { success: false, message: null };

const inputBase =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-[11px] py-[9px] text-[13px] font-medium text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-100";

const CATEGORIA_OPTIONS = ["Embalagem", "Etiqueta", "Proteção", "Higiene", "Outros"];
const UNIDADE_OPTIONS = ["un", "rolo", "caixa", "kg", "L", "m"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-[11px] font-bold uppercase tracking-[.05em] text-slate-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export function InsumoForm({
  currentEditItem,
  onSuccess,
  onCancel,
}: {
  currentEditItem: InsumoEdit | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [state, action, isPending] = useActionState(saveInsumoAction, initialState);

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={action} className="flex flex-col gap-3.5">
      {currentEditItem && <input type="hidden" name="id" value={currentEditItem.id} />}
      <input type="hidden" name="ordem" value={String(currentEditItem?.ordem ?? 0)} />
      <input type="hidden" name="ativo" value={(currentEditItem?.ativo ?? true) ? "on" : "off"} />

      {state.message && !state.success && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {state.message}
        </div>
      )}

      <Field label="Nome do insumo">
        <input
          type="text"
          name="nome"
          required
          defaultValue={currentEditItem?.nome ?? ""}
          placeholder="Ex: Caixa papelão 40×30×30"
          className={inputBase}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU / Código">
          <input
            type="text"
            name="sku"
            defaultValue={currentEditItem?.sku ?? ""}
            placeholder="Ex: CX-40x30x30"
            className={`${inputBase} ${FIN_MONO}`}
          />
        </Field>
        <Field label="Categoria">
          <select name="categoria" defaultValue={currentEditItem?.categoria ?? CATEGORIA_OPTIONS[0]} className={inputBase}>
            {CATEGORIA_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidade">
          <select name="unidade" defaultValue={currentEditItem?.unidade ?? "un"} className={inputBase}>
            {UNIDADE_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </Field>
        <Field label="Custo unitário (R$)">
          <input
            type="number"
            name="preco_unitario"
            step="0.01"
            min="0.01"
            required
            defaultValue={String(currentEditItem?.preco_unitario ?? "")}
            placeholder="0,00"
            className={`${inputBase} ${FIN_MONO}`}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Estoque inicial">
          <input
            type="number"
            name="estoque_inicial"
            step="1"
            min="0"
            defaultValue={String(currentEditItem?.estoque_inicial ?? 0)}
            className={`${inputBase} ${FIN_MONO}`}
          />
        </Field>
        <Field label="Estoque mínimo">
          <input
            type="number"
            name="estoque_minimo"
            step="1"
            min="0"
            defaultValue={String(currentEditItem?.estoque_minimo ?? 0)}
            className={`${inputBase} ${FIN_MONO}`}
          />
        </Field>
      </div>

      <Field label="Fornecedor">
        <input
          type="text"
          name="fornecedor"
          defaultValue={currentEditItem?.fornecedor ?? ""}
          placeholder="Ex: Papel & Cia"
          className={inputBase}
        />
      </Field>

      <div className="mt-1 flex justify-end gap-2.5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-slate-200 px-[18px] text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-[22px] text-[13px] font-extrabold text-white transition hover:brightness-105 disabled:opacity-60"
        >
          {isPending ? <MobileButtonSpinner size={20} /> : currentEditItem ? "Salvar alterações" : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}

export function CobrarInsumoForm({
  depositantes,
  insumos,
  onSuccess,
}: {
  depositantes: Depositante[];
  insumos: InsumoCatalogo[];
  onSuccess?: () => void;
}) {
  const [state, action] = useActionState(cobrarInsumoAction, initialState);

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

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
