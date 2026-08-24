"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, SlidersHorizontal } from "lucide-react";
import type { DepositanteBlingImportFilter } from "@/lib/depositantes";

type Props = {
  depositanteId: string;
  embedded?: boolean;
};

const emptyFilter: DepositanteBlingImportFilter = {
  enabled: false,
  warehouseName: "CD SP - Logistikos",
  acceptedSituationIds: [],
  acceptedSituationNames: ["Atendido"],
  allowedStoreIds: [],
  allowedStoreNames: [],
  allowedBusinessUnitIds: [],
  allowedBusinessUnitNames: [],
};

export function BlingImportConfiguration({ depositanteId, embedded = false }: Props) {
  const [filter, setFilter] = useState<DepositanteBlingImportFilter>(emptyFilter);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;

    void fetch(`/api/integracoes/bling/configuracao-importacao?depositanteId=${encodeURIComponent(depositanteId)}`)
      .then(async (response) => {
        const payload = (await response.json()) as { filter?: DepositanteBlingImportFilter; error?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar a configuração.");
        if (active && payload.filter) setFilter(payload.filter);
      })
      .catch((error: unknown) => {
        if (active) setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao carregar a configuração." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [depositanteId]);

  async function save() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/integracoes/bling/configuracao-importacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositanteId, ...filter }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar a configuração.");
      setMessage({ type: "success", text: "Política de importação salva com sucesso." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao salvar a configuração." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={`flex min-h-32 items-center justify-center ${embedded ? "" : "rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101b30]"}`}>
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <section className={embedded ? "" : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#101b30]"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300">
            <SlidersHorizontal className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Política de entrada de pedidos</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Restrinja novos pedidos pela situação e pelas lojas ou unidades de negócio vinculadas à operação logística.
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
          <input
            type="checkbox"
            checked={filter.enabled}
            onChange={(event) => setFilter((current) => ({ ...current, enabled: event.target.checked }))}
            className="h-4 w-4 accent-violet-600"
          />
          Ativar filtro específico
        </label>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field
          label="Situações aceitas"
          help="Uma por linha. Para este fluxo, use Atendido."
          value={toLines(filter.acceptedSituationNames)}
          onChange={(value) => setFilter((current) => ({ ...current, acceptedSituationNames: fromLines(value) }))}
          singleLine
        />
        <Field
          label="Depósito de referência"
          help="Referência operacional; o filtro efetivo usa loja e unidade."
          value={filter.warehouseName ?? ""}
          onChange={(value) => setFilter((current) => ({ ...current, warehouseName: value.trim() || null }))}
          singleLine
        />
        <Field
          label="Lojas autorizadas"
          help="Uma por linha, usando o nome exibido no Bling."
          value={toLines(filter.allowedStoreNames)}
          onChange={(value) => setFilter((current) => ({ ...current, allowedStoreNames: fromLines(value) }))}
        />
        <Field
          label="Unidades de negócio autorizadas"
          help="Uma por linha, por exemplo Matriz ou Filial SP."
          value={toLines(filter.allowedBusinessUnitNames)}
          onChange={(value) => setFilter((current) => ({ ...current, allowedBusinessUnitNames: fromLines(value) }))}
        />
        <Field
          label="IDs de lojas (opcional)"
          help="Use quando o webhook do Bling fornecer apenas o ID."
          value={toLines(filter.allowedStoreIds)}
          onChange={(value) => setFilter((current) => ({ ...current, allowedStoreIds: fromLines(value) }))}
        />
        <Field
          label="IDs de unidades (opcional)"
          help="Um identificador por linha."
          value={toLines(filter.allowedBusinessUnitIds)}
          onChange={(value) => setFilter((current) => ({ ...current, allowedBusinessUnitIds: fromLines(value) }))}
        />
      </div>

      {message ? (
        <div className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"}`}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : null}
          {message.text}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Salvando..." : "Salvar política"}
      </button>
    </section>
  );
}

function Field({
  label,
  help,
  value,
  onChange,
  singleLine = false,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  singleLine?: boolean;
}) {
  const className = "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15 dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{label}</span>
      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{help}</span>
      {singleLine ? (
        <input value={value} onChange={(event) => onChange(event.target.value)} className={className} />
      ) : (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className={`${className} resize-y`} />
      )}
    </label>
  );
}

function fromLines(value: string) {
  return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}

function toLines(value: string[]) {
  return value.join("\n");
}
