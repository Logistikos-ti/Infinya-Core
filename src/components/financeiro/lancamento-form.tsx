"use client";

import { useActionState, useEffect, useState } from "react";
import {
  criarLancamentoManualAction,
  type LancamentoActionState,
} from "@/app/(dashboard)/financeiro/lancamentos/actions";
import { FIN_MONO } from "@/components/financeiro/fin-ui";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

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

const initialState: LancamentoActionState = { success: false, message: null };

const inputBase =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-[11px] py-[9px] text-[13px] font-medium text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-[11px] font-bold uppercase tracking-[.05em] text-slate-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function fmtTotal(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function LancamentoForm({
  depositantes,
  onSuccess,
  onCancel,
}: {
  depositantes: Depositante[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [state, action, isPending] = useActionState(criarLancamentoManualAction, initialState);
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const total = (Number(quantidade) || 0) * (Number(valorUnitario) || 0);

  return (
    <form action={action} className="flex flex-col gap-3.5">
      {state.message && !state.success && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Depositante">
          <select name="depositante_id" required defaultValue="" className={inputBase}>
            <option value="" disabled>Selecione…</option>
            {depositantes.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
        </Field>
        <Field label="Tipo de serviço">
          <select name="tipo_servico" required defaultValue="" className={inputBase}>
            <option value="" disabled>Selecione…</option>
            {TIPOS_SERVICO.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Descrição">
        <input
          type="text"
          name="descricao"
          placeholder="Opcional — detalhe do serviço"
          className={inputBase}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Quantidade">
          <input
            type="number"
            name="quantidade"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            step="1"
            min="1"
            required
            className={`${inputBase} ${FIN_MONO}`}
          />
        </Field>
        <Field label="Valor unitário (R$)">
          <input
            type="number"
            name="valor_unitario"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
            step="0.01"
            placeholder="0,00"
            required
            className={`${inputBase} ${FIN_MONO}`}
          />
        </Field>
        <Field label="Total">
          <div
            className={`${inputBase} ${FIN_MONO} flex items-center font-bold text-slate-900 dark:text-zinc-100`}
          >
            {fmtTotal(total)}
          </div>
        </Field>
      </div>

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
          {isPending ? <MobileButtonSpinner size={20} /> : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}
