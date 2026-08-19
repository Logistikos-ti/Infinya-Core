"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, LoaderCircle, Minus, Plus, X, Box, PackageX } from "lucide-react";
import {
  createRetiradaDepositanteAction,
  type CreateRetiradaState,
} from "@/app/(portal)/portal/retirada-action";

type PortalProduct = {
  id: string;
  nome: string;
  sku: string | null;
  codigo_interno: string | null;
  codigo_externo: string | null;
  imagem_principal_url: string | null;
  estoque_disponivel: number;
};

type SelectedProduct = PortalProduct & { quantity: number };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-6 text-sm font-extrabold text-white shadow-lg shadow-rose-500/20 transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-50"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Enviando..." : "Solicitar retirada"}
    </button>
  );
}

export function PortalRetiradaDrawer({
  depositanteId,
  depositanteName,
  products,
  onClose,
}: {
  depositanteId: string;
  depositanteName: string;
  products: PortalProduct[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, formAction] = useActionState<CreateRetiradaState, FormData>(createRetiradaDepositanteAction, {
    status: "idle",
  });

  useEffect(() => {
    if (state.status !== "success") return;
    router.refresh();
    onClose();
  }, [state.status, router, onClose]);

  const availableProducts = useMemo(
    () => products.filter((product) => product.estoque_disponivel > 0),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return availableProducts;
    return availableProducts.filter((product) =>
      [product.nome, product.sku, product.codigo_interno, product.codigo_externo]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalized)),
    );
  }, [availableProducts, query]);

  const totalUnits = selected.reduce((sum, product) => sum + product.quantity, 0);
  const selectedIds = new Set(selected.map((product) => product.id));
  const hasStockIssue = selected.some(
    (product) => product.estoque_disponivel <= 0 || product.quantity > product.estoque_disponivel,
  );

  function toggleProduct(product: PortalProduct) {
    setSelected((current) =>
      selectedIds.has(product.id)
        ? current.filter((item) => item.id !== product.id)
        : [...current, { ...product, quantity: 1 }],
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Retirada de mercadoria">
      <button
        type="button"
        aria-label="Fechar retirada"
        onClick={onClose}
        className="absolute inset-0 cursor-default border-0 bg-slate-900/55 backdrop-blur-sm"
      />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0c1424]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-br from-white to-amber-50 px-6 py-6 dark:border-white/10 dark:from-[#0c1424] dark:to-[#2a1810]">
          <div>
            <p className="text-xs font-extrabold tracking-[0.13em] text-amber-600 dark:text-amber-300">RETIRADA DE MERCADORIA</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Solicitar retirada</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              O pedido fica bloqueado até o armazém emitir a NF-e de devolução.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-px hover:border-amber-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-32 pt-6">
            <input type="hidden" name="depositanteId" value={depositanteId} />

            {state.status === "error" ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="whitespace-pre-line">{state.detail}</p>
              </div>
            ) : null}

            {selected.map((product) => (
              <span key={product.id}>
                <input type="hidden" name="productId[]" value={product.id} />
                <input type="hidden" name="itemQuantity[]" value={product.quantity} />
              </span>
            ))}

            <section>
              <h3 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">Operação</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Depositante
                  <input
                    value={depositanteName}
                    readOnly
                    className="mt-1.5 h-12 w-full rounded-2xl border border-amber-300 bg-white px-4 text-sm text-slate-900 outline-none dark:bg-white/5 dark:text-white"
                  />
                </label>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Número do pedido
                  <input
                    value="Será gerado (WMS-...)"
                    readOnly
                    className="mt-1.5 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm italic text-slate-500 outline-none dark:border-white/10 dark:bg-white/5"
                  />
                </label>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">Destinatário</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["clienteNome", "Nome do destinatário", "Ex.: Depósito Central", true],
                  ["clienteDocumento", "CPF / CNPJ", "000.000.000-00", false],
                  ["clienteCep", "CEP", "00000-000", false],
                  ["clienteCidade", "Cidade / UF", "São Paulo · SP", false],
                  ["clienteEndereco", "Endereço", "Ex.: Rua das Flores", false],
                  ["clienteNumero", "Número", "Ex.: 125", false],
                  ["clienteTelefone", "Telefone", "(00) 00000-0000", false],
                ].map(([name, label, placeholder, required]) => (
                  <label key={String(name)} className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {label}
                    <input
                      name={String(name)}
                      required={Boolean(required)}
                      placeholder={String(placeholder)}
                      className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                ))}
              </div>
              <input type="hidden" name="clienteUf" value="" />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">Itens da retirada</h3>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-xs font-extrabold text-amber-600 transition hover:-translate-y-px dark:text-amber-300"
                >
                  + Adicionar item
                </button>
              </div>
              {!selected.length ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-white/15">
                  Somente itens com estoque disponível podem ser retirados.
                </div>
              ) : (
                <div className="space-y-2">
                  {selected.map((product) => (
                    <div key={product.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 text-white">
                        {product.imagem_principal_url ? (
                          <img src={product.imagem_principal_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Box className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-slate-900 dark:text-white">{product.nome}</strong>
                        <small className="text-xs text-slate-500">
                          {product.sku || product.codigo_interno || "Sem código"} · {product.estoque_disponivel} disponível
                        </small>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((items) =>
                            items.map((item) =>
                              item.id === product.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item,
                            ),
                          )
                        }
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-700 dark:border-white/10 dark:text-white"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        aria-label={`Quantidade de ${product.nome}`}
                        value={product.quantity}
                        onChange={(event) =>
                          setSelected((items) =>
                            items.map((item) =>
                              item.id === product.id
                                ? {
                                    ...item,
                                    quantity: Math.min(
                                      item.estoque_disponivel,
                                      Math.max(1, Number(event.target.value) || 1),
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="w-8 border-0 bg-transparent text-center text-sm font-extrabold outline-none dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((items) =>
                            items.map((item) =>
                              item.id === product.id
                                ? { ...item, quantity: Math.min(item.estoque_disponivel, item.quantity + 1) }
                                : item,
                            ),
                          )
                        }
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-700 dark:border-white/10 dark:text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelected((items) => items.filter((item) => item.id !== product.id))}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-400/30 dark:bg-rose-400/10"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-sm font-extrabold text-slate-950 dark:text-white">Frete / transportadora</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Transportadora
                  <input
                    name="carrierName"
                    placeholder="Ex.: Frete próprio, Coleta agendada..."
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Serviço / observação
                  <input
                    name="shippingService"
                    placeholder="Ex.: Coleta 10h, motorista João"
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </label>
              </div>
            </section>
          </div>

          <footer className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 dark:border-white/10 dark:bg-[#0c1424]/95">
            <div>
              <span className="block text-xs text-slate-500">Total de itens</span>
              <strong className="text-xl text-slate-950 dark:text-white">{totalUnits}</strong>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-12 rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-900 transition hover:-translate-y-px hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                Cancelar
              </button>
              <SubmitButton disabled={!selected.length || hasStockIssue} />
            </div>
          </footer>
        </form>

        {pickerOpen ? (
          <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-[#0c1424]">
            <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 dark:border-white/10">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 dark:border-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <strong className="text-lg text-slate-950 dark:text-white">Escolher produtos</strong>
            </div>
            <div className="px-6 pt-5">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome ou SKU..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-6">
              {!filteredProducts.length ? (
                <div className="grid place-items-center gap-2 py-16 text-center text-sm text-slate-500">
                  <PackageX className="h-10 w-10 text-slate-400" />
                  Nenhum produto com estoque disponível para retirada.
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const added = selectedIds.has(product.id);
                  return (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => toggleProduct(product)}
                      className={`flex min-h-[68px] w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-px ${
                        added ? "border-amber-500 bg-amber-50 dark:bg-amber-400/10" : "border-slate-200 dark:border-white/10"
                      }`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 text-white">
                        {product.imagem_principal_url ? (
                          <img src={product.imagem_principal_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Box className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-slate-900 dark:text-white">{product.nome}</strong>
                        <small className="text-xs text-slate-500">
                          {product.sku || product.codigo_interno || "Sem código"} · {product.estoque_disponivel} disponível
                        </small>
                      </span>
                      <span className={`text-xs font-extrabold ${added ? "text-emerald-500" : "text-amber-600"}`}>
                        {added ? (
                          <>
                            <Check className="mr-1 inline h-4 w-4" />
                            Adicionado
                          </>
                        ) : (
                          "+ Adicionar"
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t border-slate-200 p-6 dark:border-white/10">
              <button
                type="button"
                disabled={!selected.length}
                onClick={() => setPickerOpen(false)}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-sm font-extrabold text-white disabled:opacity-50"
              >
                Concluir seleção ({selected.length})
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
