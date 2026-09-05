"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
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
  "w-full rounded-full border border-slate-200 bg-slate-50 px-[11px] py-[9px] text-[13px] font-medium text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-100";

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
  const [categoria, setCategoria] = useState(currentEditItem?.categoria ?? CATEGORIA_OPTIONS[0]);
  const [unidade, setUnidade] = useState(currentEditItem?.unidade ?? "un");

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
          <input type="hidden" name="categoria" value={categoria} />
          <PillSelect
            value={categoria}
            onChange={setCategoria}
            options={CATEGORIA_OPTIONS.map((c) => ({ value: c, label: c }))}
            className="w-full"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidade">
          <input type="hidden" name="unidade" value={unidade} />
          <PillSelect
            value={unidade}
            onChange={setUnidade}
            options={UNIDADE_OPTIONS.map((u) => ({ value: u, label: u }))}
            className="w-full"
          />
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
            className="h-10 rounded-full border border-slate-200 px-[18px] text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="insumo-save-btn inline-flex h-10 items-center justify-center gap-2 rounded-full px-[22px] text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {isPending ? <MobileButtonSpinner size={20} /> : currentEditItem ? "Salvar alterações" : "Cadastrar"}
        </button>
        <style jsx>{`
          .insumo-save-btn {
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
            background-size: 220% 100%;
            background-position: 0% 50%;
            box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
            transition:
              background-position 0.6s ease,
              transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.3s ease;
          }
          .insumo-save-btn:hover:not(:disabled) {
            background-position: 100% 50%;
            transform: translateY(-3px);
            box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
          }
        `}</style>
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
  const [depositanteId, setDepositanteId] = useState("");
  const [insumoId, setInsumoId] = useState("");

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
        <input type="hidden" name="depositante_id" value={depositanteId} required />
        <PillSelect
          value={depositanteId}
          onChange={setDepositanteId}
          placeholder="Selecione..."
          options={depositantes.map((d) => ({ value: d.id, label: d.nome }))}
          className="w-full"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">Insumo</span>
        <input type="hidden" name="insumo_id" value={insumoId} required />
        <PillSelect
          value={insumoId}
          onChange={setInsumoId}
          placeholder="Selecione..."
          options={insumos.map((i) => ({
            value: i.id,
            label: `${i.nome} — R$ ${Number(i.preco_unitario).toFixed(2)}/${i.unidade}`,
          }))}
          className="w-full"
        />
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
          className="h-11 w-full rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
      </label>

      <Button type="submit" className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600">
        Cobrar insumo
      </Button>
    </form>
  );
}
