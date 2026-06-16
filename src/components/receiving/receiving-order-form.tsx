"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { receivingOrderDraftSchema } from "@/lib/validations/receiving";

type ReceivingOrderItemState = {
  produtoId: string;
  quantidadePrevista: string;
};

type ReceivingOrderFormState = {
  depositanteId: string;
  fornecedor: string;
  notaFiscal: string;
  previsao: string;
  doca: string;
  volumes: string;
  skuCount: string;
  conferenciaLote: boolean;
  conferenciaValidade: boolean;
  observacoes: string;
  items: ReceivingOrderItemState[];
};

type DepositanteOption = {
  id: string;
  nome: string;
};

type ProductOption = {
  id: string;
  nome: string;
  sku: string;
  codigoInterno: string;
  unidadeEstocagem: string;
  depositanteId: string;
};

type ReceivingOrderFormProps = {
  depositantes: DepositanteOption[];
  produtos: ProductOption[];
  lockDepositante?: boolean;
};

type FieldErrors = Partial<Record<keyof ReceivingOrderFormState, string[]>>;

function createEmptyItem(): ReceivingOrderItemState {
  return {
    produtoId: "",
    quantidadePrevista: "",
  };
}

export function ReceivingOrderForm({
  depositantes,
  produtos,
  lockDepositante = false,
}: ReceivingOrderFormProps) {
  const defaultDepositanteId = depositantes[0]?.id ?? "";

  const initialDraft: ReceivingOrderFormState = {
    depositanteId: defaultDepositanteId,
    fornecedor: "",
    notaFiscal: "",
    previsao: "",
    doca: "DOCA-01",
    volumes: "",
    skuCount: "0",
    conferenciaLote: true,
    conferenciaValidade: true,
    observacoes: "",
    items: [createEmptyItem()],
  };

  const [draft, setDraft] = useState<ReceivingOrderFormState>(initialDraft);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const selectedDepositanteName =
    depositantes.find((depositante) => depositante.id === draft.depositanteId)?.nome ?? "-";

  const availableProducts = useMemo(
    () =>
      produtos.filter((produto) => produto.depositanteId === draft.depositanteId),
    [draft.depositanteId, produtos],
  );

  const filledItemCount = useMemo(
    () => draft.items.filter((item) => item.produtoId.trim()).length,
    [draft.items],
  );

  const canSubmit = useMemo(() => {
    return Boolean(
      draft.depositanteId &&
        draft.fornecedor.trim() &&
        draft.notaFiscal.trim() &&
        draft.previsao &&
        String(draft.volumes).trim() &&
        draft.items.length > 0 &&
        draft.items.every(
          (item) => item.produtoId.trim() && String(item.quantidadePrevista).trim(),
        ),
    );
  }, [draft]);

  function updateField<K extends keyof ReceivingOrderFormState>(
    field: K,
    value: ReceivingOrderFormState[K],
  ) {
    setDraft((current) => {
      if (field === "depositanteId") {
        return {
          ...current,
          depositanteId: value as string,
          skuCount: "0",
          items: [createEmptyItem()],
        };
      }

      const next = {
        ...current,
        [field]: value,
      };

      if (field === "items") {
        next.skuCount = String(
          (value as ReceivingOrderItemState[]).filter((item) => item.produtoId.trim()).length,
        );
      }

      return next;
    });

    setSubmitted(false);
    setSubmitMessage(null);
    setItemsError(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  function updateItem(
    index: number,
    field: keyof ReceivingOrderItemState,
    value: string,
  ) {
    const nextItems = draft.items.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            [field]: value,
          }
        : item,
    );

    updateField("items", nextItems);
  }

  function addItem() {
    updateField("items", [...draft.items, createEmptyItem()]);
  }

  function removeItem(index: number) {
    const nextItems = draft.items.filter((_, itemIndex) => itemIndex !== index);
    updateField("items", nextItems.length ? nextItems : [createEmptyItem()]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      ...draft,
      skuCount: Math.max(filledItemCount, 0),
    };

    const parsed = receivingOrderDraftSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      const itemIssue = parsed.error.issues.find((issue) => issue.path[0] === "items");
      setItemsError(itemIssue?.message ?? null);
      setSubmitted(false);
      setSubmitMessage("Corrija os campos destacados para validar o recebimento.");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setItemsError(null);

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
        setItemsError(result.fieldErrors?.items?.[0] ?? null);
        setSubmitted(false);
        setSubmitMessage(result.error ?? "Não foi possível abrir o recebimento.");
        return;
      }

      const nextDepositanteId = draft.depositanteId || defaultDepositanteId;

      setDraft({
        ...initialDraft,
        depositanteId: nextDepositanteId,
      });
      setSubmitted(true);
      setSubmitMessage(`${result.message} Código gerado: ${result.order.code}.`);
    } catch {
      setSubmitted(false);
      setSubmitMessage("Falha ao comunicar com a API interna do recebimento.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetDraft() {
    setDraft({
      ...initialDraft,
      depositanteId: draft.depositanteId || defaultDepositanteId,
    });
    setSubmitted(false);
    setSubmitMessage(null);
    setFieldErrors({});
    setItemsError(null);
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
              Abertura real de pedido inbound com itens vinculados ao cadastro de produtos.
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            Banco real
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Depositante" error={fieldErrors.depositanteId?.[0]}>
            <select
              value={draft.depositanteId}
              onChange={(event) => updateField("depositanteId", event.target.value)}
              disabled={lockDepositante || depositantes.length <= 1}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {depositantes.map((depositante) => (
                <option key={depositante.id} value={depositante.id}>
                  {depositante.nome}
                </option>
              ))}
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

          <Field label="Quantidade de SKUs">
            <input
              value={String(filledItemCount)}
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 outline-none"
            />
          </Field>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Itens do recebimento</h3>
              <p className="text-sm text-slate-600">
                Selecione os produtos reais do depositante e informe a quantidade prevista.
              </p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Adicionar item
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {draft.items.map((item, index) => (
              <div
                key={`receiving-item-${index}`}
                className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1.5fr_0.7fr_auto]"
              >
                <label className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">
                    Produto
                  </span>
                  <select
                    value={item.produtoId}
                    onChange={(event) => updateItem(index, "produtoId", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">Selecione um produto</option>
                    {availableProducts.map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.sku} - {produto.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">
                    Quantidade prevista
                  </span>
                  <input
                    value={item.quantidadePrevista}
                    onChange={(event) =>
                      updateItem(index, "quantidadePrevista", event.target.value)
                    }
                    placeholder="Ex.: 24"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>

                {item.produtoId ? (
                  <div className="md:col-span-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {renderProductHint(availableProducts, item.produtoId)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {itemsError ? (
            <p className="mt-3 text-sm text-rose-600">{itemsError}</p>
          ) : null}

          {!availableProducts.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Este depositante ainda não possui produtos ativos para vincular ao recebimento.
            </div>
          ) : null}
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
            disabled={!canSubmit || isSubmitting || !availableProducts.length}
            className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {isSubmitting ? "Salvando..." : "Abrir recebimento"}
          </button>
          <button
            type="button"
            onClick={resetDraft}
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
            <SummaryRow label="Depositante" value={selectedDepositanteName} />
            <SummaryRow label="Fornecedor" value={draft.fornecedor || "-"} />
            <SummaryRow label="Nota fiscal" value={draft.notaFiscal || "-"} />
            <SummaryRow label="Previsão" value={draft.previsao || "-"} />
            <SummaryRow label="Doca" value={draft.doca || "-"} />
            <SummaryRow label="Volumes" value={String(draft.volumes || "-")} />
            <SummaryRow label="SKUs" value={String(filledItemCount || "-")} />
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
              Preencha os campos para abrir o recebimento no banco operacional.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Regras desta tela
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>O pedido nasce vinculado a um depositante real do ambiente.</li>
            <li>Os itens definem os SKUs esperados e a quantidade planejada.</li>
            <li>Lote e validade configuram a política inicial de conferência.</li>
            <li>As observações seguem para o protocolo operacional da entrada.</li>
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

function renderProductHint(products: ProductOption[], productId: string) {
  const product = products.find((item) => item.id === productId);

  if (!product) {
    return "Produto fora do escopo do depositante selecionado.";
  }

  return `Código interno: ${product.codigoInterno} • Unidade: ${formatUnitLabel(product.unidadeEstocagem)}`;
}

function formatUnitLabel(unit: string) {
  switch (unit) {
    case "UNIDADE":
      return "Unidade";
    case "CAIXA":
      return "Caixa";
    case "PALLET":
      return "Pallet";
    default:
      return unit;
  }
}
