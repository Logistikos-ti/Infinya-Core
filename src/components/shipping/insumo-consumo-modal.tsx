"use client";

import { useEffect, useState } from "react";
import { Boxes, Building2, Ban, Plus, Trash2, X, Loader2 } from "lucide-react";
import {
  registrarConsumoInsumoAction,
  type InsumoConsumoChoice,
} from "@/app/(dashboard)/expedicao/conferencia/insumo-consumo-actions";
import type { InsumoConsumoOption } from "@/lib/billing";

type Origem = "GALPAO" | "DEPOSITANTE" | "NENHUM";

type GalpaoRow = { insumoId: string; quantidade: string };

type InsumoConsumoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  pedidoId: string;
  depositanteId: string;
  orderCode: string;
  customerName: string;
  catalogoGalpao: InsumoConsumoOption[];
  insumosDepositante: string[];
};

export function InsumoConsumoModal({
  isOpen,
  onClose,
  onConfirmed,
  pedidoId,
  depositanteId,
  orderCode,
  customerName,
  catalogoGalpao,
  insumosDepositante,
}: InsumoConsumoModalProps) {
  const [origem, setOrigem] = useState<Origem | null>(null);
  const [galpaoRows, setGalpaoRows] = useState<GalpaoRow[]>([{ insumoId: "", quantidade: "1" }]);
  const [depositanteSelecionados, setDepositanteSelecionados] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOrigem(null);
      setGalpaoRows([{ insumoId: "", quantidade: "1" }]);
      setDepositanteSelecionados([]);
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function updateGalpaoRow(index: number, patch: Partial<GalpaoRow>) {
    setGalpaoRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeGalpaoRow(index: number) {
    setGalpaoRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  }

  function toggleDepositanteInsumo(nome: string) {
    setDepositanteSelecionados((atual) =>
      atual.includes(nome) ? atual.filter((n) => n !== nome) : [...atual, nome],
    );
  }

  async function handleConfirm() {
    if (!origem) {
      setErrorMsg("Selecione uma opção.");
      return;
    }

    let choice: InsumoConsumoChoice;

    if (origem === "GALPAO") {
      const itens = galpaoRows
        .filter((r) => r.insumoId)
        .map((r) => ({ insumoId: r.insumoId, quantidade: Number(r.quantidade) || 0 }));
      if (!itens.length) {
        setErrorMsg("Selecione ao menos um insumo do galpão.");
        return;
      }
      if (itens.some((i) => i.quantidade <= 0)) {
        setErrorMsg("Informe uma quantidade válida para cada insumo.");
        return;
      }
      choice = { origem: "GALPAO", itens };
    } else if (origem === "DEPOSITANTE") {
      if (!depositanteSelecionados.length) {
        setErrorMsg("Selecione ao menos um insumo do depositante.");
        return;
      }
      choice = { origem: "DEPOSITANTE", nomes: depositanteSelecionados };
    } else {
      choice = { origem: "NENHUM" };
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await registrarConsumoInsumoAction(pedidoId, depositanteId, choice);

    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMsg(result.erro ?? "Erro ao registrar o consumo de insumo.");
      return;
    }

    onConfirmed();
  }

  const optionCardBase =
    "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors";
  const optionCardActive = "border-emerald-500/50 bg-emerald-500/10";
  const optionCardInactive = "border-white/10 bg-white/5 hover:bg-white/10";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={isSubmitting ? undefined : onClose} />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Insumo utilizado</h2>
              <p className="text-xs text-slate-400">
                Pedido <span className="font-semibold text-slate-200">{orderCode}</span> • {customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          <p className="text-sm text-slate-300">Você utilizou algum insumo para embalar este pedido?</p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setOrigem("GALPAO")}
              className={`${optionCardBase} ${origem === "GALPAO" ? optionCardActive : optionCardInactive}`}
            >
              <Boxes className="h-5 w-5 shrink-0 text-cyan-400" />
              <div>
                <p className="text-sm font-semibold text-white">Insumo do galpão</p>
                <p className="text-xs text-slate-400">Cobra o valor configurado no catálogo</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setOrigem("DEPOSITANTE")}
              className={`${optionCardBase} ${origem === "DEPOSITANTE" ? optionCardActive : optionCardInactive}`}
            >
              <Building2 className="h-5 w-5 shrink-0 text-violet-400" />
              <div>
                <p className="text-sm font-semibold text-white">Insumo do depositante</p>
                <p className="text-xs text-slate-400">Não gera cobrança</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setOrigem("NENHUM")}
              className={`${optionCardBase} ${origem === "NENHUM" ? optionCardActive : optionCardInactive}`}
            >
              <Ban className="h-5 w-5 shrink-0 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-white">Não usei insumo</p>
              </div>
            </button>
          </div>

          {origem === "GALPAO" && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              {catalogoGalpao.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum insumo ativo cadastrado no catálogo.</p>
              ) : (
                galpaoRows.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={row.insumoId}
                      onChange={(e) => updateGalpaoRow(index, { insumoId: e.target.value })}
                      className="h-10 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white"
                    >
                      <option value="">Selecione o insumo</option>
                      {catalogoGalpao.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome} ({i.unidade})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.quantidade}
                      onChange={(e) => updateGalpaoRow(index, { quantidade: e.target.value })}
                      className="h-10 w-20 rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeGalpaoRow(index)}
                      disabled={galpaoRows.length <= 1}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-rose-400 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
              <button
                type="button"
                onClick={() => setGalpaoRows((rows) => [...rows, { insumoId: "", quantidade: "1" }])}
                className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar outro insumo
              </button>
            </div>
          )}

          {origem === "DEPOSITANTE" && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              {insumosDepositante.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhum insumo cadastrado no contrato deste depositante.
                </p>
              ) : (
                insumosDepositante.map((nome) => (
                  <label
                    key={nome}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={depositanteSelecionados.includes(nome)}
                      onChange={() => toggleDepositanteInsumo(nome)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-900 text-violet-500"
                    />
                    <span className="text-sm text-slate-200">{nome}</span>
                  </label>
                ))
              )}
            </div>
          )}

          {errorMsg && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {errorMsg}
            </p>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!origem || isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
