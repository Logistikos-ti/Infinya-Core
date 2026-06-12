"use client";

import { useMemo, useState } from "react";
import { receivingOrderDraftSchema } from "@/lib/validations/receiving";

type ReceivingOrderFormState = {
  depositante: string;
  fornecedor: string;
  notaFiscal: string;
  previsao: string;
  doca: string;
  volumes: string;
  skuCount: string;
  conferenciaLote: boolean;
  conferenciaValidade: boolean;
  observacoes: string;
};

const initialDraft: ReceivingOrderFormState = {
  depositante: "Evolveg",
  fornecedor: "",
  notaFiscal: "",
  previsao: "",
  doca: "DOCA-01",
  volumes: "",
  skuCount: "",
  conferenciaLote: true,
  conferenciaValidade: true,
  observacoes: "",
};

type FieldErrors = Partial<Record<keyof ReceivingOrderFormState, string[]>>;

export function ReceivingOrderForm() {
  const [draft, setDraft] = useState<ReceivingOrderFormState>(initialDraft);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(
      draft.depositante &&
        draft.fornecedor.trim() &&
        draft.notaFiscal.trim() &&
        draft.previsao &&
        String(draft.volumes).trim() &&
        String(draft.skuCount).trim(),
    );
  }, [draft]);

  function updateField<K extends keyof ReceivingOrderFormState>(
    field: K,
    value: ReceivingOrderFormState[K],
  ) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setSubmitted(false);
    setSubmitMessage(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = receivingOrderDraftSchema.safeParse(draft);

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      setSubmitted(false);
      setSubmitMessage("Corrija os campos destacados para validar o recebimento.");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const response = await fetch("/api/recebimento", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const result = await response.json();

      if (!response.ok) {
        setFieldErrors((result.fieldErrors ?? {}) as FieldErrors);
        setSubmitted(false);
        setSubmitMessage(result.error ?? "Não foi possível validar o recebimento.");
        return;
      }

      setSubmitted(true);
      setSubmitMessage(`${result.message} Código provisório: ${result.draft.code}.`);
    } catch {
      setSubmitted(false);
      setSubmitMessage("Falha ao comunicar com a API interna do recebimento.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Novo pedido de recebimento
            </h2>
            <p className="text-sm text-slate-600">
              Estrutura inicial para o fluxo inbound do mês 1.
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            MVP
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Depositante" error={fieldErrors.depositante?.[0]}>
            <select
              value={draft.depositante}
              onChange={(event) => updateField("depositante", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              <option>Evolveg</option>
              <option>Festcolor</option>
              <option>Rennova</option>
              <option>Sua Aliada</option>
            </select>
          </Field>

          <Field label="Fornecedor" error={fieldErrors.fornecedor?.[0]}>
            <input
              value={draft.fornecedor}
              onChange={(event) => updateField("fornecedor", event.target.value)}
              placeholder="Nome do fornecedor"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </Field>

          <Field label="Nota fiscal" error={fieldErrors.notaFiscal?.[0]}>
            <input
              value={draft.notaFiscal}
              onChange={(event) => updateField("notaFiscal", event.target.value)}
              placeholder="Número da NF"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </Field>

          <Field label="Previsão de chegada" error={fieldErrors.previsao?.[0]}>
            <input
              type="datetime-local"
              value={draft.previsao}
              onChange={(event) => updateField("previsao", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </Field>

          <Field label="Doca inicial" error={fieldErrors.doca?.[0]}>
            <select
              value={draft.doca}
              onChange={(event) => updateField("doca", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              <option>DOCA-01</option>
              <option>DOCA-02</option>
              <option>DOCA-03</option>
            </select>
          </Field>

          <Field label="Volumes previstos" error={fieldErrors.volumes?.[0]}>
            <input
              value={draft.volumes}
              onChange={(event) => updateField("volumes", event.target.value)}
              placeholder="Ex.: 120"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </Field>

          <Field label="Quantidade de SKUs" error={fieldErrors.skuCount?.[0]}>
            <input
              value={draft.skuCount}
              onChange={(event) => updateField("skuCount", event.target.value)}
              placeholder="Ex.: 18"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </Field>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.conferenciaLote}
              onChange={(event) => updateField("conferenciaLote", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>
              <span className="font-medium text-slate-950">Conferência por lote</span>
              <span className="mt-1 block text-slate-500">
                Obriga captura de lote no recebimento dos itens.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.conferenciaValidade}
              onChange={(event) =>
                updateField("conferenciaValidade", event.target.checked)
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>
              <span className="font-medium text-slate-950">
                Controle de validade
              </span>
              <span className="mt-1 block text-slate-500">
                Habilita FEFO e alerta de validade crítica na entrada.
              </span>
            </span>
          </label>
        </div>

        <Field
          label="Observações"
          className="mt-6"
          error={fieldErrors.observacoes?.[0]}
        >
          <textarea
            value={draft.observacoes}
            onChange={(event) => updateField("observacoes", event.target.value)}
            rows={4}
            placeholder="Informações de doca, conferência ou orientações do depositante"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </Field>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {isSubmitting ? "Validando..." : "Validar abertura do recebimento"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(initialDraft);
              setSubmitted(false);
              setSubmitMessage(null);
              setFieldErrors({});
            }}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Limpar rascunho
          </button>
        </div>
      </form>

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Resumo operacional
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <SummaryRow label="Depositante" value={draft.depositante || "-"} />
            <SummaryRow label="Fornecedor" value={draft.fornecedor || "-"} />
            <SummaryRow label="Nota fiscal" value={draft.notaFiscal || "-"} />
            <SummaryRow label="Previsão" value={draft.previsao || "-"} />
            <SummaryRow label="Doca" value={draft.doca || "-"} />
            <SummaryRow label="Volumes" value={String(draft.volumes || "-")} />
            <SummaryRow label="SKUs" value={String(draft.skuCount || "-")} />
          </div>

          {submitMessage ? (
            <div
              className={`mt-5 rounded-2xl p-4 text-sm ${
                submitted
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {submitMessage}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Preencha os campos para validar a abertura do recebimento.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Regras desta tela
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>Pedido precisa nascer vinculado a um depositante e uma doca.</li>
            <li>Volumes e SKUs previstos alimentam o planejamento do turno.</li>
            <li>Lote e validade configuram a política de conferência.</li>
            <li>Observações ficam no protocolo operacional da entrada.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
};

function Field({ label, children, className, error }: FieldProps) {
  return (
    <label className={className}>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
