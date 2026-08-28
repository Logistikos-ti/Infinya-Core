"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  saveContratoAction,
  type ContratoActionState,
} from "@/app/(dashboard)/financeiro/contratos/actions";
import { FIN_HEADING, FIN_MONO } from "@/components/financeiro/fin-ui";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

type Depositante = { id: string; nome: string };

type ContratoEdit = {
  id: string;
  depositante_id: string;
  taxa_fulfillment: number;
  minimo_fulfillment: number;
  tarifa_posicao: number;
  valor_ponto_coleta: number;
  valor_impressao_nf: number;
  valor_carta_correcao: number;
  valor_outro_documento: number;
  itens_inclusos: number;
  valor_item_adicional: number;
  taxa_frete_fixa: number;
  taxa_frete_percentual: number;
  tarifa_recebimento: number;
  tarifa_conferencia: number;
  valor_logistica_reversa: number;
  valor_cancelamento: number;
  valor_cancelamento_minimo: number;
  valor_retirada: number;
  valor_descarte: number;
  valor_software: number;
  qtd_refrigeradores: number;
  valor_unitario_refrigerador: number;
  tipo_contrato: string;
  responsavel: string | null;
  emails_cobranca: string[] | null;
  marketplaces_ponto_coleta: string[] | null;
  insumos_depositante: string[] | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  observacoes: string | null;
  ativo: boolean;
};

const initialState: ContratoActionState = { success: false, message: null };

const inputBase =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-[11px] py-[9px] text-[13px] font-medium text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#0E1728] dark:text-zinc-100";

const PONTO_COLETA_MARKETPLACES = [
  { key: "MERCADO_LIVRE", label: "Mercado Livre", keywords: ["mercado livre", "meli", "ml"] },
  { key: "SHOPEE", label: "Shopee", keywords: ["shopee"] },
  { key: "AMAZON", label: "Amazon", keywords: ["amazon"] },
  { key: "MAGALU", label: "Magalu", keywords: ["magalu"] },
  { key: "SHEIN", label: "Shein", keywords: ["shein"] },
  { key: "TIKTOK", label: "TikTok Shop", keywords: ["tiktok"] },
  { key: "KWAI", label: "Kwai", keywords: ["kwai"] },
  { key: "MAGAZINE_LUIZA", label: "Magazine Luiza", keywords: ["magazine luiza"] },
  { key: "OLIST", label: "Olist", keywords: ["olist"] },
] as const;
const PONTO_COLETA_DEFAULT_KEYS = ["MERCADO_LIVRE", "SHOPEE"];

export function ContratoForm({
  depositantes,
  currentEditItem,
  defaultDepositanteId,
  onSuccess,
  onClose,
}: {
  depositantes: Depositante[];
  currentEditItem: ContratoEdit | null;
  defaultDepositanteId?: string | null;
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const [state, action, isPending] = useActionState(saveContratoAction, initialState);
  const [ativo, setAtivo] = useState(currentEditItem?.ativo ?? true);
  const [usaRefri, setUsaRefri] = useState((currentEditItem?.qtd_refrigeradores ?? 0) > 0);
  const [usaSoftware, setUsaSoftware] = useState((currentEditItem?.valor_software ?? 0) > 0);
  const [usaFrete, setUsaFrete] = useState(
    currentEditItem ? currentEditItem.taxa_frete_fixa > 0 || currentEditItem.taxa_frete_percentual > 0 : true,
  );

  const [pontoColeta, setPontoColeta] = useState<Set<string>>(() => {
    const existing = currentEditItem?.marketplaces_ponto_coleta;
    if (existing) {
      return new Set(
        PONTO_COLETA_MARKETPLACES.filter((m) => m.keywords.some((kw) => existing.includes(kw))).map((m) => m.key),
      );
    }
    return new Set(PONTO_COLETA_DEFAULT_KEYS);
  });
  function togglePontoColeta(key: string) {
    setPontoColeta((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const initialEmails = currentEditItem?.emails_cobranca?.length ? currentEditItem.emails_cobranca : [""];
  const nextEmailId = useRef(initialEmails.length);
  const [emailRows, setEmailRows] = useState(() => initialEmails.map((value, id) => ({ id, value })));

  function addEmailRow() {
    setEmailRows((rows) => [...rows, { id: nextEmailId.current++, value: "" }]);
  }
  function removeEmailRow(id: number) {
    setEmailRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  const initialInsumos = currentEditItem?.insumos_depositante?.length ? currentEditItem.insumos_depositante : [""];
  const nextInsumoId = useRef(initialInsumos.length);
  const [insumoRows, setInsumoRows] = useState(() => initialInsumos.map((value, id) => ({ id, value })));

  function addInsumoRow() {
    setInsumoRows((rows) => [...rows, { id: nextInsumoId.current++, value: "" }]);
  }
  function removeInsumoRow(id: number) {
    setInsumoRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  useEffect(() => {
    if (state.success) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm" onClick={onClose}>
      <form
        action={action}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0C1526]"
      >
        {currentEditItem && <input type="hidden" name="id" value={currentEditItem.id} />}
        <input type="checkbox" name="ativo" checked={ativo} onChange={() => {}} className="hidden" />

        {/* Header */}
        <div className="flex items-center gap-3.5 border-b border-slate-200 px-6 pb-3.5 pt-[22px] dark:border-white/10">
          <div className="flex-1">
            <div className={`${FIN_HEADING} mb-1 text-[10px] font-bold uppercase tracking-[0.28em] text-violet-500`}>
              {currentEditItem ? "Contrato" : "Contratos"}
            </div>
            <h3 className={`${FIN_HEADING} text-xl font-bold text-slate-900 dark:text-zinc-100`}>
              {currentEditItem ? "Editar contrato" : "Novo contrato"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setAtivo((v) => !v)}
            className={`relative h-[30px] w-14 rounded-full border-none p-0 transition-colors ${
              ativo ? "bg-emerald-500" : "bg-slate-200 dark:bg-[#0E1728]"
            }`}
          >
            <span
              className="absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white shadow transition-transform"
              style={{ transform: ativo ? "translateX(26px)" : "translateX(0)" }}
            />
          </button>
          <span className={`text-[12.5px] font-bold ${ativo ? "text-emerald-500" : "text-slate-400 dark:text-zinc-500"}`}>
            {ativo ? "Ativo" : "Inativo"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-500 dark:border-white/10 dark:text-zinc-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state.message && !state.success && (
          <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            {state.message}
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-[18px]">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Depositante">
              {currentEditItem ? (
                <>
                  <input type="hidden" name="depositante_id" value={currentEditItem.depositante_id} />
                  <p className={`${inputBase} cursor-not-allowed text-slate-500 dark:text-zinc-400`}>
                    {depositantes.find((d) => d.id === currentEditItem.depositante_id)?.nome ?? "—"}
                  </p>
                </>
              ) : (
                <select name="depositante_id" required defaultValue={defaultDepositanteId ?? ""} className={inputBase}>
                  <option value="" disabled>Selecione…</option>
                  {depositantes.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              )}
              {state.errors?.depositante_id && <p className="mt-1 text-xs text-rose-600">{state.errors.depositante_id}</p>}
            </Field>
            <Field label="Tipo de contrato">
              <select name="tipo_contrato" defaultValue={currentEditItem?.tipo_contrato ?? "padrao"} className={inputBase}>
                <option value="padrao">Padrão</option>
                <option value="consignado">Consignado</option>
              </select>
            </Field>
          </div>

          <Field label="Responsável">
            <input
              type="text"
              name="responsavel"
              defaultValue={currentEditItem?.responsavel ?? ""}
              placeholder="Ex: Carlos Mendes"
              className={inputBase}
            />
          </Field>

          <Field label="E-mails para cobrança">
            <div className="flex flex-col gap-2">
              {emailRows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    type="email"
                    name="emails_cobranca"
                    defaultValue={row.value}
                    placeholder="financeiro@empresa.com"
                    className={`${inputBase} flex-1`}
                  />
                  {emailRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailRow(row.id)}
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-500 dark:border-white/10 dark:text-zinc-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addEmailRow}
                className="flex h-[34px] w-[34px] items-center justify-center self-start rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white transition hover:brightness-[1.06]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </Field>

          <Section title="Expedição">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taxa fulfillment (Ex: 0.09 = 9%)">
                <PercentInput name="taxa_fulfillment" defaultValue={((currentEditItem?.taxa_fulfillment ?? 0.09) * 100).toFixed(1)} step="0.1" />
                {state.errors?.taxa_fulfillment && <p className="mt-1 text-xs text-rose-600">{state.errors.taxa_fulfillment}</p>}
              </Field>
              <Field label="Mínimo fulfillment">
                <MoneyInput name="minimo_fulfillment" defaultValue={String(currentEditItem?.minimo_fulfillment ?? 4.9)} />
                {state.errors?.minimo_fulfillment && <p className="mt-1 text-xs text-rose-600">{state.errors.minimo_fulfillment}</p>}
              </Field>
              <Field label="Ponto de coleta">
                <MoneyInput name="valor_ponto_coleta" defaultValue={String(currentEditItem?.valor_ponto_coleta ?? 1.5)} />
                {state.errors?.valor_ponto_coleta && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_ponto_coleta}</p>}
              </Field>
              <Field label="Impressão NF">
                <MoneyInput name="valor_impressao_nf" defaultValue={String(currentEditItem?.valor_impressao_nf ?? 0.5)} />
                {state.errors?.valor_impressao_nf && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_impressao_nf}</p>}
              </Field>
              <Field label="Carta de correção (CC-e)">
                <MoneyInput name="valor_carta_correcao" defaultValue={String(currentEditItem?.valor_carta_correcao ?? 0)} />
                {state.errors?.valor_carta_correcao && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_carta_correcao}</p>}
              </Field>
              <Field label="Outro documento">
                <MoneyInput name="valor_outro_documento" defaultValue={String(currentEditItem?.valor_outro_documento ?? 0)} />
                {state.errors?.valor_outro_documento && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_outro_documento}</p>}
              </Field>
              <Field label="Itens inclusos no pedido">
                <input
                  type="number"
                  name="itens_inclusos"
                  defaultValue={String(currentEditItem?.itens_inclusos ?? 3)}
                  min="0"
                  step="1"
                  className={`${inputBase} ${FIN_MONO}`}
                />
                {state.errors?.itens_inclusos && <p className="mt-1 text-xs text-rose-600">{state.errors.itens_inclusos}</p>}
              </Field>
              <Field label="Item adicional/un">
                <MoneyInput name="valor_item_adicional" defaultValue={String(currentEditItem?.valor_item_adicional ?? 0)} />
                {state.errors?.valor_item_adicional && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_item_adicional}</p>}
              </Field>
            </div>
          </Section>

          <Section title="Insumos do depositante">
            <Field label="Insumos que o depositante disponibiliza (não cobra)">
              <div className="flex flex-col gap-2">
                {insumoRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      name="insumos_depositante"
                      defaultValue={row.value}
                      placeholder="Ex: Caixa personalizada"
                      className={`${inputBase} flex-1`}
                    />
                    {insumoRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInsumoRow(row.id)}
                        className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-500 dark:border-white/10 dark:text-zinc-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addInsumoRow}
                  className="flex h-[34px] w-[34px] items-center justify-center self-start rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white transition hover:brightness-[1.06]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </Field>
          </Section>

          <Section title="Ponto de coleta">
            <div className="grid grid-cols-3 gap-2.5">
              {PONTO_COLETA_MARKETPLACES.map((m) => (
                <label
                  key={m.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0E1728]"
                >
                  <input
                    type="checkbox"
                    checked={pontoColeta.has(m.key)}
                    onChange={() => togglePontoColeta(m.key)}
                    className="h-4 w-4 accent-violet-500"
                  />
                  <span className="text-[12.5px] font-semibold text-slate-700 dark:text-zinc-300">{m.label}</span>
                </label>
              ))}
            </div>
            {[...pontoColeta].flatMap((key) => PONTO_COLETA_MARKETPLACES.find((m) => m.key === key)?.keywords ?? []).map((kw, i) => (
              <input key={`${kw}-${i}`} type="hidden" name="marketplaces_ponto_coleta" value={kw} />
            ))}
          </Section>

          <Section title="Frete">
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={usaFrete}
                  onChange={(e) => setUsaFrete(e.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                <span className="text-[13px] font-bold text-slate-900 dark:text-zinc-100">Cobra frete?</span>
              </label>
              {usaFrete ? (
                <div className="grid grid-cols-2 gap-3 pl-[26px]">
                  <Field label="Taxa fixa">
                    <MoneyInput name="taxa_frete_fixa" defaultValue={String(currentEditItem ? currentEditItem.taxa_frete_fixa : 3)} />
                    {state.errors?.taxa_frete_fixa && <p className="mt-1 text-xs text-rose-600">{state.errors.taxa_frete_fixa}</p>}
                  </Field>
                  <Field label="Taxa percentual">
                    <PercentInput name="taxa_frete_percentual" defaultValue={((currentEditItem ? currentEditItem.taxa_frete_percentual : 0.1) * 100).toFixed(1)} step="0.1" />
                    {state.errors?.taxa_frete_percentual && <p className="mt-1 text-xs text-rose-600">{state.errors.taxa_frete_percentual}</p>}
                  </Field>
                </div>
              ) : (
                <>
                  <input type="hidden" name="taxa_frete_fixa" value="0" />
                  <input type="hidden" name="taxa_frete_percentual" value="0" />
                </>
              )}
            </div>
          </Section>

          <Section title="Armazenamento, recebimento e reversa">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Tarifa posição/mês">
                <MoneyInput name="tarifa_posicao" defaultValue={String(currentEditItem?.tarifa_posicao ?? 90)} />
                {state.errors?.tarifa_posicao && <p className="mt-1 text-xs text-rose-600">{state.errors.tarifa_posicao}</p>}
              </Field>
              <Field label="Tarifa recebimento/un">
                <MoneyInput name="tarifa_recebimento" defaultValue={String(currentEditItem?.tarifa_recebimento ?? 0)} />
                {state.errors?.tarifa_recebimento && <p className="mt-1 text-xs text-rose-600">{state.errors.tarifa_recebimento}</p>}
              </Field>
              <Field label="Conferência unitária/un">
                <MoneyInput name="tarifa_conferencia" defaultValue={String(currentEditItem?.tarifa_conferencia ?? 0)} />
                {state.errors?.tarifa_conferencia && <p className="mt-1 text-xs text-rose-600">{state.errors.tarifa_conferencia}</p>}
              </Field>
              <Field label="Logística reversa/un">
                <MoneyInput name="valor_logistica_reversa" defaultValue={String(currentEditItem?.valor_logistica_reversa ?? 0)} />
                {state.errors?.valor_logistica_reversa && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_logistica_reversa}</p>}
              </Field>
              <Field label="Cancelamento/item">
                <MoneyInput name="valor_cancelamento" defaultValue={String(currentEditItem?.valor_cancelamento ?? 0)} />
                {state.errors?.valor_cancelamento && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_cancelamento}</p>}
              </Field>
              <Field label="Cancelamento (mínimo)">
                <MoneyInput name="valor_cancelamento_minimo" defaultValue={String(currentEditItem?.valor_cancelamento_minimo ?? 0)} />
                {state.errors?.valor_cancelamento_minimo && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_cancelamento_minimo}</p>}
              </Field>
              <Field label="Retirada/un (vencidos)">
                <MoneyInput name="valor_retirada" defaultValue={String(currentEditItem?.valor_retirada ?? 0)} />
                {state.errors?.valor_retirada && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_retirada}</p>}
              </Field>
              <Field label="Descarte/un (vencidos)">
                <MoneyInput name="valor_descarte" defaultValue={String(currentEditItem?.valor_descarte ?? 0)} />
                {state.errors?.valor_descarte && <p className="mt-1 text-xs text-rose-600">{state.errors.valor_descarte}</p>}
              </Field>
            </div>
          </Section>

          <Section title="Mensalidades">
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={usaRefri}
                  onChange={(e) => setUsaRefri(e.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                <span className="text-[13px] font-bold text-slate-900 dark:text-zinc-100">Usa refrigerador?</span>
              </label>
              {usaRefri ? (
                <div className="grid grid-cols-2 gap-3 pl-[26px]">
                  <Field label="Quantidade de refrigeradores">
                    <input
                      type="number"
                      name="qtd_refrigeradores"
                      defaultValue={String(currentEditItem?.qtd_refrigeradores ?? 1)}
                      min="0"
                      step="1"
                      className={`${inputBase} ${FIN_MONO}`}
                    />
                  </Field>
                  <Field label="Valor por refrigerador">
                    <MoneyInput name="valor_unitario_refrigerador" defaultValue={String(currentEditItem?.valor_unitario_refrigerador ?? 0)} />
                  </Field>
                </div>
              ) : (
                <>
                  <input type="hidden" name="qtd_refrigeradores" value="0" />
                  <input type="hidden" name="valor_unitario_refrigerador" value="0" />
                </>
              )}

              <label className="mt-1 flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={usaSoftware}
                  onChange={(e) => setUsaSoftware(e.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                <span className="text-[13px] font-bold text-slate-900 dark:text-zinc-100">Software</span>
              </label>
              {usaSoftware ? (
                <div className="max-w-[280px] pl-[26px]">
                  <Field label="Valor mensal do software">
                    <MoneyInput name="valor_software" defaultValue={String(currentEditItem?.valor_software ?? 0)} />
                  </Field>
                </div>
              ) : (
                <input type="hidden" name="valor_software" value="0" />
              )}
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Início de vigência">
              <input
                type="date"
                name="vigencia_inicio"
                defaultValue={currentEditItem?.vigencia_inicio ?? ""}
                className={`${inputBase} ${FIN_MONO}`}
              />
            </Field>
            <Field label="Fim de vigência">
              <input
                type="date"
                name="vigencia_fim"
                defaultValue={currentEditItem?.vigencia_fim ?? ""}
                className={`${inputBase} ${FIN_MONO}`}
              />
            </Field>
          </div>

          <Field label="Observações">
            <textarea
              name="observacoes"
              rows={3}
              defaultValue={currentEditItem?.observacoes ?? ""}
              placeholder="Notas adicionais sobre o contrato…"
              className={`${inputBase} resize-y`}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 border-t border-slate-200 px-6 pb-[18px] pt-[14px] dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-[18px] text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-[22px] text-[13px] font-extrabold text-white transition hover:brightness-[1.06] disabled:opacity-60"
          >
            {isPending ? <MobileButtonSpinner size={20} /> : currentEditItem ? "Salvar contrato" : "Criar contrato"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-[11px] font-bold uppercase tracking-[.05em] text-slate-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 text-[11.5px] font-extrabold uppercase tracking-[.12em] text-violet-500">{title}</div>
      {children}
    </div>
  );
}

function MoneyInput({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-zinc-500">
        R$
      </span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        step="0.01"
        min="0"
        className={`${inputBase} ${FIN_MONO} pl-[34px]`}
      />
    </div>
  );
}

function PercentInput({ name, defaultValue, step }: { name: string; defaultValue: string; step: string }) {
  const [pct, setPct] = useState(defaultValue);
  const decimal = pct.trim() === "" ? "0" : String(Number(pct) / 100);
  return (
    <div className="relative">
      <input
        type="number"
        value={pct}
        step={step}
        min="0"
        max="100"
        onChange={(e) => setPct(e.target.value)}
        className={`${inputBase} ${FIN_MONO} pr-7`}
      />
      <span className="pointer-events-none absolute right-[11px] top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-zinc-500">
        %
      </span>
      <input type="hidden" name={name} value={decimal} />
    </div>
  );
}
