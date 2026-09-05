"use client";

import { useActionState, useEffect } from "react";
import {
  criarContaPagarAction,
  type ContaPagarActionState,
} from "@/app/(dashboard)/financeiro/contas-a-pagar/actions";

const CATEGORIAS = ["Aluguel", "Energia", "Insumos", "Serviços", "Impostos", "Outros"];

const initialState: ContaPagarActionState = { success: false, message: null };

const inputClass =
  "h-11 w-full rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-200";
// Textarea fica de fora do arredondamento em pílula (mesmo padrão já usado em
// depositante-form.tsx) -- uma caixa multi-linha não fica bem 100% redonda.
const textareaClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-200";
const labelClass = "mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300";

export function ContaPagarForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action] = useActionState(criarContaPagarAction, initialState);

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={action} className="space-y-4">
      {state.message && !state.success && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {state.message}
        </div>
      )}

      <label className="block">
        <span className={labelClass}>Fornecedor</span>
        <input type="text" name="fornecedor" required placeholder="Ex: Locadora Prime" className={inputClass} />
      </label>

      <label className="block">
        <span className={labelClass}>Descrição</span>
        <input
          type="text"
          name="descricao"
          required
          placeholder="Ex: Aluguel do galpão — set/2026"
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Categoria</span>
          <select name="categoria" defaultValue="" className={inputClass}>
            <option value="">Selecione...</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Vencimento</span>
          <input type="date" name="vencimento" required className={inputClass} />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Valor (R$)</span>
        <input type="number" name="valor" step="0.01" min="0.01" required placeholder="0,00" className={inputClass} />
      </label>

      <label className="block">
        <span className={labelClass}>Observações</span>
        <textarea name="observacoes" rows={2} className={textareaClass + " resize-none py-2.5"} />
      </label>

      <button
        type="submit"
        className="conta-pagar-submit-btn h-11 w-full rounded-full text-sm font-extrabold text-white"
      >
        Cadastrar conta a pagar
      </button>
      <style jsx>{`
        .conta-pagar-submit-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
          background-size: 220% 100%;
          background-position: 0% 50%;
          box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
          transition:
            background-position 0.6s ease,
            transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.3s ease;
        }
        .conta-pagar-submit-btn:hover:not(:disabled) {
          background-position: 100% 50%;
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
        }
      `}</style>
    </form>
  );
}
